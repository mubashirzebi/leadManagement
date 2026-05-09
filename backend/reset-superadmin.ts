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
    console.log('Connected to MongoDB for SuperAdmin reset...');

    const query = superMobile
      ? { role: 'superadmin', mobile: superMobile }
      : { role: 'superadmin' };

    const superAdmin = await User.findOne(query);
    if (!superAdmin) {
      console.error('No matching SuperAdmin found.');
      process.exit(1);
    }

    superAdmin.password = await bcrypt.hash(superPass, 10);
    superAdmin.must_change_password = false;
    superAdmin.reset_password_token_hash = null;
    superAdmin.reset_password_expires_at = null;

    if (superEmail) {
      superAdmin.email = superEmail.toLowerCase();
    }

    await superAdmin.save();

    console.log(`SuperAdmin credentials updated for mobile ${superAdmin.mobile}`);
    process.exit(0);
  } catch (error) {
    console.error('SuperAdmin reset failed:', error);
    process.exit(1);
  }
};

resetSuperAdmin();
