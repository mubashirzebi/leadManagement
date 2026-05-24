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
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  console.log(`Checking Webhook Subscriptions for App ID: ${appId}...`);
  try {
    // Query the app subscriptions using App Access Token (appId|appSecret)
    const appToken = `${appId}|${appSecret}`;
    const res = await fetch(`https://graph.facebook.com/v20.0/${appId}/subscriptions?access_token=${appToken}`);
    const data = await res.json() as any;
    console.log('App Subscriptions:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error fetching app subscriptions:', err);
  }
  process.exit(0);
}
run();
