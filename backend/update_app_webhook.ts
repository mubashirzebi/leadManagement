import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const newUrl = process.argv[2];
  if (!newUrl) {
    console.error('Error: Please provide your new Tunnelmole URL. Example:');
    console.error('npx ts-node update_app_webhook.ts https://xxxx.tunnelmole.net');
    process.exit(1);
  }

  // Clean the URL to make sure it includes the full webhook endpoint path
  let callbackUrl = newUrl.trim();
  if (!callbackUrl.startsWith('http')) {
    callbackUrl = 'https://' + callbackUrl;
  }
  if (!callbackUrl.endsWith('/api/webhooks/meta')) {
    // If it is just the domain, append the path
    callbackUrl = callbackUrl.replace(/\/$/, '') + '/api/webhooks/meta';
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const verifyToken = process.env.META_VERIFY_TOKEN;
  const appToken = `${appId}|${appSecret}`;

  console.log(`Updating Meta App Webhook Subscription...`);
  console.log(`App ID: ${appId}`);
  console.log(`New Callback URL: ${callbackUrl}`);
  console.log(`Verify Token: ${verifyToken}`);

  try {
    const params = new URLSearchParams({
      object: 'page',
      callback_url: callbackUrl,
      fields: 'leadgen',
      verify_token: verifyToken as string,
      access_token: appToken
    });

    const res = await fetch(`https://graph.facebook.com/v20.0/${appId}/subscriptions`, {
      method: 'POST',
      body: params
    });

    const data = await res.json() as any;
    console.log('Update Response:', JSON.stringify(data, null, 2));

    if (data.success) {
      console.log('Successfully updated Facebook App Webhook to your new tunnel!');
    } else {
      console.error('Failed to update subscription.');
    }
  } catch (err) {
    console.error('Error updating subscription:', err);
  }
  process.exit(0);
}
run();
