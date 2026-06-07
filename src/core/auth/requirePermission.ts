/**
 * requirePermission - Server-Side Permission Helper
 * 
 * Utility for checking permissions on the server side.
 * Uses RBAC service and permission cache for performance.
 * 
 * Returns structured failure or throws controlled error.
 */

import { Permission, Role } from '@/core/rbac/permissions';
import { rbacService } from '@/core/rbac/rbac.service';
import { permissionCache } from '@/core/rbac/permission-cache';
import { AuthGuardError } from './serverAuthGuard';

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  hasPermission: boolean;
  userId: string;
  permissions: Permission[];
  roles: Role[];
  isSuperAdmin: boolean;
}

/**
 * Require permission for a user
 * 
 * @param userId - User ID
 * @param permission - Required permission
 * @returns Permission check result
 * @throws AuthGuardError if permission check fails
 */
export async function requirePermission(
  userId: string,
  permission: Permission
): Promise<PermissionCheckResult> {
  // Get permissions from cache or service
  let permissions = permissionCache.getPermissions(userId);
  let roles: Role[] = [];

  if (!permissions || permissions.length === 0) {
    // Fetch from service
    permissions = await rbacService.getUserPermissions(userId);
    
    // Get roles from service
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      roles = (roleData?.map(r => r.role) || []) as Role[];
      
      // Cache permissions with roles
      permissionCache.set(userId, permissions, roles);
    } catch (error) {
      console.error('Failed to fetch user roles:', error);
    }
  } else {
    // Get cached roles
    roles = permissionCache.getRoles(userId) || [];
  }

  const isSuperAdmin = roles.includes(Role.SUPER_ADMIN);

  // Super admin bypass
  if (isSuperAdmin) {
    return {
      hasPermission: true,
      userId,
      permissions,
      roles,
      isSuperAdmin,
    };
  }

  // Check permission
  if (!permissions.includes(permission)) {
    throw new AuthGuardError(
      'UNAUTHORIZED',
      `Required permission: ${permission}`
    );
  }

  return {
    hasPermission: true,
    userId,
    permissions,
    roles,
    isSuperAdmin,
  };
}

/**
 * Require any of the specified permissions
 * 
 * @param userId - User ID
 * @param permissions - Required permissions (any of these)
 * @returns Permission check result
 * @throws AuthGuardError if permission check fails
 */
export async function requireAnyPermission(
  userId: string,
  permissions: Permission[]
): Promise<PermissionCheckResult> {
  // Get permissions from cache or service
  let userPermissions = permissionCache.getPermissions(userId);
  let roles: Role[] = [];

  if (!userPermissions || userPermissions.length === 0) {
    userPermissions = await rbacService.getUserPermissions(userId);
    
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      roles = (roleData?.map(r => r.role) || []) as Role[];
      permissionCache.set(userId, userPermissions, roles);
    } catch (error) {
      console.error('Failed to fetch user roles:', error);
    }
  } else {
    roles = permissionCache.getRoles(userId) || [];
  }

  const isSuperAdmin = roles.includes(Role.SUPER_ADMIN);

  // Super admin bypass
  if (isSuperAdmin) {
    return {
      hasPermission: true,
      userId,
      permissions: userPermissions,
      roles,
      isSuperAdmin,
    };
  }

  // Check if user has any of the required permissions
  const hasPermission = permissions.some(p => userPermissions.includes(p));

  if (!hasPermission) {
    throw new AuthGuardError(
      'UNAUTHORIZED',
      `Required permissions: ${permissions.join(', ')}`
    );
  }

  return {
    hasPermission: true,
    userId,
    permissions: userPermissions,
    roles,
    isSuperAdmin,
  };
}

/**
 * Require all of the specified permissions
 * 
 * @param userId - User ID
 * @param permissions - Required permissions (all of these)
 * @returns Permission check result
 * @throws AuthGuardError if permission check fails
 */
export async function requireAllPermissions(
  userId: string,
  permissions: Permission[]
): Promise<PermissionCheckResult> {
  // Get permissions from cache or service
  let userPermissions = permissionCache.getPermissions(userId);
  let roles: Role[] = [];

  if (!userPermissions || userPermissions.length === 0) {
    userPermissions = await rbacService.getUserPermissions(userId);
    
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      roles = (roleData?.map(r => r.role) || []) as Role[];
      permissionCache.set(userId, userPermissions, roles);
    } catch (error) {
      console.error('Failed to fetch user roles:', error);
    }
  } else {
    roles = permissionCache.getRoles(userId) || [];
  }

  const isSuperAdmin = roles.includes(Role.SUPER_ADMIN);

  // Super admin bypass
  if (isSuperAdmin) {
    return {
      hasPermission: true,
      userId,
      permissions: userPermissions,
      roles,
      isSuperAdmin,
    };
  }

  // Check if user has all of the required permissions
  const hasPermission = permissions.every(p => userPermissions.includes(p));

  if (!hasPermission) {
    throw new AuthGuardError(
      'UNAUTHORIZED',
      `Required permissions: ${permissions.join(', ')}`
    );
  }

  return {
    hasPermission: true,
    userId,
    permissions: userPermissions,
    roles,
    isSuperAdmin,
  };
}

/**
 * Require role
 * 
 * @param userId - User ID
 * @param role - Required role
 * @returns Permission check result
 * @throws AuthGuardError if role check fails
 */
export async function requireRole(
  userId: string,
  role: Role
): Promise<PermissionCheckResult> {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    const roles = (roleData?.map(r => r.role) || []) as Role[];
    const isSuperAdmin = roles.includes(Role.SUPER_ADMIN);

    // Super admin bypass
    if (isSuperAdmin) {
      return {
        hasPermission: true,
        userId,
        permissions: permissionCache.getPermissions(userId) || [],
        roles,
        isSuperAdmin,
      };
    }

    // Check role
    if (!roles.includes(role)) {
      throw new AuthGuardError(
        'UNAUTHORIZED',
        `Required role: ${role}`
      );
    }

    return {
      hasPermission: true,
      userId,
      permissions: permissionCache.getPermissions(userId) || [],
      roles,
      isSuperAdmin,
    };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      throw error;
    }
    
    throw new AuthGuardError(
      'UNAUTHORIZED',
      'Failed to verify role'
    );
  }
}

/**
 * Check permission without throwing
 * 
 * @param userId - User ID
 * @param permission - Required permission
 * @returns Permission check result
 */
export async function checkPermission(
  userId: string,
  permission: Permission
): Promise<PermissionCheckResult> {
  try {
    return await requirePermission(userId, permission);
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return {
        hasPermission: false,
        userId,
        permissions: [],
        roles: [],
        isSuperAdmin: false,
      };
    }
    
    return {
      hasPermission: false,
      userId,
      permissions: [],
      roles: [],
      isSuperAdmin: false,
    };
  }
}

/**
 * Check any permission without throwing
 * 
 * @param userId - User ID
 * @param permissions - Required permissions (any of these)
 * @returns Permission check result
 */
export async function checkAnyPermission(
  userId: string,
  permissions: Permission[]
): Promise<PermissionCheckResult> {
  try {
    return await requireAnyPermission(userId, permissions);
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return {
        hasPermission: false,
        userId,
        permissions: [],
        roles: [],
        isSuperAdmin: false,
      };
    }
    
    return {
      hasPermission: false,
      userId,
      permissions: [],
      roles: [],
      isSuperAdmin: false,
    };
  }
}
