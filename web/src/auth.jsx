import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still loading

  useEffect(() => {
    api('/auth/me').then((d) => setUser(d.user)).catch(() => setUser(null));
  }, []);

  const login = useCallback(async (email, password) => {
    const d = await api('/auth/login', { method: 'POST', body: { email, password } });
    setUser(d.user);
    return d.user;
  }, []);

  const signup = useCallback(async (fields) => {
    const d = await api('/auth/signup', { method: 'POST', body: fields });
    setUser(d.user);
    return d.user;
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export function homeFor(user) {
  if (!user) return '/';
  if (user.role === 'driver') return '/driver';
  if (user.role === 'admin') return '/admin';
  return '/app';
}
