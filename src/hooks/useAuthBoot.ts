import { useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

export type AuthState = 'booting' | 'ready' | 'setup-needed' | 'missing-env';

export interface AuthBoot {
  state: AuthState;
  user: User | null;
  session: Session | null;
  reload: () => void;
}

/**
 * Section 6.1 auth boot. Runs on every route: reuse the stored session, or sign
 * in anonymously. An env-less or anonymous-disabled project shows "Setup needed".
 */
export function useAuthBoot(): AuthBoot {
  const [state, setState] = useState<AuthState>('booting');
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const started = useRef(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cancelled = false;

    (async () => {
      if (!isSupabaseConfigured) {
        if (!cancelled) setState('missing-env');
        return;
      }
      const { data } = await supabase.auth.getSession();
      let current = data.session ?? null;
      if (!current) {
        // Section 6.1: any sign-in failure - and in particular the "anonymous
        // sign-ins are disabled" error - lands on the Setup needed screen.
        const { data: signed, error } = await supabase.auth.signInAnonymously();
        if (error || !signed.session) {
          if (!cancelled) setState('setup-needed');
          return;
        }
        current = signed.session;
      }
      if (cancelled) return;
      setSession(current);
      setUser(current.user);
      setState('ready');
    })().catch(() => {
      if (!cancelled) setState('setup-needed');
    });

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  // Keep the auth store in sync if the token is refreshed in the background.
  useEffect(() => {
    if (state !== 'ready') return undefined;
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setUser(next?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, [state]);

  return { state, user, session, reload: () => setNonce((n) => n + 1) };
}

export default useAuthBoot;
