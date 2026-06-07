/**
 * usePermissions Hook
 * 
 * Provides permission checking functionality for RBAC-driven UI components.
 * Integrates with the unified auth context manager for single source of truth.
 * 
 * This hook:
 * - Reads permissions from unified auth context manager
 * - Provides hasPermission() and hasRole() methods
 * - Caches permission checks for performance
 * - Supports permission-based rendering
 */

import { useRouteContext } from '@tanstack/react-router';
import { Permission, Role } from '@/core/rbac/permissions';
import { authContextManager } from '@/core/auth/authContextManager';

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  hasRole: (role: Role) => boolean;
  hasAnyRole: (roles: Role[]) => boolean;
  permissions: Permission[];
  roles: Role[];
  isSuperAdmin: boolean;
  isLoading: boolean;
}

/**
 * usePermissions hook
 * 
 * Uses the unified auth context manager as the single source of truth.
 * Falls back to TanStack auth context for backward compatibility.
 */
export function usePermissions(): PermissionCheckResult {
  const routeContext = useRouteContext({ strict: false });
  const auth = routeContext.auth as any;

  // Try to use unified auth context manager first
  const unifiedContext = authContextManager.getContext();

  // Use unified context if available, otherwise fall back to TanStack auth
  const permissions = unifiedContext?.permissions || auth?.permissions || [];
  const roles = unifiedContext?.roles || auth?.roles || [];
  const isSuperAdmin = unifiedContext?.isSuperAdmin || auth?.isSuperAdmin || false;
  const isLoading = !auth?.user && !unifiedContext;

  /**
   * Check if user has a specific permission
   */
  const hasPermission = (permission: Permission): boolean => {
    if (isSuperAdmin) return true;
    return permissions.includes(permission);
  };

  /**
   * Check if user has any of the specified permissions
   */
  const hasAnyPermission = (requiredPermissions: Permission[]): boolean => {
    if (isSuperAdmin) return true;
    return requiredPermissions.some(permission => permissions.includes(permission));
  };

  /**
   * Check if user has all of the specified permissions
   */
  const hasAllPermissions = (requiredPermissions: Permission[]): boolean => {
    if (isSuperAdmin) return true;
    return requiredPermissions.every(permission => permissions.includes(permission));
  };

  /**
   * Check if user has a specific role
   */
  const hasRole = (role: Role): boolean => {
    return roles.includes(role);
  };

  /**
   * Check if user has any of the specified roles
   */
  const hasAnyRole = (requiredRoles: Role[]): boolean => {
    return requiredRoles.some(role => roles.includes(role));
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    permissions,
    roles,
    isSuperAdmin,
    isLoading,
  };
}
