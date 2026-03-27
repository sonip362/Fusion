const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Models
const Product = require('./models/Product');
const User = require('./models/User');
const Guest = require('./models/Guest');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '6mb' }));
app.use(express.static(path.join(__dirname)));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- AUTHENTICATION ROUTES ---
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
        res.status(201).json({
            message: 'User registered successfully!',
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
                            // If exists, maybe update quantity? 
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

        // Login success
        res.json({
            message: 'Login successful!',
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
app.post('/api/user/profile-picture', async (req, res) => {
    try {
        const { email, profilePicture } = req.body || {};

        if (!email) {
            return res.status(400).json({ error: 'Email is required.' });
        }

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

        const user = await User.findOneAndUpdate(
            { email },
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
        let { email, guestId, cart, wishlist, recentlyViewed } = req.body || {};

        if (!email && !guestId) {
            return res.status(400).json({ error: 'Email or guestId is required for syncing' });
        }

        const update = {};
        if (cart !== undefined) update.cart = Array.isArray(cart) ? cart : [];
        if (wishlist !== undefined) update.wishlist = Array.isArray(wishlist) ? wishlist : [];
        if (recentlyViewed !== undefined) update.recentlyViewed = Array.isArray(recentlyViewed) ? recentlyViewed : [];

        let result;
        if (email) {
            // Priority: Registered User
            // If body is empty (just fetch request), find the user
            if (Object.keys(update).length === 0) {
                result = await User.findOne({ email }).select('-password -profilePicture');
            } else {
                result = await User.findOneAndUpdate(
                    { email },
                    update,
                    { returnDocument: 'after', upsert: false }
                ).select('-password -profilePicture');
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
        }

        if (!result) {
            if (email) return res.status(404).json({ error: 'User not found' });
            return res.status(500).json({ error: 'Sync failed' });
        }

        res.json({
            message: 'Sync successful',
            cart: result.cart || [],
            wishlist: result.wishlist || [],
            recentlyViewed: result.recentlyViewed || [],
            rewardCoins: Number(result.rewardCoins) || 0,
            chatHistory: result.chatHistory || [],
            type: email ? 'user' : 'guest'
        });
    } catch (error) {
        console.error('Sync Error:', error);
        res.status(500).json({ error: 'Internal server error during sync' });
    }
});

// Redeem Reward Coins
app.post('/api/user/redeem-coins', async (req, res) => {
    try {
        const { email, coinsToRedeem } = req.body || {};

        if (!email) {
            return res.status(400).json({ error: 'Email is required.' });
        }

        const redeemAmount = Number(coinsToRedeem);
        if (!Number.isInteger(redeemAmount) || redeemAmount < MIN_REDEEM_COINS) {
            return res.status(400).json({
                error: `Minimum redeem amount is ${MIN_REDEEM_COINS} coins.`
            });
        }

        const user = await User.findOneAndUpdate(
            { email, rewardCoins: { $gte: redeemAmount } },
            { $inc: { rewardCoins: -redeemAmount } },
            { returnDocument: 'after' }
        );

        if (!user) {
            const existingUser = await User.findOne({ email });
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

// Complete checkout reward update:
// - Redeem selected coins (optional, min 20)
// - Earn new coins based on shopping amount (₹100 = 1 coin)
app.post('/api/user/checkout-rewards', async (req, res) => {
    try {
        const { email, coinsToRedeem = 0, shoppingAmount = 0 } = req.body || {};

        if (!email) {
            return res.status(400).json({ error: 'Email is required.' });
        }

        const redeemAmount = Math.max(0, Math.floor(Number(coinsToRedeem) || 0));
        if (redeemAmount > 0 && redeemAmount < MIN_REDEEM_COINS) {
            return res.status(400).json({
                error: `Minimum redeem amount is ${MIN_REDEEM_COINS} coins.`
            });
        }

        const normalizedShoppingAmount = Math.max(0, Number(shoppingAmount) || 0);
        const earnedCoins = Math.floor(normalizedShoppingAmount / COIN_EARN_RATE_RUPEES);

        const user = await User.findOne({ email });
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
app.post('/api/user/download-data', async (req, res) => {
    try {
        const { email } = req.body || {};
        if (!email) return res.status(400).json({ error: 'Email is required.' });

        const user = await User.findOne({ email }).select('-password');
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
app.post('/api/user/delete', async (req, res) => {
    try {
        const { email } = req.body || {};
        if (!email) return res.status(400).json({ error: 'Email is required.' });

        const result = await User.deleteOne({ email });
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
        const { message, history = [], email, guestId } = req.body;
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
            if (email || guestId) {
                const newMessages = [
                    { role: 'user', content: normalizedMessage, timestamp: new Date() },
                    { role: 'assistant', content: aiMessage, timestamp: new Date() }
                ];

                if (email) {
                    await User.findOneAndUpdate(
                        { email },
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

app.get('/api/products', async (req, res) => {
    try { res.json(await Product.find({})); }
    catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.listen(PORT, () => { console.log(`🚀 Fusion server running at http://localhost:${PORT}`); });
