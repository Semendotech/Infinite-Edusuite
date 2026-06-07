import { redirect } from '@tanstack/react-router';
import type { AuthContext } from '@/router';
import { Role } from '@/core/rbac/permissions';

const STAFF_ROLES: Role[] = [Role.SUPER_ADMIN, Role.BRANCH_ADMIN, Role.FINANCE, Role.LECTURER];

export function isStudentPortalUser(roles: string[]): boolean {
  return roles.includes(Role.STUDENT) && !roles.some((role) => STAFF_ROLES.includes(role as Role));
}

export function requireStudentPortalUser(auth: AuthContext): void {
  if (!auth.isAuthenticated) {
    throw redirect({ to: '/login', search: { redirect: '/dashboard' } });
  }
  if (auth.isSuperAdmin) {
    return;
  }
  const roles = auth.user?.roles ?? [];
  if (!isStudentPortalUser(roles)) {
    throw redirect({ to: '/dashboard' });
  }
}