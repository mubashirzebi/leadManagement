import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || '';

const runMigration = async () => {
  try {
    if (!MONGO_URI) {
      console.error('MONGO_URI not found in environment');
      process.exit(1);
    }

    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for role migration...');

    // 1. Migrate global superadmin to platform_owner
    const superAdminRes = await User.updateMany(
      { role: 'superadmin' },
      { $set: { role: 'platform_owner' } }
    );
    console.log(`Migrated ${superAdminRes.modifiedCount} superadmin(s) -> platform_owner`);

    // 2. Migrate org admin to superadmin
    const adminRes = await User.updateMany(
      { role: 'admin' },
      { $set: { role: 'superadmin' } }
    );
    console.log(`Migrated ${adminRes.modifiedCount} admin(s) -> superadmin`);

    console.log('Role migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Role migration failed:', error);
    process.exit(1);
  }
};

runMigration();
