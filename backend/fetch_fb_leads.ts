import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organization from './src/models/Organization';
import Lead from './src/models/Lead';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI as string);

  const org = await Organization.findOne({ 'meta_config.page_id': '1022526174288310' });
  if (!org) {
    console.error('Org not found!');
    process.exit(1);
  }

  const pageId = org.meta_config.page_id;
  const token = org.meta_config.access_token;

  console.log(`\n=== Fetching Lead Forms for Page: ${pageId} ===\n`);

  // Step 1: Get all lead forms for this page
  const formsRes = await fetch(
    `https://graph.facebook.com/v20.0/${pageId}/leadgen_forms?access_token=${token}&fields=id,name,status`
  );
  const formsData = await formsRes.json() as any;

  if (formsData.error) {
    console.error('Error fetching forms:', formsData.error);
    process.exit(1);
  }

  console.log(`Found ${formsData.data?.length || 0} forms:\n`);
  for (const form of formsData.data || []) {
    console.log(`  Form ID: ${form.id}, Name: "${form.name}", Status: ${form.status}`);
  }

  // Step 2: For each form, fetch all leads
  let totalImported = 0;
  let totalSkipped = 0;

  for (const form of formsData.data || []) {
    console.log(`\n--- Fetching leads from form: "${form.name}" (${form.id}) ---`);

    let url: string | null = `https://graph.facebook.com/v20.0/${form.id}/leads?access_token=${token}&fields=id,created_time,field_data`;
    let pageNum = 1;

    while (url) {
      const leadsRes = await fetch(url);
      const leadsData = await leadsRes.json() as any;

      if (leadsData.error) {
        console.error(`Error fetching leads from form ${form.id}:`, leadsData.error);
        break;
      }

      const leads = leadsData.data || [];
      console.log(`  Page ${pageNum}: ${leads.length} leads`);

      for (const lead of leads) {
        const fieldData = lead.field_data || [];
        const getName = () =>
          fieldData.find((f: any) => f.name === 'full_name' || f.name === 'name')?.values?.[0] || 'FB Lead';
        const getPhone = () =>
          fieldData.find((f: any) => f.name === 'phone_number' || f.name === 'phone')?.values?.[0] || '';
        const getEmail = () =>
          fieldData.find((f: any) => f.name === 'email')?.values?.[0] || '';

        const name = getName();
        const mobile = getPhone();
        const email = getEmail();

        // Skip leads without a phone number
        if (!mobile) {
          console.log(`    ⚠ Skipping "${name}" — no phone number`);
          totalSkipped++;
          continue;
        }

        // Check if this exact leadgen ID has already been imported
        const existsById = await Lead.findOne({
          organization_id: org._id,
          facebook_lead_id: lead.id
        });

        if (existsById) {
          console.log(`    ⏭ Already Imported: "${name}" (${mobile}) — skipping duplicate fetch`);
          continue;
        }

        // Check for duplicates (same mobile + org)
        const existing = await Lead.findOne({
          organization_id: org._id,
          mobile: mobile
        });
        const isDuplicate = !!existing;

        // Create the lead
        await Lead.create({
          organization_id: org._id,
          name,
          mobile,
          email: email || undefined,
          source: 'Meta Ads',
          status: 'New',
          temperature: 'Warm',
          duplicateFlag: isDuplicate,
          facebook_lead_id: lead.id
        });
        console.log(`    ✅ Imported${isDuplicate ? ' (DUPLICATE)' : ''}: "${name}" (${mobile})`);
        totalImported++;
      }

      // Check for pagination
      url = leadsData.paging?.next || null;
      pageNum++;
    }
  }

  console.log(`\n========================================`);
  console.log(`  Total Imported: ${totalImported}`);
  console.log(`  Total Skipped:  ${totalSkipped}`);
  console.log(`========================================\n`);

  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
