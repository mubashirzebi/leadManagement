import { Response } from 'express';
import Organization from '../models/Organization';
import Lead from '../models/Lead';
import { AuthRequest } from '../middleware/auth';
import { syncLeadsForSinglePage } from '../services/metaSyncService';

export const connectMeta = async (req: AuthRequest, res: Response) => {
  try {
    // Legacy support for single page payload, or new array of pages payload
    const pagesPayload = req.body.pages || (req.body.page_id ? [{
      page_id: req.body.page_id,
      access_token: req.body.access_token,
      page_name: req.body.page_name || 'Unknown Page'
    }] : []);

    const organization_id = req.user?.organization_id;

    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Only Agency Owners can configure integrations' });
    }

    if (!pagesPayload || pagesPayload.length === 0) {
      return res.status(400).json({ success: false, message: 'No pages provided to connect' });
    }

    const validatedPages: any[] = [];
    const errors: string[] = [];

    // Process each page
    for (const page of pagesPayload) {
      const { page_id, access_token, page_name } = page;
      if (!page_id || !access_token) {
        errors.push(`Missing ID or Token for page ${page_name || page_id}`);
        continue;
      }

      let finalAccessToken = access_token;

      // Exchange short-lived token for long-lived Page Access Token if App Credentials are present
      if (process.env.META_APP_ID && process.env.META_APP_SECRET) {
        try {
          console.log(`[Meta Connect] Exchanging token for Page ${page_id}...`);
          
          // 1. Try to exchange for a long-lived User Token (valid for 60 days)
          const exchangeRes = await fetch(
            `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${access_token}`
          );
          const exchangeData = await exchangeRes.json() as any;

          if (exchangeRes.ok && exchangeData.access_token) {
            const longLivedUserToken = exchangeData.access_token;

            // 2. Fetch page accounts for this user to get the never-expiring Page Access Token
            const accountsRes = await fetch(
              `https://graph.facebook.com/v20.0/me/accounts?access_token=${longLivedUserToken}&limit=100`
            );
            const accountsData = await accountsRes.json() as any;

            if (accountsRes.ok && accountsData.data) {
              const pageObj = accountsData.data.find((p: any) => p.id === page_id);
              if (pageObj && pageObj.access_token) {
                finalAccessToken = pageObj.access_token;
              }
            }
          }
        } catch (err: any) {
          console.warn(`[Meta Connect] Auto-exchange token failed for Page ${page_id} (falling back):`, err.message);
        }
      }

      // 1. Validate the credentials against Facebook Graph API live
      try {
        console.log(`[Meta Connect] Testing connection to Page ${page_id}...`);
        const metaRes = await fetch(
          `https://graph.facebook.com/v20.0/${page_id}?fields=name&access_token=${finalAccessToken}`
        );
        const metaData = await metaRes.json() as any;

        if (!metaRes.ok || !metaData || metaData.error) {
          const errorMsg = metaData?.error?.message || 'Invalid Page ID or Access Token';
          errors.push(`Page ${page_id} verification failed: ${errorMsg}`);
          continue;
        }

        const actualPageName = metaData.name || page_name;
        console.log(`[Meta Connect] Verified! Connected to page "${actualPageName}"`);

        // 2. Automatically subscribe the App to the Page's leadgen events
        console.log(`[Meta Connect] Subscribing app to Page ${page_id} webhooks...`);
        const subRes = await fetch(
          `https://graph.facebook.com/v20.0/${page_id}/subscribed_apps?subscribed_fields=leadgen&access_token=${finalAccessToken}`,
          { method: 'POST' }
        );
        const subData = await subRes.json() as any;

        if (!subRes.ok || !subData || !subData.success) {
          const errorMsg = subData?.error?.message || 'App subscription failed';
          errors.push(`Page ${page_id} Webhook subscription failed: ${errorMsg}`);
          continue;
        }

        console.log(`[Meta Connect] App successfully subscribed to Page ${page_id}`);
        
        validatedPages.push({
          page_id,
          page_name: actualPageName,
          access_token: finalAccessToken,
        });

      } catch (fetchError: any) {
        errors.push(`Failed to reach Facebook Servers for Page ${page_id}: ${fetchError.message}`);
      }
    }

    if (validatedPages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to connect any pages.',
        errors
      });
    }

    // 3. Save the configuration to the DB
    const org = await Organization.findByIdAndUpdate(
      organization_id,
      {
        meta_config: { pages: validatedPages }
      },
      { new: true }
    );

    if (!org) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    res.json({
      success: true,
      message: `Successfully connected ${validatedPages.length} Facebook Page(s).`,
      data: {
        pages: validatedPages.map(p => ({ page_id: p.page_id, page_name: p.page_name }))
      },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('[Meta Connect Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Fetches all Facebook Pages managed by the admin using their User Access Token.
 * Automatically exchanges the short-lived token for a long-lived one first.
 * Returns a list of pages with id, name, and category.
 */
export const fetchMetaPages = async (req: AuthRequest, res: Response) => {
  try {
    const { user_access_token } = req.body;

    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Only Agency Owners can configure integrations' });
    }

    if (!user_access_token) {
      return res.status(400).json({ success: false, message: 'User Access Token is required' });
    }

    let tokenToUse = user_access_token;

    // Exchange for long-lived user token if App Credentials are present
    if (process.env.META_APP_ID && process.env.META_APP_SECRET) {
      try {
        console.log('[Meta Pages] Exchanging for long-lived user token...');
        const exchangeRes = await fetch(
          `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${user_access_token}`
        );
        const exchangeData = await exchangeRes.json() as any;

        if (exchangeRes.ok && exchangeData.access_token) {
          tokenToUse = exchangeData.access_token;
          console.log('[Meta Pages] Successfully obtained long-lived user token.');
        }
      } catch (err: any) {
        console.warn('[Meta Pages] Token exchange failed (using original):', err.message);
      }
    }

    // Fetch all pages managed by this user
    const accountsRes = await fetch(
      `https://graph.facebook.com/v20.0/me/accounts?access_token=${tokenToUse}&fields=id,name,category,access_token&limit=100`
    );
    const accountsData = await accountsRes.json() as any;

    if (!accountsRes.ok || accountsData.error) {
      const errorMsg = accountsData?.error?.message || 'Failed to fetch pages';
      console.error('[Meta Pages] Error:', accountsData?.error);
      return res.status(400).json({
        success: false,
        message: `Invalid token: ${errorMsg}`
      });
    }

    const pages = (accountsData.data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category || 'Page',
      access_token: p.access_token, // This is the never-expiring page token
    }));

    if (pages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No Facebook Pages found for this account. Make sure you have admin access to at least one Page.'
      });
    }

    console.log(`[Meta Pages] Found ${pages.length} page(s) for user.`);

    res.json({
      success: true,
      data: pages.map((p: any) => ({ id: p.id, name: p.name, category: p.category })),
      // Store the page tokens server-side in a temporary cache (sent back during connect)
      _pageTokens: pages.reduce((acc: any, p: any) => { acc[p.id] = p.access_token; return acc; }, {}),
    });
  } catch (error) {
    console.error('[Meta Pages Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const linkMetaPage = async (req: AuthRequest, res: Response) => {
  try {
    const { page_id, page_name, access_token } = req.body;
    const organization_id = req.user?.organization_id;

    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Only Agency Owners can configure integrations' });
    }

    if (!page_id) {
      return res.status(400).json({ success: false, message: 'Page ID is required' });
    }

    const org = await Organization.findById(organization_id);
    if (!org) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    // 1. Check if the page is already in organization's config list
    let existingPage = org.meta_config?.pages?.find((p: any) => p.page_id === page_id);
    let finalAccessToken = access_token;
    let actualPageName = page_name || 'Unknown Page';

    if (!finalAccessToken) {
      // Re-linking flow using existing saved token!
      if (!existingPage) {
        return res.status(400).json({ 
          success: false, 
          message: 'Access Token is required to link a new page.' 
        });
      }
      finalAccessToken = existingPage.access_token;
      actualPageName = existingPage.page_name;
    } else {
      // Long-lived Page Access Token exchange if needed (if app credentials exist)
      if (process.env.META_APP_ID && process.env.META_APP_SECRET) {
        try {
          console.log(`[Meta Link] Exchanging token for Page ${page_id}...`);
          const exchangeRes = await fetch(
            `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${access_token}`
          );
          const exchangeData = await exchangeRes.json() as any;

          if (exchangeRes.ok && exchangeData.access_token) {
            const longLivedUserToken = exchangeData.access_token;
            const accountsRes = await fetch(
              `https://graph.facebook.com/v20.0/me/accounts?access_token=${longLivedUserToken}&limit=100`
            );
            const accountsData = await accountsRes.json() as any;

            if (accountsRes.ok && accountsData.data) {
              const pageObj = accountsData.data.find((p: any) => p.id === page_id);
              if (pageObj && pageObj.access_token) {
                finalAccessToken = pageObj.access_token;
              }
            }
          }
        } catch (err: any) {
          console.warn(`[Meta Link] Auto-exchange token failed for Page ${page_id} (falling back):`, err.message);
        }
      }
    }

    // 2. Validate the credentials against Facebook Graph API live
    try {
      console.log(`[Meta Link] Testing connection to Page ${page_id}...`);
      const metaRes = await fetch(
        `https://graph.facebook.com/v20.0/${page_id}?fields=name&access_token=${finalAccessToken}`
      );
      const metaData = await metaRes.json() as any;

      if (!metaRes.ok || !metaData || metaData.error) {
        const errorMsg = metaData?.error?.message || 'Invalid Page ID or Access Token';
        return res.status(400).json({ success: false, message: `Page verification failed: ${errorMsg}` });
      }

      actualPageName = metaData.name || actualPageName;

      // 3. Automatically subscribe the App to the Page's leadgen events
      console.log(`[Meta Link] Subscribing app to Page ${page_id} webhooks...`);
      const subRes = await fetch(
        `https://graph.facebook.com/v20.0/${page_id}/subscribed_apps?subscribed_fields=leadgen&access_token=${finalAccessToken}`,
        { method: 'POST' }
      );
      const subData = await subRes.json() as any;

      if (!subRes.ok || !subData || !subData.success) {
        const errorMsg = subData?.error?.message || 'Webhook subscription failed';
        return res.status(400).json({ success: false, message: `Page Webhook subscription failed: ${errorMsg}` });
      }

      console.log(`[Meta Link] App successfully subscribed to Page ${page_id}`);
    } catch (fetchError: any) {
      return res.status(500).json({ success: false, message: `Failed to reach Facebook Servers: ${fetchError.message}` });
    }

    // 4. Save/Update Page config list
    if (existingPage) {
      existingPage.is_active = true;
      existingPage.access_token = finalAccessToken;
      existingPage.page_name = actualPageName;
    } else {
      if (!org.meta_config) org.meta_config = { pages: [] };
      if (!org.meta_config.pages) org.meta_config.pages = [];
      org.meta_config.pages.push({
        page_id,
        page_name: actualPageName,
        access_token: finalAccessToken,
        is_active: true
      });
    }

    // Mark as modified if editing subdocument array properties directly
    org.markModified('meta_config.pages');
    await org.save();

    // 5. Trigger real-time dynamic sync for this page in the background!
    console.log(`[Meta Link] Triggering real-time lead sync for page "${actualPageName}"...`);
    const pageToSync = org.meta_config.pages.find((p: any) => p.page_id === page_id);
    if (pageToSync) {
      syncLeadsForSinglePage(org, pageToSync)
        .then((syncRes) => {
          console.log(`[Meta Link Background Sync] Finished: imported ${syncRes.imported}, skipped ${syncRes.skipped} leads.`);
        })
        .catch((err) => {
          console.error('[Meta Link Background Sync Error]:', err);
        });
    }

    res.json({
      success: true,
      message: `Successfully linked Facebook Page "${actualPageName}".`,
      data: org
    });

  } catch (error) {
    console.error('[Meta Link Page Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const unlinkMetaPage = async (req: AuthRequest, res: Response) => {
  try {
    const { page_id } = req.body;
    const organization_id = req.user?.organization_id;

    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Only Agency Owners can configure integrations' });
    }

    if (!page_id) {
      return res.status(400).json({ success: false, message: 'Page ID is required' });
    }

    const org = await Organization.findById(organization_id);
    if (!org) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    const existingPage = org.meta_config?.pages?.find((p: any) => p.page_id === page_id);
    if (!existingPage) {
      return res.status(404).json({ success: false, message: 'Page not connected to organization' });
    }

    // 1. Unsubscribe page from webhook notifications to be clean (best effort)
    try {
      console.log(`[Meta Unlink] Unsubscribing app from Page ${page_id} webhooks...`);
      await fetch(
        `https://graph.facebook.com/v20.0/${page_id}/subscribed_apps?access_token=${existingPage.access_token}`,
        { method: 'DELETE' }
      );
    } catch (err: any) {
      console.warn(`[Meta Unlink] Webhook unsubscription failed (ignoring):`, err.message);
    }

    // 2. Mark page as inactive
    existingPage.is_active = false;
    org.markModified('meta_config.pages');
    await org.save();

    res.json({
      success: true,
      message: `Successfully unlinked Facebook Page "${existingPage.page_name}".`,
      data: org
    });

  } catch (error) {
    console.error('[Meta Unlink Page Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
