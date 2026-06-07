/**
 * createAuthGuard - Core Route Protection Utility
 * 
 * Provides unified route-level protection for TanStack Start routes.
 * Enforces authentication, permissions, roles, and branch access.
 * 
 * This is the single source of truth for route authorization.
 */

import { redirect } from '@tanstack/react-router';
import { Permission, Role } from '@/core/rbac/permissions';

/**
 * Auth guard configuration
 */
export interface AuthGuardConfig {
  /**
   * Required permissions (ANY mode by default)
   * Pass empty array for no permission requirement
   */
  permissions?: Permission[];
  
  /**
   * Permission check mode
   * - 'any': user needs at least one permission
   * - 'all': user needs all permissions
   */
  permissionMode?: 'any' | 'all';
  
  /**
   * Required roles (optional override)
   * If specified, user must have at least one of these roles
   */
  roles?: Role[];
  
  /**
   * Whether to require branch access
   * If true, user must have a valid branch context
   */
  requireBranch?: boolean;
  
  /**
   * Redirect destination on unauthorized access
   * Default: '/login' if not authenticated, '/dashboard' if authenticated but unauthorized
   */
  redirectTo?: string;
  
  /**
   * Whether to emit audit event on unauthorized access
   */
  logUnauthorized?: boolean;
}

/**
 * Auth guard result
 */
export interface AuthGuardResult {
  authorized: boolean;
  reason?: 'unauthenticated' | 'unauthorized' | 'no_branch';
  redirect?: string;
}

/**
 * Create an auth guard function for route protection
 * 
 * @param config - Guard configuration
 * @returns Guard function that can be used in route beforeLoad
 */
export function createAuthGuard(config: AuthGuardConfig = {}) {
  return function guard(context: {
    auth: {
      isAuthenticated: boolean;
      user?: {
        id: string;
        permissions: Permission[];
        roles: Role[];
        branchIds: string[];
      };
      isSuperAdmin: boolean;
    };
    location: {
      href: string;
    };
  }): AuthGuardResult {
    const { auth, location } = context;
    
    // Check authentication
    if (!auth.isAuthenticated) {
      if (config.logUnauthorized) {
        console.warn('[AuthGuard] Unauthenticated access attempt:', location.href);
      }
      
      return {
        authorized: false,
        reason: 'unauthenticated',
        redirect: config.redirectTo || '/login',
      };
    }
    
    const user = auth.user;
    if (!user) {
      return {
        authorized: false,
        reason: 'unauthenticated',
        redirect: config.redirectTo || '/login',
      };
    }
    
    // Super admin bypass
    if (auth.isSuperAdmin) {
      return { authorized: true };
    }
    
    // Check permissions
    if (config.permissions && config.permissions.length > 0) {
      const hasPermission = config.permissionMode === 'all'
        ? config.permissions.every(p => user.permissions.includes(p))
        : config.permissions.some(p => user.permissions.includes(p));
      
      if (!hasPermission) {
        if (config.logUnauthorized) {
          console.warn('[AuthGuard] Unauthorized access attempt:', {
            location: location.href,
            required: config.permissions,
            userPermissions: user.permissions,
          });
        }
        
        return {
          authorized: false,
          reason: 'unauthorized',
          redirect: config.redirectTo || '/dashboard',
        };
      }
    }
    
    // Check roles
    if (config.roles && config.roles.length > 0) {
      const hasRole = config.roles.some(r => user.roles.includes(r));
      
      if (!hasRole) {
        if (config.logUnauthorized) {
          console.warn('[AuthGuard] Unauthorized role access attempt:', {
            location: location.href,
            required: config.roles,
            userRoles: user.roles,
          });
        }
        
        return {
          authorized: false,
          reason: 'unauthorized',
          redirect: config.redirectTo || '/dashboard',
        };
      }
    }
    
    // Check branch access
    if (config.requireBranch) {
      if (!user.branchIds || user.branchIds.length === 0) {
        if (config.logUnauthorized) {
          console.warn('[AuthGuard] No branch context:', {
            location: location.href,
            userId: user.id,
          });
        }
        
        return {
          authorized: false,
          reason: 'no_branch',
          redirect: config.redirectTo || '/dashboard',
        };
      }
    }
    
    return { authorized: true };
  };
}

/**
 * Execute auth guard with redirect
 * 
 * @param config - Guard configuration
 * @param context - Route context
 * @throws Redirect if unauthorized
 */
export function executeAuthGuard(
  config: AuthGuardConfig,
  context: {
    auth: {
      isAuthenticated: boolean;
      user?: {
        id: string;
        permissions: Permission[];
        roles: Role[];
        branchIds: string[];
      };
      isSuperAdmin: boolean;
    };
    location: {
      href: string;
    };
  }
): void {
  const guard = createAuthGuard(config);
  const result = guard(context);
  
  if (!result.authorized) {
    throw redirect({
      to: result.redirect || '/login',
      search: result.reason === 'unauthenticated' 
        ? { redirect: context.location.href }
        : undefined,
    });
  }
}

/**
 * Common guard configurations
 */
export const commonGuards = {
  /**
   * Require authentication only
   */
  authenticated: {
    permissions: [],
  },
  
  /**
   * Require super admin
   */
  superAdmin: {
    roles: [Role.SUPER_ADMIN],
  },
  
  /**
   * Require branch admin
   */
  branchAdmin: {
    roles: [Role.BRANCH_ADMIN, Role.SUPER_ADMIN],
  },
  
  /**
   * Require branch access
   */
  branchAccess: {
    requireBranch: true,
  },
};
