const mongoose = require('mongoose');

const guestSchema = new mongoose.Schema({
  guestId: { type: String, required: true, unique: true },
  cart: [{
    id: String,
    name: String,
    price: String,
    imageUrl: String,
    category: String,
    quantity: { type: Number, default: 1 }
  }],
  wishlist: [{
    id: String,
    name: String,
    price: String,
    imageUrl: String,
    category: String
  }],
  recentlyViewed: [{
    id: String,
    name: String,
    price: String,
    imageUrl: String,
    category: String,
    timestamp: { type: Date, default: Date.now }
  }],
  chatHistory: [{
    role: String,
    content: String,
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Auto-delete guest session after 30 days of inactivity
guestSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('Guest', guestSchema);
