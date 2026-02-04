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

        // Call Groq API
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
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

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Fusion server running at http://localhost:${PORT}`);
    console.log(`📦 API endpoint: http://localhost:${PORT}/api/chat`);
});
