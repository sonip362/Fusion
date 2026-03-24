const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // We'll add hashing later for security
  profilePicture: { type: String, default: '' },
  role: { type: String, default: 'customer' }, // To differentiate between users and admins
  rewardCoins: { type: Number, default: 0 },
  hasReceivedLoginBonus: { type: Boolean, default: false },
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

module.exports = mongoose.model('User', userSchema);
