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

  const pageId = org.meta_config.page_id;
  const token = org.meta_config.access_token;

  console.log(`Checking Facebook subscriptions for Page: ${pageId}...`);
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${pageId}/subscribed_apps?access_token=${token}`);
    const data = await res.json() as any;
    console.log('Subscribed Apps Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error fetching subscribed apps:', err);
  }
  process.exit(0);
}
run();
