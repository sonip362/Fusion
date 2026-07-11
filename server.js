const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const dns = require('dns');
require('dotenv').config();

// Force IPv4 resolution first to avoid ENETUNREACH on IPv6-unfriendly networks
dns.setDefaultResultOrder('ipv4first');


// Models
const Product = require('./models/Product');
const User = require('./models/User');
const Guest = require('./models/Guest');

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secure_key_fusion_2026';

// Middleware
app.use(cors());
app.use(express.json({ limit: '6mb' }));
app.use(express.static(path.join(__dirname)));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- AUTHENTICATION MIDDLEWARE & LOCKS ---
const MAX_FAILED_LOGINS_BEFORE_LOCK = 6; // Lock when failures are more than 6 (7th failure)
const LOGIN_LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const LOGIN_REWARD_COINS = 5;
const MIN_REDEEM_COINS = 20;
const COIN_EARN_RATE_RUPEES = 100;
const loginLockState = new Map(); // emailKey -> { failedCount, lockedUntil }

const normalizeEmailKey = (email) => String(email || '').trim().toLowerCase();

const getLockInfo = (emailKey) => {
    const state = loginLockState.get(emailKey);
    if (!state) return null;

    if (state.lockedUntil && Date.now() >= state.lockedUntil) {
        loginLockState.delete(emailKey);
        return null;
    }

    return state;
};

const registerFailedLogin = (emailKey) => {
    const current = getLockInfo(emailKey) || { failedCount: 0, lockedUntil: null };
    current.failedCount += 1;

    if (current.failedCount > MAX_FAILED_LOGINS_BEFORE_LOCK) {
        current.lockedUntil = Date.now() + LOGIN_LOCK_DURATION_MS;
        current.failedCount = 0;
    }

    loginLockState.set(emailKey, current);
    return current;
};

const clearLoginLock = (emailKey) => {
    loginLockState.delete(emailKey);
};

const getRemainingLockSeconds = (lockedUntil) => Math.max(1, Math.ceil((lockedUntil - Date.now()) / 1000));

// Middleware to authenticate JWT tokens
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired authentication token.' });
        }
        req.user = user; // user contains userId
        next();
    });
};

// --- AUTHENTICATION ROUTES ---

// Registration Endpoint
app.post('/api/register', async (req, res) => {
    try {
        const { fullName, email, password, profilePicture } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists with this email.' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        const normalizedProfilePicture = typeof profilePicture === 'string' ? profilePicture.trim() : '';
        const isValidProfilePicture = !normalizedProfilePicture
            || /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(normalizedProfilePicture);

        if (!isValidProfilePicture) {
            return res.status(400).json({ error: 'Invalid profile picture format.' });
        }

        // Create new user
        const newUser = new User({
            fullName,
            email,
            password: hashedPassword,
            profilePicture: normalizedProfilePicture
        });

        await newUser.save();

        // Sign token
        const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, { expiresIn: '24h' });

        res.status(201).json({
            message: 'User registered successfully!',
            token,
            user: {
                id: newUser._id,
                fullName: newUser.fullName,
                email: newUser.email,
                profilePicture: newUser.profilePicture || '',
                cart: newUser.cart || [],
                wishlist: newUser.wishlist || [],
                rewardCoins: Number(newUser.rewardCoins) || 0
            }
        });

    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ error: 'Internal server error during registration.' });
    }
});

// Login Endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const emailKey = normalizeEmailKey(email);

        const lockInfo = getLockInfo(emailKey);
        if (lockInfo && lockInfo.lockedUntil) {
            const retryAfterSeconds = getRemainingLockSeconds(lockInfo.lockedUntil);
            return res.status(429).json({
                error: `Too many failed attempts. Try again in ${retryAfterSeconds} seconds.`,
                retryAfterSeconds
            });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            const updatedState = registerFailedLogin(emailKey);
            if (updatedState.lockedUntil) {
                const retryAfterSeconds = getRemainingLockSeconds(updatedState.lockedUntil);
                return res.status(429).json({
                    error: `Too many failed attempts. Account locked for ${retryAfterSeconds} seconds.`,
                    retryAfterSeconds
                });
            }
            return res.status(400).json({ error: 'Invalid email or password.' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            const updatedState = registerFailedLogin(emailKey);
            if (updatedState.lockedUntil) {
                const retryAfterSeconds = getRemainingLockSeconds(updatedState.lockedUntil);
                return res.status(429).json({
                    error: `Too many failed attempts. Account locked for ${retryAfterSeconds} seconds.`,
                    retryAfterSeconds
                });
            }
            return res.status(400).json({ error: 'Invalid email or password.' });
        }

        clearLoginLock(emailKey);

        let rewardCoinsAdded = 0;
        let loggedInUser = user;

        // --- GUEST MERGE LOGIC ---
        const { guestId } = req.body;
        if (guestId) {
            try {
                const guestDoc = await Guest.findOne({ guestId });
                if (guestDoc) {
                    // Merge Cart
                    const userCart = user.cart || [];
                    const guestCart = guestDoc.cart || [];

                    // Simple merge: Add guest items if not already in user cart (by ID)
                    const mergedCart = [...userCart];
                    guestCart.forEach(gItem => {
                        const exists = mergedCart.find(uItem => uItem.id === gItem.id);
                        if (!exists) {
                            mergedCart.push(gItem);
                        } else {
                            exists.quantity = (Number(exists.quantity) || 1) + (Number(gItem.quantity) || 1);
                        }
                    });

                    // Merge Wishlist
                    const userWishlist = user.wishlist || [];
                    const guestWishlist = guestDoc.wishlist || [];
                    const mergedWishlist = [...userWishlist];
                    guestWishlist.forEach(gItem => {
                        const exists = mergedWishlist.find(uItem => uItem.id === gItem.id);
                        if (!exists) mergedWishlist.push(gItem);
                    });

                    // Merge Recently Viewed
                    const userRecent = user.recentlyViewed || [];
                    const guestRecent = guestDoc.recentlyViewed || [];
                    const mergedRecent = [...userRecent];
                    guestRecent.forEach(gItem => {
                        const exists = mergedRecent.find(uItem => uItem.id === gItem.id);
                        if (!exists) mergedRecent.push(gItem);
                    });

                    // Update User
                    const updatedUser = await User.findByIdAndUpdate(
                        user._id,
                        {
                            cart: mergedCart,
                            wishlist: mergedWishlist,
                            recentlyViewed: mergedRecent
                        },
                        { new: true }
                    );
                    if (updatedUser) loggedInUser = updatedUser;

                    // Delete Guest Doc
                    await Guest.deleteOne({ guestId });
                    console.log(`✅ Merged guest ${guestId} into user ${email}`);
                }
            } catch (mergeErr) {
                console.warn('Non-critical merge error during login:', mergeErr);
            }
        }

        const currentCoinBalance = Number(loggedInUser.rewardCoins) || 0;

        if (!loggedInUser.hasReceivedLoginBonus && currentCoinBalance > 0) {
            const updatedUser = await User.findByIdAndUpdate(
                loggedInUser._id,
                { $set: { hasReceivedLoginBonus: true } },
                { new: true }
            );
            if (updatedUser) loggedInUser = updatedUser;
        } else if (!loggedInUser.hasReceivedLoginBonus) {
            const updatedUser = await User.findOneAndUpdate(
                { _id: loggedInUser._id, hasReceivedLoginBonus: { $ne: true } },
                {
                    $inc: { rewardCoins: LOGIN_REWARD_COINS },
                    $set: { hasReceivedLoginBonus: true }
                },
                { returnDocument: 'after' }
            );

            if (updatedUser) {
                loggedInUser = updatedUser;
                rewardCoinsAdded = LOGIN_REWARD_COINS;
            } else {
                const refreshedUser = await User.findById(loggedInUser._id);
                if (refreshedUser) loggedInUser = refreshedUser;
            }
        }

        if (!loggedInUser) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Sign token
        const token = jwt.sign({ userId: loggedInUser._id }, JWT_SECRET, { expiresIn: '24h' });

        // Login success
        res.json({
            message: 'Login successful!',
            token,
            rewardCoinsAdded,
            user: {
                id: loggedInUser._id,
                fullName: loggedInUser.fullName,
                email: loggedInUser.email,
                profilePicture: loggedInUser.profilePicture || '',
                cart: loggedInUser.cart,
                wishlist: loggedInUser.wishlist,
                rewardCoins: Number(loggedInUser.rewardCoins) || 0
            }
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Internal server error during login.' });
    }
});

// Save/Update User Profile Picture (stored as data URL)
app.post('/api/user/profile-picture', authenticateToken, async (req, res) => {
    try {
        const { profilePicture } = req.body || {};

        if (typeof profilePicture !== 'string' || !profilePicture.trim()) {
            return res.status(400).json({ error: 'Profile picture is required.' });
        }

        const normalizedImage = profilePicture.trim();
        const isDataImage = /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(normalizedImage);
        if (!isDataImage) {
            return res.status(400).json({ error: 'Only image uploads are supported.' });
        }

        // Keep payload bounded (~2.5MB base64 string)
        if (normalizedImage.length > 2_500_000) {
            return res.status(413).json({ error: 'Image is too large. Please use a smaller image.' });
        }

        const user = await User.findByIdAndUpdate(
            req.user.userId,
            { profilePicture: normalizedImage },
            { returnDocument: 'after' }
        );

        if (!user) return res.status(404).json({ error: 'User not found.' });

        res.json({
            message: 'Profile picture updated.',
            profilePicture: user.profilePicture || ''
        });
    } catch (error) {
        console.error('Profile Picture Update Error:', error);
        res.status(500).json({ error: 'Internal server error during profile update.' });
    }
});

// Sync User or Guest Data (Cart, Wishlist, Recently Viewed)
app.post('/api/user/sync', async (req, res) => {
    try {
        let { guestId, cart, wishlist, recentlyViewed } = req.body || {};
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        const update = {};
        if (cart !== undefined) update.cart = Array.isArray(cart) ? cart : [];
        if (wishlist !== undefined) update.wishlist = Array.isArray(wishlist) ? wishlist : [];
        if (recentlyViewed !== undefined) update.recentlyViewed = Array.isArray(recentlyViewed) ? recentlyViewed : [];

        let result;
        let isUser = false;

        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                isUser = true;
                if (Object.keys(update).length === 0) {
                    result = await User.findById(decoded.userId).select('-password -profilePicture');
                } else {
                    result = await User.findByIdAndUpdate(
                        decoded.userId,
                        update,
                        { returnDocument: 'after', upsert: false }
                    ).select('-password -profilePicture');
                }
            } catch (err) {
                return res.status(403).json({ error: 'Invalid or expired authentication token.' });
            }
        } else if (guestId) {
            // Fallback: Guest User
            if (Object.keys(update).length === 0) {
                result = await Guest.findOne({ guestId });
            } else {
                result = await Guest.findOneAndUpdate(
                    { guestId },
                    update,
                    { returnDocument: 'after', upsert: true }
                );
            }
        } else {
            return res.status(400).json({ error: 'Authentication token or guestId is required for syncing' });
        }

        if (!result) {
            if (isUser) return res.status(404).json({ error: 'User not found' });
            return res.status(500).json({ error: 'Sync failed' });
        }

        res.json({
            message: 'Sync successful',
            cart: result.cart || [],
            wishlist: result.wishlist || [],
            recentlyViewed: result.recentlyViewed || [],
            rewardCoins: Number(result.rewardCoins) || 0,
            chatHistory: result.chatHistory || [],
            type: isUser ? 'user' : 'guest'
        });
    } catch (error) {
        console.error('Sync Error:', error);
        res.status(500).json({ error: 'Internal server error during sync' });
    }
});

// Redeem Reward Coins
app.post('/api/user/redeem-coins', authenticateToken, async (req, res) => {
    try {
        const { coinsToRedeem } = req.body || {};

        const redeemAmount = Number(coinsToRedeem);
        if (!Number.isInteger(redeemAmount) || redeemAmount < MIN_REDEEM_COINS) {
            return res.status(400).json({
                error: `Minimum redeem amount is ${MIN_REDEEM_COINS} coins.`
            });
        }

        const user = await User.findOneAndUpdate(
            { _id: req.user.userId, rewardCoins: { $gte: redeemAmount } },
            { $inc: { rewardCoins: -redeemAmount } },
            { returnDocument: 'after' }
        );

        if (!user) {
            const existingUser = await User.findById(req.user.userId);
            if (!existingUser) return res.status(404).json({ error: 'User not found.' });
            return res.status(400).json({ error: 'Not enough coins to redeem.' });
        }

        res.json({
            message: 'Coins redeemed successfully.',
            redeemedCoins: redeemAmount,
            rewardCoins: Number(user.rewardCoins) || 0
        });
    } catch (error) {
        console.error('Redeem Coins Error:', error);
        res.status(500).json({ error: 'Internal server error during coin redemption.' });
    }
});

// Complete checkout reward update
app.post('/api/user/checkout-rewards', authenticateToken, async (req, res) => {
    try {
        const { coinsToRedeem = 0, shoppingAmount = 0 } = req.body || {};

        const redeemAmount = Math.max(0, Math.floor(Number(coinsToRedeem) || 0));
        if (redeemAmount > 0 && redeemAmount < MIN_REDEEM_COINS) {
            return res.status(400).json({
                error: `Minimum redeem amount is ${MIN_REDEEM_COINS} coins.`
            });
        }

        const normalizedShoppingAmount = Math.max(0, Number(shoppingAmount) || 0);
        const earnedCoins = Math.floor(normalizedShoppingAmount / COIN_EARN_RATE_RUPEES);

        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        const currentCoins = Number(user.rewardCoins) || 0;
        if (redeemAmount > currentCoins) {
            return res.status(400).json({ error: 'Not enough coins to redeem.' });
        }

        user.rewardCoins = currentCoins - redeemAmount + earnedCoins;
        await user.save();

        res.json({
            message: 'Checkout rewards updated.',
            redeemedCoins: redeemAmount,
            earnedCoins,
            rewardCoins: Number(user.rewardCoins) || 0
        });
    } catch (error) {
        console.error('Checkout Rewards Error:', error);
        res.status(500).json({ error: 'Internal server error during checkout rewards update.' });
    }
});

// Download User Data (GDPR compliance)
app.post('/api/user/download-data', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found.' });

        res.json({
            message: 'Data retrieved successfully.',
            userData: user
        });
    } catch (error) {
        console.error('Download Data Error:', error);
        res.status(500).json({ error: 'Internal server error during data retrieval.' });
    }
});

// Delete User Account
app.post('/api/user/delete', authenticateToken, async (req, res) => {
    try {
        const result = await User.deleteOne({ _id: req.user.userId });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.json({ message: 'Account deleted successfully. We are sorry to see you go.' });
    } catch (error) {
        console.error('Delete Account Error:', error);
        res.status(500).json({ error: 'Internal server error during account deletion.' });
    }
});

// --- REMAINING ROUTES ---

// Helper function to generate AI context from DB
async function getFUSION_CONTEXT() {
    try {
        const products = await Product.find({});
        const productContext = products.map(p =>
            `- ${p.name} (${p.collectionName}): ${p.price}, ${p.category}. ${p.description}`
        ).join('\n');

        return `You are the Fusion Website AI Assistant... (Standard Context)`;
    } catch (err) {
        return 'Standard Fusion AI Assistant Context.';
    }
}

// Chat endpoint with session persistence
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history = [], guestId } = req.body;
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        let userId = null;
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                userId = decoded.userId;
            } catch (err) {
                return res.status(403).json({ error: 'Invalid or expired authentication token.' });
            }
        }

        const groqApiKey = process.env.GROQ_API_KEY;
        const normalizedMessage = typeof message === 'string' ? message.trim() : '';

        if (!groqApiKey) {
            return res.status(503).json({ error: 'AI assistant is not configured. Missing GROQ_API_KEY.' });
        }
        if (!normalizedMessage) {
            return res.status(400).json({ error: 'Message is required.' });
        }

        // Build fresh product context for every request
        const products = await Product.find({});
        const productContext = products.map(p => `- ${p.name} (${p.collectionName}): ${p.price}`).join('\n');

        const currentContext = `You are the Fusion Website AI Assistant.
Rules:
- You answer ONLY questions about the Fusion website, its collections, products, policies (shipping, returns, sizing), and features.
- You must REFUSE to answer general fashion questions, celebrity style, weather, or anything unrelated to the Fusion website.
- If asked about something off-topic, say: "I can only help you with questions about the Fusion website, our collections, and policies."

Key information about Fusion:
- Collections: Daily Wear, Everywhere Choice, Modern Metro, Urban Edge, Sun & Shade, Weekend Vibe
- Products currently available:
${productContext}

- Sizing Guide (Measurements in cm):
  * S: Chest 90-95, Waist 75-80, Hip 90-95, Length 68
  * M: Chest 96-101, Waist 81-86, Hip 96-101, Length 70
  * L: Chest 102-107, Waist 87-92, Hip 102-107, Length 72
  * XL: Chest 108-113, Waist 93-98, Hip 108-113, Length 74
  * Recommendation: Use a soft measuring tape. If between sizes, choose the larger size for a relaxed fit.

- Shipping & Returns:
  * Dispatch: Orders typically ship within 1–3 business days.
  * Delivery: Domestic (3–7 business days), International (7–14 business days).
  * Returns: 14-day policy ONLY IF stated on the product page. Items must be unwashed/unused with tags.
  * Damages: Report within 48 hours of delivery with photo evidence for replacement/credit.
  * No returns for: Sizing preference (refer guide), change of mind, or screen color differences.

- Privacy Policy:
  * Data: We collect Identity, Contact, Technical, Usage, and Loyalty data via MongoDB Atlas.
  * Purpose: To manage your account, personalize recommendations, and process rewards.
  * Rights: You can request access, correction, or deletion of your MongoDB profile at any time.

Tone: Helpful, professional, and specific. Use emojis sparingly.
Formatting:
- Use markdown-style emphasis in responses when useful:
  * Bold with **text**
  * Italic with *text*
  * Underline with __text__
  * Strikethrough with ~~text~~
- In most answers, include at least one bold or italic phrase for readability.
Keep answers under 75 words.
`;

        const allowedRoles = new Set(['system', 'user', 'assistant']);
        const cleanedHistory = Array.isArray(history)
            ? history
                .filter(item => item && typeof item === 'object')
                .map(item => ({
                    role: String(item.role || '').toLowerCase(),
                    content: typeof item.content === 'string' ? item.content.trim() : ''
                }))
                .filter(item => allowedRoles.has(item.role) && item.content.length > 0)
            : [];

        const messages = [
            { role: 'system', content: currentContext },
            ...cleanedHistory.slice(-10),
            { role: 'user', content: normalizedMessage }
        ];

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        let response;
        try {
            response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${groqApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: messages,
                    max_tokens: 500
                }),
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeout);
        }

        if (!response.ok) {
            const rawError = await response.text();
            let providerMessage = `AI provider returned ${response.status}.`;
            try {
                const parsed = JSON.parse(rawError);
                providerMessage = parsed?.error?.message || providerMessage;
            } catch (_) { }

            console.error('Chat API provider error:', {
                status: response.status,
                message: providerMessage,
                body: rawError.slice(0, 500)
            });

            const statusCode = response.status === 429 ? 429 : 502;
            return res.status(statusCode).json({ error: providerMessage });
        }

        const data = await response.json();
        const aiMessage = data.choices[0]?.message?.content || 'I am having trouble processing that right now. Please try again.';

        // Persist to MongoDB if user/guest identified
        try {
            if (userId || guestId) {
                const newMessages = [
                    { role: 'user', content: normalizedMessage, timestamp: new Date() },
                    { role: 'assistant', content: aiMessage, timestamp: new Date() }
                ];

                if (userId) {
                    await User.findByIdAndUpdate(
                        userId,
                        { $push: { chatHistory: { $each: newMessages } } }
                    );
                } else if (guestId) {
                    await Guest.findOneAndUpdate(
                        { guestId },
                        { $push: { chatHistory: { $each: newMessages } } }
                    );
                }
            }
        } catch (dbErr) {
            console.error('Failed to persist chat to DB:', dbErr);
            // Don't fail the request if DB save fails
        }

        res.json({ message: aiMessage, model: data.model });
    } catch (error) {
        console.error('Chat API Error:', error);
        if (error?.name === 'AbortError') {
            return res.status(504).json({ error: 'AI service timeout. Please try again.' });
        }
        res.status(500).json({ error: 'Internal server error while processing chat.' });
    }
});

// Complete the Look Endpoint (Keep logic)
app.post('/api/complete-look', async (req, res) => {
    try {
        const { product } = req.body || {};
        if (!product || !product.id) {
            return res.status(400).json({ error: 'Product is required.' });
        }

        const otherProducts = await Product.find({ id: { $ne: product.id } });
        if (!otherProducts.length) {
            return res.json({ recommendations: [] });
        }

        const pickFallback = () => {
            const shuffled = otherProducts.slice().sort(() => Math.random() - 0.5);
            return shuffled.slice(0, 2);
        };

        if (!process.env.GROQ_API_KEY) {
            return res.json({ recommendations: pickFallback() });
        }

        const inventoryString = otherProducts.map(p => `ID: ${p.id}, Name: ${p.name}`).join('\n');
        const prompt = `Stylist: Viewing ${product.name}. Select 2 IDs from: ${inventoryString}. Return JSON array only.`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'system', content: 'JSON only.' }, { role: 'user', content: prompt }], max_tokens: 100 })
        });

        if (!response.ok) {
            return res.json({ recommendations: pickFallback() });
        }

        const data = await response.json();
        let content = data.choices[0]?.message?.content || '[]';
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();

        let ids = [];
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) ids = parsed;
        } catch (e) {
            ids = [];
        }

        // Ensure ids are strings, not objects (fixes CastError)
        const cleanIds = ids.map(id => (typeof id === 'object' && id !== null) ? (id.id || id.ID || id._id) : id)
            .filter(id => id && typeof id === 'string');

        const recommendations = cleanIds.length
            ? await Product.find({ id: { $in: cleanIds } })
            : pickFallback();

        res.json({ recommendations });
    } catch (error) {
        console.error('Complete-the-Look Error:', error.message || error);
        // pickFallback is scoped to try-block, so query DB directly here
        try {
            const { product: reqProduct } = req.body || {};
            const fallbackProducts = await Product.find(
                reqProduct?.id ? { id: { $ne: reqProduct.id } } : {}
            );
            const shuffled = fallbackProducts.slice().sort(() => Math.random() - 0.5);
            res.json({ recommendations: shuffled.slice(0, 2) });
        } catch (fallbackErr) {
            console.error('Complete-the-Look Fallback Error:', fallbackErr.message || fallbackErr);
            res.json({ recommendations: [] });
        }
    }
});

// --- NEWSLETTER SUBSCRIPTION (NODEMAILER ETHEREAL DEMO) ---
let cachedTransporter = null;
async function getTransporter() {
    if (cachedTransporter) return cachedTransporter;

    // If custom SMTP details are provided in your .env, use them to send real emails with connection pooling!
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        cachedTransporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.EMAIL_PORT || '587', 10),
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
            pool: true, // Use connection pooling
            maxConnections: 3,
            maxMessages: 50,
            rateLimit: 5 // limit to 5 emails per second
        });
        return cachedTransporter;
    }

    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
            user: testAccount.user,
            pass: testAccount.pass,
        },
    });
    console.log(`✉️ Created Ethereal Test Account: ${testAccount.user}`);
    return cachedTransporter;
}

app.post('/api/subscribe', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Please enter a valid email address.' });
        }

        const transporter = await getTransporter();
        const fromEmail = process.env.EMAIL_USER || 'newsletter@fusion.com';

        // Send the HTTP response immediately to keep the client UI snappy!
        res.json({ 
            message: 'Welcome to the circle! Check your inbox soon.'
        });

        // Send the email asynchronously in the background
        transporter.sendMail({
            from: `"Fusion Team" <${fromEmail}>`,
            to: email,
            subject: 'Welcome to the Fusion Circle! 🌟',
            text: 'Welcome to the Fusion Circle! Here is your exclusive 10% off code: FUSION10*. *Only applicable on purchases above ₹1,500.',
            html: `
                <div style="font-family: sans-serif; padding: 20px; color: #1a1a1a; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 8px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h1 style="font-family: 'Georgia', serif; font-size: 28px; margin: 0; color: #111;">FUSION</h1>
                        <p style="font-size: 10px; text-transform: uppercase; letter-spacing: 3px; color: #888; margin-top: 5px;">Redefining Modern Wear</p>
                    </div>
                    <hr style="border: 0; border-top: 1px solid #eaeaea; margin-bottom: 25px;">
                    <h2 style="font-family: 'Georgia', serif; font-size: 20px; color: #111; margin-bottom: 15px;">Welcome to the Circle! 🌟</h2>
                    <p style="font-size: 14px; line-height: 1.6; color: #444;">We're thrilled to have you with us. As a member of our inner circle, you'll be the first to receive updates on new arrivals, seasonal sales, and limited drops.</p>
                    <p style="font-size: 14px; line-height: 1.6; color: #444;">Enjoy 10% off your first purchase using the coupon code below:</p>
                    
                    <div style="background-color: #F7F5F2; border: 2px dashed #1a1a1a; padding: 15px; margin: 25px 0 15px 0; text-align: center;">
                        <span style="font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #666; display: block; margin-bottom: 5px;">Your Exclusive Code</span>
                        <strong style="font-size: 24px; letter-spacing: 4px; color: #1a1a1a;">FUSION10*</strong>
                    </div>
                    <p style="font-size: 11px; color: #888; text-align: center; margin-top: 0; margin-bottom: 25px;">*Only applicable on purchases above ₹1,500</p>
                    
                    <p style="font-size: 12px; line-height: 1.5; color: #888; margin-top: 30px; text-align: center;">If you have any questions, our AI Assistant is available 24/7 on our website.<br>© 2026 Fusion Collective. All rights reserved.</p>
                </div>
            `
        }).then(info => {
            const previewUrl = nodemailer.getTestMessageUrl(info);
            console.log(`✉️ Test email sent successfully to: ${email}`);
            if (previewUrl) {
                console.log(`🔗 Click here to preview sent message: ${previewUrl}`);
            }
        }).catch(err => {
            console.error('Background subscription email dispatch error:', err);
        });

    } catch (error) {
        console.error('Subscription Error:', error);
        res.status(500).json({ error: 'Failed to initiate newsletter subscription.' });
    }
});

app.get('/api/products', async (req, res) => {
    try { res.json(await Product.find({})); }
    catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.listen(PORT, () => { console.log(`🚀 Fusion server running at http://localhost:${PORT}`); });
