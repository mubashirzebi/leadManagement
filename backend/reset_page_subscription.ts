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

  console.log(`[Queue Reset] Resetting subscription for Page: ${pageId}...`);

  try {
    // 1. DELETE existing subscription to clear the delivery queue
    console.log('1. Deleting subscription...');
    const delRes = await fetch(`https://graph.facebook.com/v20.0/${pageId}/subscribed_apps?access_token=${token}`, {
      method: 'DELETE'
    });
    const delData = await delRes.json() as any;
    console.log('Delete Response:', JSON.stringify(delData, null, 2));

    // Wait 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 2. Re-create the subscription
    console.log('2. Re-subscribing app to Page webhooks...');
    const subRes = await fetch(
      `https://graph.facebook.com/v20.0/${pageId}/subscribed_apps?subscribed_fields=leadgen&access_token=${token}`,
      { method: 'POST' }
    );
    const subData = await subRes.json() as any;
    console.log('Subscribe Response:', JSON.stringify(subData, null, 2));

  } catch (err) {
    console.error('Error resetting subscription:', err);
  }

  process.exit(0);
}
run();
