import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Organization from '../models/Organization';
import Lead from '../models/Lead';
import { AuthRequest } from '../middleware/auth';

export const handleIncomingWebhook = async (req: AuthRequest, res: Response) => {
  try {
    const orgIdFromKey = req.query.key as string | undefined;
    const orgToken = req.query.token as string | undefined;
    const orgIdFromAuth = req.user?.organization_id ?? undefined;

    let org = null as any;
    if (orgIdFromKey) {
      if (!mongoose.Types.ObjectId.isValid(orgIdFromKey)) {
        return res.status(400).json({ success: false, message: 'Invalid organization key' });
      }
      org = await Organization.findById(orgIdFromKey);
    } else if (orgToken) {
      org = await Organization.findOne({ webhook_token: orgToken });
    } else if (orgIdFromAuth) {
      if (!mongoose.Types.ObjectId.isValid(orgIdFromAuth)) {
        return res.status(400).json({ success: false, message: 'Invalid organization in token' });
      }
      org = await Organization.findById(orgIdFromAuth);
    } else {
      return res.status(400).json({ success: false, message: 'Missing org selector (key, token, or auth)' });
    }

    if (!org || org.status !== 'active') return res.status(400).json({ success: false, message: 'Org invalid' });

    const { name, mobile, source, project } = req.body;
    const newLead = await Lead.create({
      organization_id: org._id,
      name,
      mobile,
      source: source || 'Webhook',
      project,
      status: 'New'
    });
    res.status(201).json({ success: true, data: newLead });
  } catch (e) { res.status(500).send(); }
};

// ─── Meta (Facebook/Instagram) Webhooks ──────────────────────────────────────

export const verifyMetaWebhook = (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    console.log('[Meta Webhook] Verified');
    return res.status(200).send(challenge);
  }
  res.status(403).send('Forbidden');
};

export const handleMetaLead = async (req: Request, res: Response) => {
  try {
    const { object, entry } = req.body;
    if (object !== 'page') return res.sendStatus(200);

    for (const item of entry) {
      const changes = item.changes;
      for (const change of changes) {
        if (change.field !== 'leadgen') continue;

        const { leadgen_id, page_id } = change.value;
        console.log(`[Meta Webhook] New Lead! ID: ${leadgen_id}, Page: ${page_id}`);

        // 1. Find the Firm that owns this Page ID
        const org = await Organization.findOne({ 'meta_config.page_id': page_id });
        if (!org || org.status !== 'active' || !org.meta_config.access_token) {
          console.warn(`[Meta Webhook] No active firm found for Page ID ${page_id}`);
          continue;
        }

        // 2. Fetch Lead Details from Meta Graph API
        const metaRes = await fetch(`https://graph.facebook.com/v20.0/${leadgen_id}?access_token=${org.meta_config.access_token}`);
        const metaData = await metaRes.json() as any;

        if (!metaData || metaData.error) {
          console.error('[Meta Webhook] Error fetching lead details:', metaData?.error);
          continue;
        }

        // 3. Extract Name/Mobile from Meta Field Data
        const fieldData = metaData.field_data || [];
        const getName = () => fieldData.find((f: any) => f.name === 'full_name' || f.name === 'name')?.values[0] || 'Meta Lead';
        const getPhone = () => fieldData.find((f: any) => f.name === 'phone_number' || f.name === 'phone')?.values[0] || '0000000000';

        // 4. Create Lead in DB
        await Lead.create({
          organization_id: org._id,
          name: getName(),
          mobile: getPhone(),
          source: 'Meta Ads',
          status: 'New',
          temperature: 'Warm'
        });
        console.log(`[Meta Webhook] Successfully captured lead: ${getName()}`);
      }
    }
    res.sendStatus(200);
  } catch (error) {
    console.error('[Meta Webhook Error]:', error);
    res.sendStatus(200); // Always return 200 to Meta to avoid retry loops
  }
};

// ─── Google Ads (Search/Discovery/YouTube) Webhooks ──────────────────────────

export const handleGoogleLead = async (req: Request, res: Response) => {
  try {
    const { lead_id, user_column_data, google_key } = req.body;

    if (!google_key) return res.status(400).send('Missing key');

    // 1. Find the Firm that owns this Google Key
    const org = await Organization.findOne({ google_key });
    if (!org || org.status !== 'active') {
      console.warn(`[Google Webhook] No active firm found for Key: ${google_key}`);
      return res.status(400).send('Invalid key');
    }

    // 2. Parse Column Data
    const fieldData = user_column_data || [];
    const extract = (id: string) => fieldData.find((f: any) => f.column_id === id)?.string_value;

    const name = extract('FULL_NAME') || extract('FIRST_NAME') || 'Google Lead';
    const mobile = extract('PHONE_NUMBER') || '0000000000';
    const email = extract('USER_EMAIL');

    // 3. Create Lead
    await Lead.create({
      organization_id: org._id,
      name,
      mobile,
      email,
      source: 'Google Ads',
      status: 'New',
      temperature: 'Warm'
    });

    console.log(`[Google Webhook] Captured lead from Google: ${name}`);
    res.status(200).send('Success');
  } catch (error) {
    console.error('[Google Webhook Error]:', error);
    res.status(500).send('Internal Error');
  }
};
