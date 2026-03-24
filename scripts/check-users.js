const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

async function checkUsers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        const users = await User.find({}, { password: 0 }); // Don't show passwords
        console.log('--- Current Users in DB ---');
        console.log(users);
        console.log('---------------------------');
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}

checkUsers();
