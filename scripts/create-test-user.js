const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const User = require('../models/User');

async function createTestUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        const email = 'test@example.com';
        const password = 'password123';
        
        const existing = await User.findOne({ email });
        if (existing) {
            console.log('User already exists');
            process.exit(0);
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            fullName: 'Test User',
            email,
            password: hashedPassword
        });
        
        await newUser.save();
        console.log('✅ Test User created successfully');
        console.log('Email:', email);
        console.log('Password:', password);
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}

createTestUser();
