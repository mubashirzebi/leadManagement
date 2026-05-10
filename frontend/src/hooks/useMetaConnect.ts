import { useState } from 'react';
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import client from '../api/client';

WebBrowser.maybeCompleteAuthSession();

const SCOPES = [
  'public_profile',
  'email',
  'pages_show_list',
  'pages_read_engagement',
  'leads_retrieval',
  'pages_manage_metadata',
].join(',');

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

  const metaAppId = process.env.EXPO_PUBLIC_META_APP_ID || (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_META_APP_ID;
  const redirectUri = 'https://auth.expo.io/@anonymous/frontend';

  const connect = async (): Promise<MetaPage[] | null> => {
    setLoading(true);
    setError(null);
    try {
      if (!metaAppId) {
        throw new Error('Missing Meta App ID in .env');
      }

      const authUrl =
        `https://www.facebook.com/v19.0/dialog/oauth` +
        `?client_id=${metaAppId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(SCOPES)}` +
        `&response_type=token` +
        `&auth_type=rerequest`;

      console.log('[Meta] Opening Auth URL:', authUrl);

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type !== 'success') {
        setLoading(false);
        return null;
      }

      const url = result.url;
      if (!url) {
        throw new Error('No URL returned from Facebook');
      }

      // Extract token using regex
      const tokenMatch = url.match(/access_token=([^&]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;

      if (!token) {
        throw new Error('Access token not found in response');
      }

      console.log('[Meta] Token found, exchanging with backend...');
      const res = await client.post('/auth/meta/exchange', { access_token: token });

      if (res.data.success) {
        setPages(res.data.data.pages);
        return res.data.data.pages;
      } else {
        throw new Error(res.data.message || 'Failed to fetch pages');
      }
    } catch (e: any) {
      console.error('[Meta] Connect Error:', e);
      Alert.alert('Connection Failed', e.message || 'Something went wrong');
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
          page_name: page.name
        }
      });
      return res.data.success;
    } catch (e) {
      console.error('[Meta] Save Page Error:', e);
      return false;
    }
  };

  return { connect, savePage, pages, loading, error, setError };
};
