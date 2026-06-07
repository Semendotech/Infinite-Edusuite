/**
 * withPermissionGuard - Route Configuration Enhancer
 * 
 * Wraps TanStack Start route definitions with permission-based protection.
 * Provides a declarative way to protect routes using metadata.
 * 
 * Usage:
 * const Route = createFileRoute('/students')(
 *   withPermissionGuard({
 *     permissions: [Permission.STUDENT_VIEW],
 *     permissionMode: 'any',
 *   })
 * )
 */

import { Permission, Role } from '@/core/rbac/permissions';
import { executeAuthGuard, AuthGuardConfig } from './createAuthGuard';

/**
 * Permission guard route configuration
 */
export interface PermissionGuardConfig extends AuthGuardConfig {
  /**
   * Required permissions
   */
  permissions?: Permission[];
  
  /**
   * Permission check mode
   * - 'any': user needs at least one permission (default)
   * - 'all': user needs all permissions
   */
  permissionMode?: 'any' | 'all';
  
  /**
   * Required roles (optional override)
   */
  roles?: Role[];
  
  /**
   * Whether to require branch access
   */
  requireBranch?: boolean;
  
  /**
   * Custom redirect destination
   */
  redirectTo?: string;
}

/**
 * Route configuration with permission metadata
 */
export interface RouteConfigWithPermissions {
  meta?: {
    permissions?: Permission[];
    permissionMode?: 'any' | 'all';
    roles?: Role[];
    requireBranch?: boolean;
    redirectTo?: string;
  };
}

/**
 * withPermissionGuard - Route configuration enhancer
 * 
 * Wraps a route configuration object with permission-based protection.
 * Automatically adds beforeLoad guard and metadata.
 * 
 * @param config - Permission guard configuration
 * @returns Route configuration with guard
 */
export function withPermissionGuard<T extends Record<string, any>>(
  config: PermissionGuardConfig
): (routeConfig: T) => T & {
  beforeLoad: (ctx: any) => void;
  meta: RouteConfigWithPermissions['meta'];
} {
  return function (routeConfig: T) {
    const guardConfig: AuthGuardConfig = {
      permissions: config.permissions,
      permissionMode: config.permissionMode || 'any',
      roles: config.roles,
      requireBranch: config.requireBranch,
      redirectTo: config.redirectTo,
    };

    return {
      ...routeConfig,
      beforeLoad: (ctx: any) => {
        // Execute auth guard
        executeAuthGuard(guardConfig, ctx);
        
        // Call existing beforeLoad if present
        if (routeConfig.beforeLoad) {
          routeConfig.beforeLoad(ctx);
        }
      },
      meta: {
        ...routeConfig.meta,
        permissions: config.permissions,
        permissionMode: config.permissionMode || 'any',
        roles: config.roles,
        requireBranch: config.requireBranch,
        redirectTo: config.redirectTo,
      },
    };
  };
}

/**
 * Permission guard for single permission
 * 
 * @param permission - Required permission
 * @returns Route configuration enhancer
 */
export function withPermission(permission: Permission) {
  return withPermissionGuard({
    permissions: [permission],
    permissionMode: 'any',
  });
}

/**
 * Permission guard for multiple permissions (ANY mode)
 * 
 * @param permissions - Required permissions (any of these)
 * @returns Route configuration enhancer
 */
export function withAnyPermission(permissions: Permission[]) {
  return withPermissionGuard({
    permissions,
    permissionMode: 'any',
  });
}

/**
 * Permission guard for multiple permissions (ALL mode)
 * 
 * @param permissions - Required permissions (all of these)
 * @returns Route configuration enhancer
 */
export function withAllPermissions(permissions: Permission[]) {
  return withPermissionGuard({
    permissions,
    permissionMode: 'all',
  });
}

/**
 * Permission guard for role-based access
 * 
 * @param roles - Required roles (any of these)
 * @returns Route configuration enhancer
 */
export function withRole(roles: Role[]) {
  return withPermissionGuard({
    roles,
  });
}

/**
 * Permission guard for branch access
 * 
 * @returns Route configuration enhancer
 */
export function withBranchAccess() {
  return withPermissionGuard({
    requireBranch: true,
  });
}

/**
 * Permission guard for super admin only
 * 
 * @returns Route configuration enhancer
 */
export function withSuperAdmin() {
  return withPermissionGuard({
    roles: [Role.SUPER_ADMIN],
  });
}

/**
 * Extract permissions from route metadata
 * 
 * @param routeConfig - Route configuration
 * @returns Permission guard configuration
 */
export function extractPermissionsFromMeta(routeConfig: RouteConfigWithPermissions): PermissionGuardConfig {
  const meta = routeConfig.meta || {};
  
  return {
    permissions: meta.permissions,
    permissionMode: meta.permissionMode || 'any',
    roles: meta.roles,
    requireBranch: meta.requireBranch,
    redirectTo: meta.redirectTo,
  };
}
