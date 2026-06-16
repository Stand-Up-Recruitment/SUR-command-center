import { useState, useEffect, useCallback, useRef } from 'react';

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface UseAirtableResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}

export function useAirtable<T>(
  fetcher: () => Promise<T>,
  credentialsReady?: boolean
): UseAirtableResult<T> {
  const hasApiKey =
    credentialsReady !== undefined
      ? credentialsReady
      : Boolean(import.meta.env.VITE_AIRTABLE_API_KEY) &&
        Boolean(import.meta.env.VITE_AIRTABLE_BASE_ID);

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(hasApiKey);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!hasApiKey) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [fetcher, hasApiKey]);

  useEffect(() => {
    load();
    if (hasApiKey) {
      timerRef.current = setInterval(load, REFRESH_INTERVAL_MS);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load, hasApiKey]);

  return { data, loading, error, lastUpdated, refresh: load };
}
