import { redirect } from '@tanstack/react-router';
import type { AuthContext } from '@/router';
import { Permission } from '@/core/rbac/permissions';

type RedirectTo = '/dashboard' | '/login';

/**
 * Redirect unless the user has at least one of the required permissions.
 * Super admins always pass.
 */
export function requireAnyPermission(
  auth: AuthContext,
  permissions: readonly Permission[],
  redirectTo: RedirectTo = '/dashboard',
): void {
  if (!auth.isAuthenticated) {
    throw redirect({ to: '/login', search: { redirect: '/dashboard' } });
  }

  if (auth.isSuperAdmin || auth.hasAnyPermission([...permissions])) {
    return;
  }

  throw redirect({ to: redirectTo });
}

export function requirePermission(
  auth: AuthContext,
  permission: Permission,
  redirectTo: RedirectTo = '/dashboard',
): void {
  requireAnyPermission(auth, [permission], redirectTo);
}