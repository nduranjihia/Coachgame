import { useEffect, useRef } from 'react';
import { HEALTH_POLL_MS } from '@/lib/constants';
import { supabase } from '@/lib/supabase';

export interface HealthCheckOptions {
  householdId: string | null;
  uid: string | null;
  role: 'tv' | 'phone';
  onGone: () => void;
  onAlive: () => void;
}

/**
 * Section 6.5. Realtime DELETE events are not reliable, so every device polls
 * every 20 seconds (and on `visibilitychange`) to confirm the household and its
 * own device row still exist. If they do not, the home was deleted.
 */
export function useHealthCheck({ householdId, uid, role, onGone, onAlive }: HealthCheckOptions): void {
  const onGoneRef = useRef(onGone);
  const onAliveRef = useRef(onAlive);
  onGoneRef.current = onGone;
  onAliveRef.current = onAlive;

  useEffect(() => {
    if (!householdId || !uid) return undefined;
    let cancelled = false;
    let checking = false;

    const check = async (): Promise<void> => {
      if (cancelled || checking) return;
      checking = true;
      try {
        const { data: hh } = await supabase
          .from('households')
          .select('id')
          .eq('id', householdId)
          .maybeSingle();
        if (cancelled) return;
        if (!hh) {
          onGoneRef.current();
          return;
        }
        const { data: dev } = await supabase
          .from('devices')
          .select('id, kind')
          .eq('household_id', householdId)
          .eq('auth_uid', uid)
          .maybeSingle();
        if (cancelled) return;
        if (!dev) {
          onGoneRef.current();
          return;
        }
        await onAliveRef.current();
      } finally {
        checking = false;
      }
    };

    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void check();
    };

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void check();
    }, HEALTH_POLL_MS);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [householdId, role, uid]);
}

export default useHealthCheck;
