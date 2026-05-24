import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organization from './src/models/Organization';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI as string);
  const org = await Organization.findOne({ 'meta_config.page_id': '1022526174288310' });
  if (!org) {
    console.error('Org not found in DB!');
    process.exit(1);
  }

  const token = org.meta_config.access_token;
  console.log('Debugging Page Access Token...');
  try {
    const res = await fetch(`https://graph.facebook.com/debug_token?input_token=${token}&access_token=${token}`);
    const data = await res.json() as any;
    console.log('Token Debug Info:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error debugging token:', err);
  }
  process.exit(0);
}
run();
