import React, { createContext, useState, useEffect, useContext } from 'react';
import { storage } from '../utils/storage';

export interface User {
  id: string;
  name: string;
  mobile: string;
  email?: string | null;
  role: 'superadmin' | 'admin' | 'staff';
  organization_id?: any; 
  must_change_password?: boolean;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  isSuspended: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  markSuspended: () => Promise<void>;
  clearSuspended: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuspended, setIsSuspended] = useState(false);

  useEffect(() => {
    loadStoredData();
  }, []);

  const loadStoredData = async () => {
    try {
      console.log('[Auth] Loading stored auth state...');
      const storedToken = await storage.getItem('token');
      const storedUser = await storage.getItem('user');
      const suspendedFlag = await storage.getItem('account_suspended');
      if (storedToken) setToken(storedToken);
      if (storedUser) setUser(JSON.parse(storedUser));
      if (suspendedFlag === 'true') setIsSuspended(true);
      console.log('[Auth] Stored auth state loaded', {
        hasToken: Boolean(storedToken),
        hasUser: Boolean(storedUser),
        suspended: suspendedFlag === 'true',
      });
    } catch (e) {
      console.error('Failed to load auth data', e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (newToken: string, newUser: User) => {
    console.log('[Auth] Login success, persisting session for role:', newUser.role);
    setToken(newToken);
    setUser(newUser);
    setIsSuspended(false);
    await storage.setItem('token', newToken);
    await storage.setItem('user', JSON.stringify(newUser));
    await storage.removeItem('account_suspended');
  };

  const logout = async () => {
    console.log('[Auth] Logging out and clearing session');
    setToken(null);
    setUser(null);
    setIsSuspended(false);
    await storage.removeItem('token');
    await storage.removeItem('user');
    await storage.removeItem('account_suspended');
  };

  const markSuspended = async () => {
    console.warn('[Auth] Marking account as suspended');
    setIsSuspended(true);
    await storage.setItem('account_suspended', 'true');
  };

  const clearSuspended = async () => {
    console.log('[Auth] Clearing suspended flag');
    setIsSuspended(false);
    await storage.removeItem('account_suspended');
  };

  return (
    <AuthContext.Provider value={{ token, user, isLoading, isSuspended, login, logout, markSuspended, clearSuspended }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
