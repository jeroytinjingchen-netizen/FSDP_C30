import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { CENTRE_KEY } from './AuthContext.jsx';

const CentreContext = createContext(null);

// Holds the centre switcher state. centreId === null means "All centres".
// Screens that list data should call centreQuery() when fetching and re-fetch when centreId changes.
export function CentreProvider({ children }) {
  const [centres, setCentres] = useState([]);
  const [centreId, setCentreIdState] = useState(() => localStorage.getItem(CENTRE_KEY) || null);

  const setCentreId = useCallback((id) => {
    if (id) localStorage.setItem(CENTRE_KEY, id);
    else localStorage.removeItem(CENTRE_KEY);
    setCentreIdState(id || null);
  }, []);

  const refreshCentres = useCallback(async () => {
    const list = await api('/api/centres');
    setCentres(list);
    setCentreIdState((current) => {
      if (current && !list.some((c) => c.id === current)) {
        localStorage.removeItem(CENTRE_KEY);
        return null;
      }
      return current;
    });
  }, []);

  useEffect(() => {
    refreshCentres().catch(() => {});
  }, [refreshCentres]);

  const value = useMemo(
    () => ({
      centres,
      centreId,
      setCentreId,
      refreshCentres,
      centreQuery: (prefix = '?') => (centreId ? `${prefix}centreId=${centreId}` : ''),
    }),
    [centres, centreId, setCentreId, refreshCentres]
  );

  return <CentreContext.Provider value={value}>{children}</CentreContext.Provider>;
}

export const useCentre = () => useContext(CentreContext);
