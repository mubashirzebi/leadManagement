import Organization from '../models/Organization';
import Lead from '../models/Lead';
import cron from 'node-cron';

/**
 * Fetches new leads from Facebook Graph API for a single organization.
 * Iterates through all connected pages in org.meta_config.pages.
 */
export async function syncLeadsForSinglePage(org: any, page: any): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;
  const pageId = page.page_id;
  const token = page.access_token;

  try {
    // 1. Fetch all lead gen forms for this Page
    const formsRes = await fetch(
      `https://graph.facebook.com/v20.0/${pageId}/leadgen_forms?access_token=${token}&fields=id,name,status`
    );
    const formsData = await formsRes.json() as any;

    if (formsData.error) {
      // Token expired or permissions revoked
      if (formsData.error.code === 190) {
        console.warn(`[Meta Sync] Token expired for org "${org.name}" (${org._id}), page "${page.page_name}".`);
      } else {
        console.error(`[Meta Sync] Error for org "${org.name}", page "${page.page_name}": ${formsData.error.message}`);
      }
      return { imported: 0, skipped: 0 };
    }

    const forms = formsData.data || [];

    // 2. For each form, fetch leads (paginated)
    for (const form of forms) {
      let url: string | null =
        `https://graph.facebook.com/v20.0/${form.id}/leads?access_token=${token}&fields=id,created_time,field_data&limit=50`;

      while (url) {
        const leadsRes = await fetch(url);
        const leadsData = await leadsRes.json() as any;

        if (leadsData.error) {
          console.error(`[Meta Sync] Error fetching leads from form "${form.name}" (Page: ${page.page_name}):`, leadsData.error.message);
          break;
        }

        for (const lead of leadsData.data || []) {
          const fieldData = lead.field_data || [];

          const name =
            fieldData.find((f: any) => f.name === 'full_name' || f.name === 'name')?.values?.[0] || 'FB Lead';
          const mobile =
            fieldData.find((f: any) => f.name === 'phone_number' || f.name === 'phone')?.values?.[0] || '';
          const email =
            fieldData.find((f: any) => f.name === 'email')?.values?.[0] || '';
          const city =
            fieldData.find((f: any) => f.name === 'city')?.values?.[0] || '';

          // Extract all form fields dynamically into custom_data
          const customData: Record<string, string> = {};
          fieldData.forEach((f: any) => {
            if (f.name && f.values && f.values.length > 0) {
              customData[f.name] = f.values[0];
            }
          });

          // Skip leads without a phone number
          if (!mobile) {
            skipped++;
            continue;
          }

          // 1. Skip if this EXACT Facebook Lead ID has already been imported (by webhook or past sync)
          const existsById = await Lead.findOne({ organization_id: org._id, facebook_lead_id: lead.id });
          if (existsById) {
            continue; // Already processed!
          }

          // 2. Detect duplicate applications (same phone number but a different lead instance)
          const exists = await Lead.findOne({ organization_id: org._id, mobile });
          const isDuplicate = !!exists;

          // Create the lead
          await Lead.create({
            organization_id: org._id,
            name,
            mobile,
            email: email || undefined,
            city: city || undefined,
            source: 'Meta Ads',
            status: 'NEW',
            heat: 'WARM',
            duplicateFlag: isDuplicate,
            facebook_lead_id: lead.id,
            facebook_page_name: page.page_name,
            facebook_form_name: form.name,
            custom_data: customData,
          });
          imported++;
          console.log(`[Meta Sync] ✅ New lead: "${name}" (${mobile}) → org "${org.name}" (from ${page.page_name} / ${form.name})`);
        }

        // Paginate
        url = leadsData.paging?.next || null;
      }
    }
  } catch (err: any) {
    console.error(`[Meta Sync] Exception for org "${org.name}", page "${page.page_name}": ${err.message}`);
  }

  return { imported, skipped };
}

async function syncLeadsForOrg(org: any): Promise<{ imported: number; skipped: number; error?: string }> {
  const pages = org.meta_config.pages || [];
  let imported = 0;
  let skipped = 0;

  if (pages.length === 0) {
    return { imported: 0, skipped: 0 };
  }

  for (const page of pages) {
    if (page.is_active === false) {
      continue;
    }
    const res = await syncLeadsForSinglePage(org, page);
    imported += res.imported;
    skipped += res.skipped;
  }

  return { imported, skipped };
}

/**
 * Runs a full sync across ALL organizations that have Meta configured.
 */
export async function syncAllMetaLeads(): Promise<void> {
  const orgs = await Organization.find({
    status: 'active',
    'meta_config.pages.0': { $exists: true },
  });

  if (orgs.length === 0) return;

  for (const org of orgs) {
    const result = await syncLeadsForOrg(org);
    if (result.imported > 0) {
      console.log(`[Meta Sync] Org "${org.name}": imported ${result.imported}, skipped ${result.skipped}`);
    }
  }
}

/**
 * Initializes the Meta lead sync cron job.
 * Runs every 3 minutes to poll Facebook for new leads.
 */
export function initMetaSyncCron(): void {
  const cronExpression = process.env.META_SYNC_CRON || '*/3 * * * *';
  
  cron.schedule(cronExpression, async () => {
    try {
      await syncAllMetaLeads();
    } catch (error) {
      console.error('[Meta Sync Cron] Unexpected error:', error);
    }
  });

  console.log(`[Meta Sync] Cron job initialized — polling Facebook using expression: "${cronExpression}"`);
}
