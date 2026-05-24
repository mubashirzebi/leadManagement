import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || '';

const roleArg = process.argv.find((a) => a.startsWith('--role='))?.split('=')[1];
const mobileArg = process.argv.find((a) => a.startsWith('--mobile='))?.split('=')[1];
const emailArg = process.argv.find((a) => a.startsWith('--email='))?.split('=')[1];

const allowedRoles = ['platform_owner', 'superadmin', 'admin', 'staff'] as const;
type AllowedRole = (typeof allowedRoles)[number];

const isAllowedRole = (r: string | undefined): r is AllowedRole =>
  !!r && (allowedRoles as readonly string[]).includes(r);

const run = async () => {
  try {
    if (!MONGO_URI) {
      console.error('MONGO_URI not found in environment');
      process.exit(1);
    }

    if (!isAllowedRole(roleArg)) {
      console.error(`Invalid or missing --role. Allowed: ${allowedRoles.join(', ')}`);
      process.exit(1);
    }

    if (!mobileArg && !emailArg) {
      console.error('Provide either --mobile=<number> or --email=<address>');
      process.exit(1);
    }

    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for role update...');

    const query: any = {};
    if (mobileArg) query.mobile = String(mobileArg).trim();
    if (emailArg) query.email = String(emailArg).trim().toLowerCase();

    const user = await User.findOne(query);
    if (!user) {
      console.error('No matching user found for query:', query);
      process.exit(1);
    }

    const before = { id: String(user._id), role: user.role, org: user.organization_id };

    user.role = roleArg;
    // If setting platform_owner, ensure it's global (no org linked)
    if (roleArg === 'platform_owner') {
      user.organization_id = null;
    }
    await user.save();

    const after = { id: String(user._id), role: user.role, org: user.organization_id };
    console.log('Updated user role:', { before, after });

    process.exit(0);
  } catch (err) {
    console.error('Role update failed:', err);
    process.exit(1);
  }
};

run();

