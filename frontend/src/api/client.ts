import axios from 'axios';
import { storage } from '../utils/storage';
import { authEvents } from '../utils/authEvents';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

if (!process.env.EXPO_PUBLIC_API_URL) {
  console.warn('⚠️ EXPO_PUBLIC_API_URL is not set. Falling back to localhost. This will fail on physical devices.');
}

console.log('[API] Base URL:', API_URL);

const client = axios.create({
  baseURL: API_URL,
});

client.interceptors.request.use(async (config) => {
  const token = await storage.getItem('token');
  console.log('[API] Request', config.method?.toUpperCase(), config.url, {
    hasToken: Boolean(token),
  });
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => {
    console.log('[API] Response', response.status, response.config.url);
    return response;
  },
  async (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message;

    // Silently handle 401 — token expired or no token (e.g. during logout race)
    // EXCEPT for the login request itself, where we need to show the error
    if (status === 401 && !error.config?.url?.includes('/auth/login')) {
      console.warn('[API] 401 received — triggering logout silently');
      authEvents.triggerLogout();
      return new Promise(() => {});
    }

    // Log minimal info for debugging, but avoid passing objects to console.error
    // which some environments catch and show as toasts
    console.log(`[API] Error ${status} on ${error.config?.url}: ${message || error.message}`);

    if (status === 403 && typeof message === 'string' && message.toLowerCase().includes('suspended')) {
      await storage.setItem('account_suspended', 'true');
    }

    return Promise.reject(error);
  }
);

export default client;
