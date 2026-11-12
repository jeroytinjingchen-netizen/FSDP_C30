import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { api, clearUser, getStoredUser, storeUser } from './api.js';

const AuthContext = createContext(null);
const CENTRE_KEY = 'selectedCentreId';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);

  const login = useCallback((u) => {
    storeUser(u);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } finally {
      clearUser();
      localStorage.removeItem(CENTRE_KEY);
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
export { CENTRE_KEY };
