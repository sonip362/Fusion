const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // Sync with existing JSON ID (e.g., 'p1')
  collectionName: { type: String, required: true },
  name: { type: String, required: true },
  price: String,
  originalPrice: String,
  imageUrl: String,
  category: String,
  description: String,
  categoryId: {
    material: String,
    priceRange: String,
    features: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
