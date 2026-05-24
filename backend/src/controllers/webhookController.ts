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
    const exists = await Lead.findOne({ organization_id: org._id, mobile });
    const isDuplicate = !!exists;
    const newLead = await Lead.create({
      organization_id: org._id,
      name,
      mobile,
      source: source || 'Webhook',
      project,
      status: 'NEW',
      duplicateFlag: isDuplicate
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

        // 1. Find the Firm that owns this Page ID and ensure the page is active
        let org = await Organization.findOne({ 
          'meta_config.pages': {
            $elemMatch: { page_id: page_id, is_active: true }
          }
        });

        if (!org && (page_id === '0' || page_id === '444444444444' || !page_id)) {
          // Fallback for Meta Dashboard Webhook Test (which sends page_id = '0' or '444444444444')
          org = await Organization.findOne({ 
            status: 'active', 
            'meta_config.pages': {
              $elemMatch: { is_active: true }
            }
          });
          if (org) {
            console.log(`[Meta Webhook Test] Falling back to active org: ${org.name}`);
          }
        }

        if (!org || org.status !== 'active' || !org.meta_config.pages || org.meta_config.pages.length === 0) {
          console.warn(`[Meta Webhook] No active firm found with active Page ID ${page_id}`);
          continue;
        }

        // 2. Fetch Lead Details from Meta Graph API
        let metaData: any;
        let formName = 'Unknown Form';
        const pageConfig = org.meta_config.pages.find((p: any) => p.page_id === page_id || (p.is_active && (page_id === '0' || page_id === '444444444444')));
        
        // Skip webhook processing if page is explicitly marked inactive
        if (pageConfig && pageConfig.is_active === false) {
          console.warn(`[Meta Webhook] Page ${page_id} is inactive. Skipping webhook.`);
          continue;
        }

        const accessToken = pageConfig?.access_token || org.meta_config.pages.find((p: any) => p.is_active)?.access_token;
        const pageName = pageConfig?.page_name || 'Unknown Page';

        if (leadgen_id === '444444444444' || !leadgen_id) {
          // Mock details for Meta Test Payload
          metaData = {
            field_data: [
              { name: 'full_name', values: ['Meta Test Lead'] },
              { name: 'phone_number', values: ['+16505551234'] }
            ]
          };
          formName = 'Test Form';
          console.log('[Meta Webhook Test] Using mock lead details for test lead ID 444444444444');
        } else {
          const metaRes = await fetch(`https://graph.facebook.com/v20.0/${leadgen_id}?access_token=${accessToken}`);
          metaData = await metaRes.json() as any;

          // Fetch Form Name if we have the form_id
          const formId = change.value.form_id;
          if (formId) {
            try {
              const formRes = await fetch(`https://graph.facebook.com/v20.0/${formId}?fields=name&access_token=${accessToken}`);
              const formData = await formRes.json() as any;
              if (formData && formData.name) {
                formName = formData.name;
              }
            } catch (err) {
              console.warn(`[Meta Webhook] Failed to fetch form name for form ID ${formId}`);
            }
          }
        }

        if (!metaData || metaData.error) {
          console.error('[Meta Webhook] Error fetching lead details:', metaData?.error);
          continue;
        }

        // 3. Extract Name/Mobile from Meta Field Data
        const fieldData = metaData.field_data || [];
        const getName = () => fieldData.find((f: any) => f.name === 'full_name' || f.name === 'name')?.values[0] || 'Meta Lead';
        const getPhone = () => fieldData.find((f: any) => f.name === 'phone_number' || f.name === 'phone')?.values[0] || '0000000000';

        const customData: Record<string, string> = {};
        fieldData.forEach((f: any) => {
          if (f.name && f.values && f.values.length > 0) {
            customData[f.name] = f.values[0];
          }
        });

        // 4. Skip if this EXACT Facebook Lead ID has already been imported
        const existsById = await Lead.findOne({ organization_id: org._id, facebook_lead_id: leadgen_id });
        if (existsById) {
          console.log(`[Meta Webhook] Lead ID ${leadgen_id} already imported. Skipping.`);
          continue;
        }

        // 5. Detect duplicate applications (same phone number)
        const exists = await Lead.findOne({ organization_id: org._id, mobile: getPhone() });
        const isDuplicate = !!exists;

        // 6. Create Lead in DB
        await Lead.create({
          organization_id: org._id,
          name: getName(),
          mobile: getPhone(),
          source: 'Meta Ads',
          status: 'NEW',
          heat: 'WARM',
          duplicateFlag: isDuplicate,
          facebook_lead_id: leadgen_id,
          facebook_page_name: pageName,
          facebook_form_name: formName,
          custom_data: customData
        });
        console.log(`[Meta Webhook] Successfully captured lead: ${getName()} (from ${pageName} / ${formName})`);
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

    const customData: Record<string, string> = {};
    fieldData.forEach((f: any) => {
      if (f.column_id && f.string_value) {
        customData[f.column_id] = f.string_value;
      }
    });

    // 3. Check for duplicate
    const exists = await Lead.findOne({ organization_id: org._id, mobile });
    const isDuplicate = !!exists;

    // 4. Create Lead
    await Lead.create({
      organization_id: org._id,
      name,
      mobile,
      email,
      source: 'Google Ads',
      status: 'NEW',
      heat: 'WARM',
      duplicateFlag: isDuplicate,
      custom_data: customData
    });

    console.log(`[Google Webhook] Captured lead from Google: ${name}`);
    res.status(200).send('Success');
  } catch (error) {
    console.error('[Google Webhook Error]:', error);
    res.status(500).send('Internal Error');
  }
};
