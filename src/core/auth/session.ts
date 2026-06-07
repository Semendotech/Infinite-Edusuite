import { supabase } from '@/integrations/supabase/client';
import { authContextManager } from '@/core/auth/authContextManager';
import { permissionCache } from '@/core/rbac/permission-cache';

/**
 * Signs out the current user, clears persisted auth storage, and sends them to login.
 * Uses a full navigation so auth state cannot linger in memory.
 */
export async function signOutUser(scope: 'local' | 'global' = 'local'): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  await supabase.auth.signOut({ scope });

  if (userId) {
    permissionCache.invalidate(userId);
  }
  authContextManager.clearContext();

  if (typeof window !== 'undefined') {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-')) {
        localStorage.removeItem(key);
      }
    }
    window.location.replace('/login');
  }
}