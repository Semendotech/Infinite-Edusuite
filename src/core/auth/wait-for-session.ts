import { supabase } from '@/integrations/supabase/client';

/**
 * Resolves once Supabase has a persisted session (after sign-in / sign-up).
 */
export function waitForAuthSession(timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
      fn();
    };

    const timeout = setTimeout(() => {
      finish(() => reject(new Error('Sign in timed out. Please try again.')));
    }, timeoutMs);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        finish(resolve);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        finish(resolve);
      }
    });
  });
}