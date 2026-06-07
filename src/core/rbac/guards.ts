import { redirect } from '@tanstack/react-router';
import { Permission, Role } from './permissions';
import { rbacService } from './rbac.service';

/**
 * Server-side route guard - requires specific permission
 * Throws redirect if unauthorized
 */
export async function requirePermission(
  userId: string,
  permission: Permission,
  redirectTo: string = '/dashboard'
): Promise<void> {
  const hasPermission = await rbacService.hasPermission(userId, permission);
  if (!hasPermission) {
    throw redirect({ to: redirectTo });
  }
}

/**
 * Server-side route guard - requires any of the permissions
 * Throws redirect if unauthorized
 */
export async function requireAnyPermission(
  userId: string,
  permissions: Permission[],
  redirectTo: string = '/dashboard'
): Promise<void> {
  const hasPermission = await rbacService.hasAnyPermission(userId, permissions);
  if (!hasPermission) {
    throw redirect({ to: redirectTo });
  }
}

/**
 * Server-side route guard - requires all permissions
 * Throws redirect if unauthorized
 */
export async function requireAllPermissions(
  userId: string,
  permissions: Permission[],
  redirectTo: string = '/dashboard'
): Promise<void> {
  const hasPermission = await rbacService.hasAllPermissions(userId, permissions);
  if (!hasPermission) {
    throw redirect({ to: redirectTo });
  }
}

/**
 * Server-side route guard - requires specific role
 * Throws redirect if unauthorized
 */
export async function requireRole(
  userId: string,
  role: Role,
  redirectTo: string = '/dashboard'
): Promise<void> {
  const hasRole = await rbacService.hasRole(userId, role);
  if (!hasRole) {
    throw redirect({ to: redirectTo });
  }
}

/**
 * Server-side route guard - requires any of the roles
 * Throws redirect if unauthorized
 */
export async function requireAnyRole(
  userId: string,
  roles: Role[],
  redirectTo: string = '/dashboard'
): Promise<void> {
  const hasRole = await rbacService.hasAnyRole(userId, roles);
  if (!hasRole) {
    throw redirect({ to: redirectTo });
  }
}

/**
 * Server-side route guard - requires super admin
 * Throws redirect if unauthorized
 */
export async function requireSuperAdmin(
  userId: string,
  redirectTo: string = '/dashboard'
): Promise<void> {
  const isSuperAdmin = await rbacService.isSuperAdmin(userId);
  if (!isSuperAdmin) {
    throw redirect({ to: redirectTo });
  }
}

/**
 * Check permission without throwing (for conditional rendering)
 * Returns boolean
 */
export async function checkPermission(
  userId: string,
  permission: Permission
): Promise<boolean> {
  return rbacService.hasPermission(userId, permission);
}

/**
 * Check role without throwing (for conditional rendering)
 * Returns boolean
 */
export async function checkRole(
  userId: string,
  role: Role
): Promise<boolean> {
  return rbacService.hasRole(userId, role);
}

/**
 * Permission guard factory for TanStack Router
 * Usage in route beforeLoad:
 * beforeLoad: async ({ context }) => {
 *   await requirePermission(context.userId, Permission.STUDENT_VIEW);
 * }
 */
export function createPermissionGuard(permission: Permission, redirectTo?: string) {
  return async (userId: string) => {
    await requirePermission(userId, permission, redirectTo);
  };
}

/**
 * Role guard factory for TanStack Router
 */
export function createRoleGuard(role: Role, redirectTo?: string) {
  return async (userId: string) => {
    await requireRole(userId, role, redirectTo);
  };
}
