import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organization from './src/models/Organization';
import User from './src/models/User';
import bcrypt from 'bcryptjs';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || '';

const seed = async () => {
  try {
    if (!MONGO_URI) {
        console.error('MONGO_URI not found in .env');
        process.exit(1);
    }

    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for seeding...');

    // 1. Setup Sample Agency (Only if it doesn't exist)
    let org = await Organization.findOne({ name: 'Skyline Realty' });
    if (!org) {
        org = await Organization.create({
            name: 'Skyline Realty',
            status: 'active'
        });
        console.log('✅ Sample Organization created.');
    }

    // 2. Setup Sample Agency SuperAdmin
    const adminMobile = '9999999999';
    const existingAdmin = await User.findOne({ mobile: adminMobile });
    if (!existingAdmin) {
        const salt = await bcrypt.genSalt(10);
        const adminPass = await bcrypt.hash('admin123', salt);
        await User.create({
            name: 'Agency SuperAdmin',
            mobile: adminMobile,
            password: adminPass,
            role: 'superadmin',
            organization_id: org._id,
            must_change_password: false
        });
        console.log('✅ Sample Agency SuperAdmin created.');
    }

    console.log('Sample seed finished successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seed();
