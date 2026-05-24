import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import User from '../models/User';
import Organization from '../models/Organization';
import { AuthRequest } from '../middleware/auth';
import { sendSuperAdminPasswordResetEmail } from '../services/emailService';

const RESET_TOKEN_TTL_MINUTES = 15;
const generateWebhookToken = () => crypto.randomBytes(24).toString('hex');

const hashResetToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const login = async (req: Request, res: Response) => {
  try {
    const { mobile, password } = req.body;
    
    if (!mobile || !password) {
      return res.status(400).json({ success: false, message: 'Mobile and password required' });
    }

    const user = await User.findOne({ mobile, status: 'active' }).populate('organization_id');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password as string);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check organization status (Kill Switch) if it's not a platform_owner
    if (user.role !== 'platform_owner' && user.organization_id) {
      const org = user.organization_id as any;
      if (org.status === 'suspended') {
        return res.status(403).json({ success: false, message: 'Your agency account has been suspended. Please contact support.' });
      }
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    const token = jwt.sign(
      { 
        id: user._id, 
        role: user.role, 
        organization_id: user.organization_id?._id || null,
        must_change_password: user.must_change_password
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          role: user.role,
          organization_id: user.organization_id,
          must_change_password: user.must_change_password
        }
      }
    });
  } catch (error) {
    console.error('[Login Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updatePassword = async (req: AuthRequest, res: Response) => {
  try {
    const { newPassword } = req.body;
    const userId = req.user?.id;

    if (!newPassword) {
      return res.status(400).json({ success: false, message: 'New password is required' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await User.findByIdAndUpdate(userId, {
      password: hashedPassword,
      must_change_password: false
    });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('[Update Password Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const forgotSuperAdminPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const genericResponse: any = {
      success: true,
      message: 'If a SuperAdmin exists with this email, reset instructions have been sent.'
    };

    const user = await User.findOne({ email: normalizedEmail, role: 'platform_owner' });
    if (!user) {
      return res.json(genericResponse);
    }

    const token = crypto.randomInt(100000, 1000000).toString();
    user.reset_password_token_hash = hashResetToken(token);
    user.reset_password_expires_at = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
    await user.save();

    await sendSuperAdminPasswordResetEmail({
      to: normalizedEmail,
      token,
      name: user.name
    });

    if (process.env.NODE_ENV !== 'production') {
      genericResponse.data = { resetToken: token };
    }

    res.json(genericResponse);
  } catch (error) {
    console.error('[Forgot SuperAdmin Password Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const resetSuperAdminPassword = async (req: Request, res: Response) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, token, and newPassword are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const tokenHash = hashResetToken(String(token));

    const user = await User.findOne({
      email: normalizedEmail,
      role: 'platform_owner',
      reset_password_token_hash: tokenHash,
      reset_password_expires_at: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    user.must_change_password = false;
    user.reset_password_token_hash = null;
    user.reset_password_expires_at = null;
    await user.save();

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('[Reset SuperAdmin Password Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateMyOrganization = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organization_id;
    const { meta_config, google_key } = req.body;

    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Only Agency Owners can manage integrations' });
    }

    if (!orgId) {
      return res.status(400).json({ success: false, message: 'No organization linked' });
    }

    const updates: any = {};
    if (meta_config) updates.meta_config = meta_config;
    if (google_key !== undefined) updates.google_key = google_key;

    const org = await Organization.findByIdAndUpdate(orgId, updates, { new: true });
    if (org && !org.webhook_token) {
      org.webhook_token = generateWebhookToken();
      await org.save();
    }
    
    res.json({ success: true, message: 'Organization updated successfully', data: org });
  } catch (error) {
    console.error('[Update My Org Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getMyOrganization = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organization_id;
    if (!orgId) {
      return res.status(400).json({ success: false, message: 'No organization linked' });
    }
    const org = await Organization.findById(orgId);
    res.json({ success: true, data: org });
  } catch (error) {
    console.error('[Get My Org Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Exchange short-lived Facebook token OR authorization code → fetch admin's Pages list
export const exchangeMetaToken = async (req: AuthRequest, res: Response) => {
  try {
    const { access_token, code, redirect_uri } = req.body;
    const APP_ID = process.env.META_APP_ID;
    const APP_SECRET = process.env.META_APP_SECRET;

    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Only Agency Owners can connect Meta pages' });
    }

    if (!access_token && !code) {
      return res.status(400).json({ success: false, message: 'Either access_token or code is required' });
    }
    if (code && !redirect_uri) {
      return res.status(400).json({ success: false, message: 'redirect_uri is required when using authorization code' });
    }
    if (!APP_ID || !APP_SECRET) {
      return res.status(500).json({ success: false, message: 'Meta app not configured' });
    }

    let shortLivedToken: string;

    if (code) {
      // New flow: Exchange authorization code for a short-lived token (server-side, no PKCE)
      console.log('[Meta] Exchanging authorization code for short-lived token...');
      const codeExchangeUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&redirect_uri=${encodeURIComponent(redirect_uri)}&code=${code}`;
      const ceResponse = await fetch(codeExchangeUrl);
      const ceData: any = await ceResponse.json();

      if (!ceResponse.ok || !ceData.access_token) {
        console.error('[Meta Code Exchange Error]:', JSON.stringify(ceData, null, 2));
        return res.status(400).json({ success: false, message: ceData.error?.message || 'Authorization code exchange failed' });
      }

      shortLivedToken = ceData.access_token;
      console.log('[Meta] Authorization code exchanged successfully.');
    } else {
      // Legacy flow: Use the access_token directly as the short-lived token
      shortLivedToken = access_token;
    }

    // Step 1: Exchange short-lived token for long-lived token
    console.log('[Meta] Exchanging short-lived token for long-lived token...');
    const longLivedUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${shortLivedToken}`;
    const llResponse = await fetch(longLivedUrl);
    const llData: any = await llResponse.json();

    if (!llResponse.ok || !llData.access_token) {
      console.error('[Meta Long-Lived Exchange Error]:', JSON.stringify(llData, null, 2));
      return res.status(400).json({ success: false, message: llData.error?.message || 'Token exchange failed' });
    }

    const longLivedToken = llData.access_token;
    console.log('[Meta] Long-lived token obtained successfully.');

    // Step 2: Fetch the list of Pages this user manages
    console.log('[Meta] Fetching pages...');
    const pagesUrl = `https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedToken}&fields=id,name,access_token,category`;
    const pagesResponse = await fetch(pagesUrl);
    const pagesData: any = await pagesResponse.json();

    if (!pagesResponse.ok || !pagesData.data) {
      console.error('[Meta Pages Fetch Error]:', JSON.stringify(pagesData, null, 2));
      return res.status(400).json({ success: false, message: 'Could not fetch pages' });
    }

    console.log(`[Meta] Successfully fetched ${pagesData.data.length} pages.`);

    res.json({
      success: true,
      data: {
        pages: pagesData.data,
        user_token: longLivedToken
      }
    });
  } catch (error) {
    console.error('[Meta Exchange Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
