import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from './src/models/User';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || '';

const resetSuperAdmin = async () => {
  try {
    if (!MONGO_URI) {
      console.error('MONGO_URI not found in .env');
      process.exit(1);
    }

    const superMobile = process.env.INITIAL_SUPERADMIN_MOBILE;
    const superEmail = process.env.INITIAL_SUPERADMIN_EMAIL;
    const superPass = process.env.INITIAL_SUPERADMIN_PASSWORD;

    if (!superPass) {
      console.error('INITIAL_SUPERADMIN_PASSWORD is required');
      process.exit(1);
    }

    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for Platform Owner reset...');

    const query = superMobile
      ? { role: 'platform_owner', mobile: superMobile }
      : { role: 'platform_owner' };

    const platformOwner = await User.findOne(query);
    if (!platformOwner) {
      console.error('No matching Platform Owner found.');
      process.exit(1);
    }

    platformOwner.password = await bcrypt.hash(superPass, 10);
    platformOwner.must_change_password = false;
    platformOwner.reset_password_token_hash = null;
    platformOwner.reset_password_expires_at = null;

    if (superEmail) {
      platformOwner.email = superEmail.toLowerCase();
    }

    await platformOwner.save();

    console.log(`Platform Owner credentials updated for mobile ${platformOwner.mobile}`);
    process.exit(0);
  } catch (error) {
    console.error('Platform Owner reset failed:', error);
    process.exit(1);
  }
};

resetSuperAdmin();
