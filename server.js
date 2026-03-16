const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Load Product Data
let products = [];
try {
    const productsData = fs.readFileSync(path.join(__dirname, 'assets', 'products.json'), 'utf8');
    products = JSON.parse(productsData);
} catch (error) {
    console.error('Error loading products.json:', error);
}

// Generate Product Context String
const productContext = products.map(p =>
    `- ${p.name} (${p.collection}): ${p.price}, ${p.category}. ${p.description}`
).join('\n');

// Fusion brand context for the AI
const FUSION_CONTEXT = `You are the Fusion Website AI Assistant.
Rules:
- You answer ONLY questions about the Fusion website, its collections, products, policies (shipping, returns, sizing), and features.
- You must REFUSE to answer general fashion questions, celebrity style, weather, or anything unrelated to the Fusion website.
- If asked about something off-topic, say: "I can only help you with questions about the Fusion website, our collections, and policies."

Key information about Fusion:
- Collections: Daily Wear, Everywhere Choice, Modern Metro, Urban Edge, Sun & Shade, Weekend Vibe
- Products currently available:
${productContext}

- Sizing: Each product page has a detailed size guide. If between sizes, choose the larger size for a relaxed fit.
- Returns: 14-day return policy for unworn, unwashed items in original packaging.
- Shipping: Domestic 3-5 business days, International 7-14 business days. We ship worldwide.
- Tracking: Tracking info sent via email upon dispatch.
- Contact: info@fusion.com, +91 (000) 000-0000.

Tone: Helpful, specific, and focused on the website. Use emojis sparingly.
Keep answers under 75 words.
`;

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history = [] } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({ error: 'API key not configured' });
        }

        // Build messages array with context and history
        const messages = [
            { role: 'system', content: FUSION_CONTEXT },
            ...history.slice(-10), // Keep last 10 messages for context
            { role: 'user', content: message }
        ];

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: messages,
                max_tokens: 500,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Groq API Error:', errorData);
            return res.status(response.status).json({
                error: 'Failed to get response from AI',
                details: errorData
            });
        }

        const data = await response.json();
        const aiMessage = data.choices[0]?.message?.content || 'Sorry, I couldn\'t generate a response.';

        res.json({
            message: aiMessage,
            model: data.model
        });

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Complete the Look Endpoint
app.post('/api/complete-look', async (req, res) => {
    try {
        const { product } = req.body;

        if (!product) {
            return res.status(400).json({ error: 'Product is required' });
        }

        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({ error: 'API key not configured' });
        }

        // Filter out the current product from available options
        const otherProducts = products.filter(p => p.id !== product.id);

        // Create a concise list of available products for the AI
        const inventoryString = otherProducts.map(p =>
            `ID: ${p.id}, Name: ${p.name}, Category: ${p.category}, Collection: ${p.collection}, Description: ${p.description}`
        ).join('\n');

        const prompt = `
            You are a fashion stylist for Fusion. 
            The user is viewing this product:
            Name: ${product.name}
            Category: ${product.category}
            Collection: ${product.collection}
            Description: ${product.description}
            
            From the following list of available products, select exactly 2 complementary products to complete the outfit (e.g., if it's a Top, find Bottoms or Accessories; if it's Bottoms, find a Top).
            Prioritize items from the same collection ("${product.collection}").Always when searching for product if its Men pair with a men's product and women pair with a women's product.
            
            Available Products:
            ${inventoryString}
            
            Return ONLY a valid JSON array of the 2 selected product IDs. Do not add any explanation or markdown. 
            Example output: ["p2", "p5"]
        `;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'system', content: 'You are a helpful JSON-only API assistant.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 100,
                temperature: 0.2
            })
        });

        if (!response.ok) {
            throw new Error('Groq API failed');
        }

        const data = await response.json();
        let content = data.choices[0]?.message?.content || '[]';

        // Clean the response in case it has markdown code blocks
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();

        let recommendedIds = [];
        try {
            recommendedIds = JSON.parse(content);
        } catch (e) {
            console.error('Failed to parse AI response:', content);
            // Fallback: pick random items from same collection
            recommendedIds = otherProducts
                .filter(p => p.collection === product.collection)
                .slice(0, 2)
                .map(p => p.id);
        }

        // Retrieve full product details
        const recommendations = products.filter(p => recommendedIds.includes(p.id));

        res.json({ recommendations });

    } catch (error) {
        console.error('Complete Look Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Fusion server running at http://localhost:${PORT}`);
    console.log(`📦 API endpoint: http://localhost:${PORT}/api/chat`);
});
