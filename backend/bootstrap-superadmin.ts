import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from './src/models/User';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || '';

const bootstrapSuperAdmin = async () => {
  try {
    if (!MONGO_URI) {
      console.error('MONGO_URI not found in .env');
      process.exit(1);
    }

    const superMobile = process.env.INITIAL_SUPERADMIN_MOBILE;
    const superEmail = process.env.INITIAL_SUPERADMIN_EMAIL;
    const superPass = process.env.INITIAL_SUPERADMIN_PASSWORD;

    if (!superMobile || !superEmail || !superPass) {
      console.error('INITIAL_SUPERADMIN_MOBILE, INITIAL_SUPERADMIN_EMAIL, and INITIAL_SUPERADMIN_PASSWORD are required');
      process.exit(1);
    }

    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for Platform Owner bootstrap...');

    const existingPlatformOwner = await User.findOne({ role: 'platform_owner' });
    if (existingPlatformOwner) {
      console.error('A Platform Owner already exists. Bootstrap can only be run once.');
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(superPass, 10);

    await User.create({
      name: 'Platform Owner',
      email: superEmail.toLowerCase(),
      mobile: superMobile,
      password: hashedPassword,
      role: 'platform_owner',
      organization_id: null,
      must_change_password: false
    });

    console.log(`Platform Owner created successfully for mobile ${superMobile}`);
    process.exit(0);
  } catch (error) {
    console.error('Platform Owner bootstrap failed:', error);
    process.exit(1);
  }
};

bootstrapSuperAdmin();
