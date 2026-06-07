/**
 * Auth Context Alignment Manager
 * 
 * Ensures all systems consume the SAME source of truth for permissions:
 * - usePermissions hook
 * - sidebar system
 * - route guards
 * - server functions
 * 
 * NO duplicate permission logic anywhere.
 * 
 * This is the single source of truth for:
 * - User authentication state
 * - User permissions
 * - User roles
 * - Branch context
 * - Super admin status
 */

import { useSyncExternalStore } from 'react';
import { Permission, Role } from '@/core/rbac/permissions';
import { permissionCache } from '@/core/rbac/permission-cache';
import type { BranchContext } from '@/core/branch/branch.service';

/**
 * Unified auth context
 * This is the single source of truth for all auth-related data
 */
export interface UnifiedAuthContext {
  isAuthenticated: boolean;
  userId?: string;
  email?: string;
  fullName?: string;
  avatarUrl?: string;
  permissions: Permission[];
  roles: Role[];
  branchIds: string[];
  isSuperAdmin: boolean;
  branchContext?: BranchContext;
}

/**
 * Auth context manager
 * Provides centralized access to auth context
 */
class AuthContextManager {
  private context: UnifiedAuthContext | null = null;
  private listeners: Set<(context: UnifiedAuthContext | null) => void> = new Set();

  /**
   * Set the auth context
   * This should be called once from the root route
   */
  setContext(context: UnifiedAuthContext | null): void {
    this.context = context;
    this.notifyListeners();
  }

  /**
   * Get the current auth context
   */
  getContext(): UnifiedAuthContext | null {
    return this.context;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.context?.isAuthenticated || false;
  }

  /**
   * Get user ID
   */
  getUserId(): string | undefined {
    return this.context?.userId;
  }

  /**
   * Get user permissions
   */
  getPermissions(): Permission[] {
    return this.context?.permissions || [];
  }

  /**
   * Get user roles
   */
  getRoles(): Role[] {
    return this.context?.roles || [];
  }

  /**
   * Check if user has a specific permission
   */
  hasPermission(permission: Permission): boolean {
    if (this.context?.isSuperAdmin) return true;
    return this.context?.permissions.includes(permission) || false;
  }

  /**
   * Check if user has any of the specified permissions
   */
  hasAnyPermission(permissions: Permission[]): boolean {
    if (this.context?.isSuperAdmin) return true;
    return permissions.some(p => this.context?.permissions.includes(p));
  }

  /**
   * Check if user has all of the specified permissions
   */
  hasAllPermissions(permissions: Permission[]): boolean {
    if (this.context?.isSuperAdmin) return true;
    return permissions.every(p => this.context?.permissions.includes(p));
  }

  /**
   * Check if user has a specific role
   */
  hasRole(role: Role): boolean {
    return this.context?.roles.includes(role) || false;
  }

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(roles: Role[]): boolean {
    return roles.some(r => this.context?.roles.includes(r));
  }

  /**
   * Check if user is super admin
   */
  isSuperAdmin(): boolean {
    return this.context?.isSuperAdmin || false;
  }

  /**
   * Get branch IDs
   */
  getBranchIds(): string[] {
    return this.context?.branchIds || [];
  }

  /**
   * Check if user has branch access
   */
  hasBranchAccess(): boolean {
    return (this.context?.branchIds?.length || 0) > 0;
  }

  /**
   * Get current branch context
   */
  getBranchContext(): UnifiedAuthContext['branchContext'] {
    return this.context?.branchContext;
  }

  /**
   * Subscribe to auth context changes
   */
  subscribe(listener: (context: UnifiedAuthContext | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of context changes
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.context);
    }
  }

  /**
   * Clear the auth context
   */
  clearContext(): void {
    this.context = null;
    this.notifyListeners();
  }

  /**
   * Invalidate permission cache for current user
   */
  async invalidatePermissions(): Promise<void> {
    const userId = this.getUserId();
    if (userId) {
      permissionCache.invalidate(userId);
    }
  }

  /**
   * Refresh permissions from cache or service
   */
  async refreshPermissions(): Promise<void> {
    const userId = this.getUserId();
    if (!userId || !this.context) return;

    let permissions = permissionCache.getPermissions(userId);
    
    if (!permissions || permissions.length === 0) {
      // Fetch from RBAC service
      const { rbacService } = await import('@/core/rbac/rbac.service');
      permissions = await rbacService.getUserPermissions(userId);
      permissionCache.set(userId, permissions, this.context.roles);
    }

    // Update context with fresh permissions
    this.context = {
      ...this.context,
      permissions,
    };

    this.notifyListeners();
  }
}

// Singleton instance
export const authContextManager = new AuthContextManager();

/**
 * Hook to access unified auth context
 * This is the single source of truth for all auth-related data
 */
export function useUnifiedAuthContext(): UnifiedAuthContext | null {
  return useSyncExternalStore(
    (listener) => authContextManager.subscribe(listener),
    () => authContextManager.getContext(),
    () => null,
  );
}

/**
 * Hook to check permissions
 * This is the single source of truth for permission checks
 */
export function useUnifiedPermissions() {
  const context = useUnifiedAuthContext();

  return {
    hasPermission: (permission: Permission) => authContextManager.hasPermission(permission),
    hasAnyPermission: (permissions: Permission[]) => authContextManager.hasAnyPermission(permissions),
    hasAllPermissions: (permissions: Permission[]) => authContextManager.hasAllPermissions(permissions),
    hasRole: (role: Role) => authContextManager.hasRole(role),
    hasAnyRole: (roles: Role[]) => authContextManager.hasAnyRole(roles),
    isSuperAdmin: authContextManager.isSuperAdmin(),
    permissions: context?.permissions || [],
    roles: context?.roles || [],
    isAuthenticated: context?.isAuthenticated || false,
  };
}

/**
 * Initialize auth context from TanStack auth context
 * This should be called from the root route
 */
export function initializeAuthContext(auth: {
  isAuthenticated: boolean;
  user?: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl?: string;
    permissions: Permission[];
    roles: Role[];
    branchIds: string[];
  };
  branchContext?: BranchContext | null;
  isSuperAdmin: boolean;
}): void {
  const context: UnifiedAuthContext = {
    isAuthenticated: auth.isAuthenticated,
    userId: auth.user?.id,
    email: auth.user?.email,
    fullName: auth.user?.fullName,
    avatarUrl: auth.user?.avatarUrl,
    permissions: auth.user?.permissions || [],
    roles: auth.user?.roles || [],
    branchIds: auth.user?.branchIds || [],
    branchContext: auth.branchContext || undefined,
    isSuperAdmin: auth.isSuperAdmin,
  };

  authContextManager.setContext(context);
}

/**
 * Server-side auth context extractor
 * Use this in server functions to get auth context
 */
export async function getServerAuthContext(request: Request): Promise<UnifiedAuthContext> {
  const { validateServerAuth } = await import('./serverAuthGuard');
  const result = await validateServerAuth(request);

  if (!result.success) {
    throw new Error(result.error?.message || 'Authentication failed');
  }

  return {
    isAuthenticated: true,
    userId: result.userId,
    permissions: result.permissions || [],
    roles: result.roles || [],
    branchIds: result.branchIds || [],
    isSuperAdmin: (result.roles || []).includes(Role.SUPER_ADMIN),
  };
}
