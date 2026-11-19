import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/services';
import { tokenStore } from '../api/client';

const AuthContext = createContext(null);

/**
 * Holds the logged-in user for the whole app.
 * The JWT is kept in localStorage; the user's role always comes from the server (/auth/me).
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState('');

  const logout = useCallback((message = '') => {
    tokenStore.clear();
    setUser(null);
    setSessionMessage(message);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      return null;
    }
    try {
      const { user: me } = await authApi.me();
      setUser(me);
      return me;
    } catch {
      tokenStore.clear();
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  useEffect(() => {
    const handler = (e) => logout(e.detail || 'Your session has ended. Please log in again.');
    window.addEventListener('jobnest:unauthorized', handler);
    return () => window.removeEventListener('jobnest:unauthorized', handler);
  }, [logout]);

  /** role is optional: only sent when one email has several accounts and the user picked one. */
  const login = useCallback(async (email, password, role) => {
    const { token, user: me } = await authApi.login({ email, password, ...(role ? { role } : {}) });
    tokenStore.set(token);
    setUser(me);
    setSessionMessage('');
    return me;
  }, []);

  const signup = useCallback(async (payload) => {
    const { token, user: me } = await authApi.signup(payload);
    tokenStore.set(token);
    setUser(me);
    setSessionMessage('');
    return me;
  }, []);

  /** Update parts of the cached user (e.g. after finishing the assessment). */
  const patchUser = useCallback((changes) => setUser((u) => (u ? { ...u, ...changes } : u)), []);

  const value = useMemo(
    () => ({ user, loading, login, signup, logout, refreshUser, patchUser, sessionMessage, setSessionMessage }),
    [user, loading, login, signup, logout, refreshUser, patchUser, sessionMessage]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
