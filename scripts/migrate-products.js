const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const Product = require('../models/Product');

const parseArgs = () => {
  const args = new Set(process.argv.slice(2));
  return {
    dryRun: args.has('--dry-run'),
    skipExisting: args.has('--skip-existing')
  };
};

const normalizeProduct = (item) => {
  const collection = typeof item.collection === 'string' ? item.collection.trim() : '';
  const collectionName = typeof item.collectionName === 'string' ? item.collectionName.trim() : '';

  return {
    id: String(item.id || '').trim(),
    collection: collection || collectionName,
    collectionName: collectionName || collection,
    name: typeof item.name === 'string' ? item.name.trim() : item.name,
    price: item.price,
    originalPrice: item.originalPrice,
    imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl.trim() : item.imageUrl,
    category: item.category,
    description: item.description,
    categoryId: item.categoryId || {}
  };
};

async function migrate() {
  const { dryRun, skipExisting } = parseArgs();

  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is missing. Add it to .env before running this script.');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const productsPath = path.join(__dirname, '..', 'assets', 'products.json');
    const productsData = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
    console.log(`Found ${productsData.length} products in assets/products.json`);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of productsData) {
      const normalized = normalizeProduct(item);

      if (!normalized.id) {
        console.log('Skipped product with missing id');
        skipped += 1;
        continue;
      }

      const existing = await Product.findOne({ id: normalized.id }).select('_id id').lean();

      if (existing && skipExisting) {
        console.log(`Skipped (already exists): ${normalized.id}`);
        skipped += 1;
        continue;
      }

      if (dryRun) {
        console.log(`${existing ? 'Would update' : 'Would insert'}: ${normalized.id} (${normalized.name || 'Unnamed'})`);
        continue;
      }

      await Product.updateOne(
        { id: normalized.id },
        { $set: normalized },
        { upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );

      if (existing) {
        updated += 1;
        console.log(`Updated: ${normalized.id} (${normalized.name || 'Unnamed'})`);
      } else {
        inserted += 1;
        console.log(`Inserted: ${normalized.id} (${normalized.name || 'Unnamed'})`);
      }
    }

    if (dryRun) {
      console.log('\nDry run complete (no DB writes).');
    } else {
      console.log(`\nMigration complete. Inserted: ${inserted}, Updated: ${updated}, Skipped: ${skipped}`);
    }
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    try {
      await mongoose.disconnect();
    } catch (e) {
      // ignore
    }
  }
}

migrate();
