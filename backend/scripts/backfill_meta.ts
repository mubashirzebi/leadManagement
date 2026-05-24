import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

import Lead from '../src/models/Lead';
import Organization from '../src/models/Organization';

async function backfillMetaLeads() {
  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGO_URI as string);
  console.log('Connected.');

  const leads = await Lead.find({
    source: 'Meta Ads',
    facebook_lead_id: { $ne: null },
    facebook_page_name: { $eq: null }
  });

  console.log(`Found ${leads.length} leads to backfill.`);

  for (const lead of leads) {
    console.log(`\nProcessing Lead: ${lead.name} (${lead.facebook_lead_id})`);
    
    const org = await Organization.findById(lead.organization_id);
    if (!org || !org.meta_config || !org.meta_config.pages || org.meta_config.pages.length === 0) {
      console.log('  -> Skipping: Organization has no Meta config pages.');
      continue;
    }

    let leadData: any = null;
    let workingToken: string | null = null;

    // Try to fetch lead details with any of the page tokens
    for (const page of org.meta_config.pages) {
      try {
        const res = await fetch(`https://graph.facebook.com/v20.0/${lead.facebook_lead_id}?fields=id,created_time,form_id,ad_id,field_data&access_token=${page.access_token}`);
        const data = await res.json() as any;
        if (!data.error && data.id) {
          leadData = data;
          workingToken = page.access_token;
          break;
        }
      } catch (e) {
        // ignore and try next token
      }
    }

    if (!leadData) {
      console.log('  -> Failed to fetch lead data from Meta (tokens might be expired or lead deleted).');
      continue;
    }

    const formId = leadData.form_id || leadData.ad_id; // Sometimes ad_id is used if form_id isn't directly exposed depending on permissions, but form_id is standard.
    if (!formId && !leadData.form_id) {
       console.log('  -> No form_id found in lead data:', leadData);
       continue;
    }

    try {
      let formData: any = null;

      for (const page of org.meta_config.pages) {
        const formRes = await fetch(`https://graph.facebook.com/v20.0/${formId}?fields=name,page&access_token=${page.access_token}`);
        const data = await formRes.json() as any;
        if (!data.error && data.name) {
          formData = data;
          break;
        }
      }

      if (formData) {
        const formName = formData.name || 'Unknown Form';
        const pageName = formData.page?.name || 'Unknown Page';

        lead.facebook_form_name = formName;
        lead.facebook_page_name = pageName;
        await lead.save();

        console.log(`  -> ✅ Updated! Page: ${pageName}, Form: ${formName}`);
      } else {
        console.log('  -> Failed to fetch form data with any token.');
      }
    } catch (e: any) {
      console.log('  -> Error fetching form data:', e.message);
    }
  }

  console.log('\nBackfill complete.');
  process.exit(0);
}

backfillMetaLeads().catch(console.error);
