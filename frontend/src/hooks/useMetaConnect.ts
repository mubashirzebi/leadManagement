import { useState } from 'react';
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import client from '../api/client';

WebBrowser.maybeCompleteAuthSession();

const BASIC_SCOPES = ['public_profile', 'email'];

const ADVANCED_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'leads_retrieval',
  'pages_manage_metadata',
];

export interface ConnectOptions {
  /** When true, only request basic scopes (public_profile, email) — useful for testing without App Review */
  useBasicScopes?: boolean;
}

const ALL_SCOPES = [...BASIC_SCOPES, ...ADVANCED_SCOPES];

export interface MetaPage {
  id: string;
  name: string;
  access_token: string;
  category: string;
}

export const useMetaConnect = () => {
  const [loading, setLoading] = useState(false);
  const [pages, setPages] = useState<MetaPage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const metaAppId =
    process.env.EXPO_PUBLIC_META_APP_ID ||
    (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_META_APP_ID;

  // Custom scheme redirect URI — must match the Meta Developer Dashboard Valid OAuth Redirect URI exactly
  const redirectUri = 'leadmanagement://';

  const connect = async (options?: ConnectOptions): Promise<MetaPage[] | null> => {
    setLoading(true);
    setError(null);
    try {
      if (!metaAppId) {
        throw new Error('Missing Meta App ID in .env');
      }

      const scopes = options?.useBasicScopes ? BASIC_SCOPES : ALL_SCOPES;

      console.log('[Meta] App ID:', metaAppId);
      console.log('[Meta] Redirect URI (custom scheme):', redirectUri);
      console.log('[Meta] Scopes requested:', scopes.join(', '));
      console.log('[Meta] Mode:', options?.useBasicScopes ? 'BASIC (diagnostic)' : 'FULL (all scopes)');

      // Build the Facebook OAuth URL manually — response_type=code, NO PKCE, NO auth_type
      const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${metaAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes.join(','))}&response_type=code&display=page`;

      console.log('[Meta] TEST THIS URL IN DESKTOP BROWSER:', authUrl);
      console.log('[Meta] Opening Facebook OAuth dialog...');

      const authResult = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      console.log('[Meta] OAuth Result Type:', authResult.type);

      if (authResult.type !== 'success') {
        const resultInfo = JSON.stringify(authResult, null, 2);
        console.warn('[Meta] OAuth was not successful. Full result:', resultInfo);
        Alert.alert(
          'OAuth Failed',
          `Type: ${authResult.type}\nURL: ${(authResult as any).url || 'N/A'}\nError: ${(authResult as any).error || 'N/A'}\n\nSee console for full details.`
        );
        setLoading(false);
        return null;
      }

      // Extract the authorization code from the redirect URL
      const { url } = authResult;
      console.log('[Meta] Redirect URL:', url);

      if (!url) {
        throw new Error('No redirect URL returned from OAuth');
      }

      // Use regex to extract params — new URL() fails with custom schemes like leadmanagement://
      const getParam = (name: string): string | null => {
        const regex = new RegExp(`[?&]${name}=([^&#]+)`);
        const match = url.match(regex);
        return match ? decodeURIComponent(match[1]) : null;
      };

      // Check for Facebook error parameters in the redirect URL (e.g. error=access_denied)
      const fbError = getParam('error');
      if (fbError) {
        const fbErrorDesc = getParam('error_description') || '';
        const fbErrorReason = getParam('error_reason') || '';
        const fbErrorCode = getParam('error_code') || '';
        const diagParts = [`Facebook error: ${fbError}`];
        if (fbErrorReason) diagParts.push(`Reason: ${fbErrorReason}`);
        if (fbErrorCode) diagParts.push(`Code: ${fbErrorCode}`);
        if (fbErrorDesc) diagParts.push(`Description: ${fbErrorDesc}`);
        const diagMsg = diagParts.join('\n');
        console.error('[Meta] Facebook error in redirect URL. Full result:', JSON.stringify(authResult, null, 2));
        Alert.alert('Facebook Error', diagMsg);
        throw new Error(diagMsg);
      }

      const code = getParam('code');

      if (!code) {
        console.error(
          '[Meta] No code found in redirect URL. Full result:',
          JSON.stringify(authResult),
        );
        throw new Error('Authorization code not found in response');
      }

      console.log('[Meta] Authorization code received, exchanging with backend...');

      // Send the code + redirect_uri to the backend for server-side exchange
      const res = await client.post('/auth/meta/exchange', {
        code,
        redirect_uri: redirectUri,
      });

      if (res.data.success) {
        setPages(res.data.data.pages);
        return res.data.data.pages;
      } else {
        throw new Error(res.data.message || 'Failed to fetch pages');
      }
    } catch (e: any) {
      // Extract backend error message if available (e.g. from Facebook)
      const backendMessage = e.response?.data?.message;
      const errorMsg = backendMessage
        ? `${e.message || 'Something went wrong'}\n\nBackend: ${backendMessage}`
        : e.message || 'Something went wrong';
      console.error('[Meta] Connect Error:', e.message || e);
      if (backendMessage) {
        console.error('[Meta] Backend error response:', backendMessage);
      }
      Alert.alert('Connection Failed', errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const savePage = async (page: MetaPage) => {
    try {
      const res = await client.patch('/auth/organization', {
        meta_config: {
          page_id: page.id,
          page_access_token: page.access_token,
          page_name: page.name,
        },
      });
      return res.data.success;
    } catch (e) {
      console.error('[Meta] Save Page Error:', e);
      return false;
    }
  };

  return { connect, savePage, pages, loading, error, setError };
};
