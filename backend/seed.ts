import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organization from './src/models/Organization';
import User from './src/models/User';
import Lead from './src/models/Lead';
import ActivityLog from './src/models/ActivityLog';
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

    // 1. Setup SuperAdmin from .env
    const superMobile = process.env.INITIAL_SUPERADMIN_MOBILE;
    const superPass = process.env.INITIAL_SUPERADMIN_PASSWORD;

    if (superMobile && superPass) {
        const existingSuper = await User.findOne({ mobile: superMobile });
        if (!existingSuper) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(superPass, salt);
            await User.create({
                name: 'Platform Owner',
                mobile: superMobile,
                password: hashedPassword,
                role: 'superadmin',
                organization_id: null,
                must_change_password: false
            });
            console.log(`✅ SuperAdmin created: ${superMobile}`);
        } else {
            console.log('ℹ️ SuperAdmin already exists. Skipping creation.');
        }
    } else {
        console.warn('⚠️ INITIAL_SUPERADMIN_MOBILE/PASSWORD not found in .env. Skipping SuperAdmin setup.');
    }

    // 2. Setup Sample Agency (Only if it doesn't exist)
    let org = await Organization.findOne({ name: 'Skyline Realty' });
    if (!org) {
        org = await Organization.create({
            name: 'Skyline Realty',
            status: 'active'
        });
        console.log('✅ Sample Organization created.');
    }

    // 3. Setup Sample Agency Admin
    const adminMobile = '9999999999';
    const existingAdmin = await User.findOne({ mobile: adminMobile });
    if (!existingAdmin) {
        const salt = await bcrypt.genSalt(10);
        const adminPass = await bcrypt.hash('admin123', salt);
        await User.create({
            name: 'Agency Admin',
            mobile: adminMobile,
            password: adminPass,
            role: 'admin',
            organization_id: org._id,
            must_change_password: false
        });
        console.log('✅ Sample Agency Admin created.');
    }

    console.log('Seeding process finished! 🚀');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seed();
