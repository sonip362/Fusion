const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Models
const Product = require('../models/Product');

async function migrate() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB Atlas');

        // Load data from JSON
        const productsData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'products.json'), 'utf8'));
        console.log(`📦 Found ${productsData.length} products to migrate. Processing...`);

        for (const item of productsData) {
            // Check if product already exists to avoid duplicates
            const existing = await Product.findOne({ id: item.id });
            if (!existing) {
                await Product.create(item);
                console.log(`✅ Migrated: ${item.name}`);
            } else {
                console.log(`ℹ️ Skipped (already exists): ${item.name}`);
            }
        }

        console.log('\n🌟 Migration Complete!');
        process.exit(0);

    } catch (err) {
        console.error('❌ Migration Failed:', err);
        process.exit(1);
    }
}

migrate();
