import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

// Fetches a GET endpoint and optionally re-polls it, so status pages stay live.
export function useApi(path, { pollMs } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const reload = useCallback(() => {
    if (!path) return Promise.resolve();
    return api(path).then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message));
  }, [path]);

  useEffect(() => {
    reload();
    if (!pollMs) return;
    const t = setInterval(() => { if (!document.hidden) reload(); }, pollMs);
    return () => clearInterval(t);
  }, [reload, pollMs]);

  return { data, error, reload, setData };
}
