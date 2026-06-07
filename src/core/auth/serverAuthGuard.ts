/**
 * serverAuthGuard - Server Function Protection
 * 
 * Provides authorization protection for TanStack Start server functions.
 * Validates auth session, permissions, and branch context on the server side.
 * 
 * Returns structured error responses instead of raw throws.
 */

import { Permission, Role } from '@/core/rbac/permissions';
import { rbacService } from '@/core/rbac/rbac.service';
import { branchService } from '@/core/branch/branch.service';
import { permissionCache } from '@/core/rbac/permission-cache';

/**
 * Server auth guard configuration
 */
export interface ServerAuthGuardConfig {
  /**
   * Required permissions
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
   */
  roles?: Role[];
  
  /**
   * Whether to require branch access
   */
  requireBranch?: boolean;
}

/**
 * Server auth guard result
 */
export interface ServerAuthGuardResult {
  success: boolean;
  userId?: string;
  permissions?: Permission[];
  roles?: Role[];
  branchIds?: string[];
  error?: {
    code: 'UNAUTHENTICATED' | 'UNAUTHORIZED' | 'NO_BRANCH' | 'INVALID_SESSION';
    message: string;
  };
}

/**
 * Server auth context
 */
export interface ServerAuthContext {
  userId: string;
  permissions: Permission[];
  roles: Role[];
  branchIds: string[];
  isSuperAdmin: boolean;
}

/**
 * Validate server auth context from request
 * 
 * @param request - Server request object
 * @returns Auth context or error
 */
export async function validateServerAuth(request: Request): Promise<ServerAuthGuardResult> {
  try {
    // Extract authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Missing or invalid authorization header',
        },
      };
    }

    const token = authHeader.substring(7);

    // Validate token with Supabase
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return {
        success: false,
        error: {
          code: 'INVALID_SESSION',
          message: 'Invalid or expired session',
        },
      };
    }

    const cachedEntry = permissionCache.get(user.id);
    let permissions: Permission[] = [];
    let userRoles: Role[] = [];

    if (cachedEntry) {
      permissions = cachedEntry.permissions;
      userRoles = cachedEntry.roles;
    } else {
      userRoles = await rbacService.getUserRoles(user.id);
      permissions = await rbacService.getUserPermissions(user.id);
      permissionCache.set(user.id, permissions, userRoles);
    }

    const isSuperAdmin = userRoles.includes(Role.SUPER_ADMIN);

    // Get branch IDs with profile and role context
    const accessibleBranches = await branchService.getUserBranches(user.id);
    const branchIds = accessibleBranches.map((branch) => branch.id);

    return {
      success: true,
      userId: user.id,
      permissions,
      roles: userRoles,
      branchIds,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication validation failed',
      },
    };
  }
}

/**
 * Server auth guard
 * 
 * @param config - Guard configuration
 * @param request - Server request object
 * @returns Guard result
 */
export async function serverAuthGuard(
  config: ServerAuthGuardConfig = {},
  request: Request
): Promise<ServerAuthGuardResult> {
  // Validate auth context
  const authResult = await validateServerAuth(request);
  
  if (!authResult.success) {
    return authResult;
  }

  const { userId, permissions, roles, branchIds } = authResult;
  const isSuperAdmin = (roles || []).includes(Role.SUPER_ADMIN);

  // Super admin bypass
  if (isSuperAdmin) {
    return {
      success: true,
      userId,
      permissions,
      roles,
      branchIds,
    };
  }

  // Check permissions
  if (config.permissions && config.permissions.length > 0) {
    const hasPermission = config.permissionMode === 'all'
      ? config.permissions.every(p => (permissions || []).includes(p))
      : config.permissions.some(p => (permissions || []).includes(p));

    if (!hasPermission) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: `Required permissions: ${config.permissions.join(', ')}`,
        },
      };
    }
  }

  // Check roles
  if (config.roles && config.roles.length > 0) {
    const hasRole = config.roles.some(r => (roles || []).includes(r));

    if (!hasRole) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: `Required roles: ${config.roles.join(', ')}`,
        },
      };
    }
  }

  // Check branch access
  if (config.requireBranch) {
    if (!branchIds || branchIds.length === 0) {
      return {
        success: false,
        error: {
          code: 'NO_BRANCH',
          message: 'Branch context required',
        },
      };
    }
  }

  return {
    success: true,
    userId,
    permissions,
    roles,
    branchIds,
  };
}

/**
 * Wrapper for server functions with auth guard
 * 
 * @param config - Guard configuration
 * @param handler - Server function handler
 * @returns Protected server function
 */
export function withServerAuthGuard<T extends any[], R>(
  config: ServerAuthGuardConfig,
  handler: (auth: ServerAuthContext, ...args: T) => Promise<R>
) {
  return async function (request: Request, ...args: T): Promise<R> {
    const guardResult = await serverAuthGuard(config, request);

    if (!guardResult.success) {
      // Return structured error response
      throw new AuthGuardError(guardResult.error!.code, guardResult.error!.message);
    }

    const auth: ServerAuthContext = {
      userId: guardResult.userId!,
      permissions: guardResult.permissions!,
      roles: guardResult.roles!,
      branchIds: guardResult.branchIds!,
      isSuperAdmin: guardResult.roles!.includes(Role.SUPER_ADMIN),
    };

    return handler(auth, ...args);
  };
}

/**
 * Auth guard error
 */
export class AuthGuardError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthGuardError';
    this.code = code;
  }
}

/**
 * Extract auth context from request
 * 
 * @param request - Server request object
 * @returns Auth context
 */
export async function extractAuthContext(request: Request): Promise<ServerAuthContext> {
  const result = await validateServerAuth(request);

  if (!result.success) {
    throw new AuthGuardError(result.error!.code, result.error!.message);
  }

  return {
    userId: result.userId!,
    permissions: result.permissions || [],
    roles: result.roles || [],
    branchIds: result.branchIds || [],
    isSuperAdmin: (result.roles || []).includes(Role.SUPER_ADMIN),
  };
}
