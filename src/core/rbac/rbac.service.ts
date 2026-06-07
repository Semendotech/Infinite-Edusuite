import { supabase } from '@/integrations/supabase/client';
import { Permission, Role, ROLE_PERMISSIONS } from './permissions';

/**
 * RBAC Service
 * Centralized service for role-based access control operations
 */
export class RBACService {
  private supabase = supabase;

  /**
   * Check if user has specific permission
   */
  async hasPermission(userId: string, permission: Permission): Promise<boolean> {
    try {
      const { data: roles } = await this.supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      if (!roles || roles.length === 0) return false;
      
      const userRoles = roles.map(r => r.role as Role);
      return userRoles.some(role => 
        ROLE_PERMISSIONS[role]?.includes(permission)
      );
    } catch (error) {
      console.error('[RBACService] hasPermission error:', error);
      return false;
    }
  }

  /**
   * Check if user has any of the specified permissions
   */
  async hasAnyPermission(userId: string, permissions: Permission[]): Promise<boolean> {
    if (permissions.length === 0) return false;
    
    const results = await Promise.all(
      permissions.map(p => this.hasPermission(userId, p))
    );
    return results.some(Boolean);
  }

  /**
   * Check if user has all specified permissions
   */
  async hasAllPermissions(userId: string, permissions: Permission[]): Promise<boolean> {
    if (permissions.length === 0) return true;
    
    const results = await Promise.all(
      permissions.map(p => this.hasPermission(userId, p))
    );
    return results.every(Boolean);
  }

  /**
   * Get user's roles
   */
  async getUserRoles(userId: string): Promise<Role[]> {
    try {
      console.log('[RBACService] Fetching roles for user:', userId);
      
      const { data: roles } = await this.supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      const userRoles = roles?.map(r => r.role as Role) || [];
      console.log('[RBACService] User roles:', userRoles);
      
      return userRoles;
    } catch (error) {
      console.error('[RBACService] getUserRoles error:', error);
      return [];
    }
  }

  /**
   * Check if user has specific role
   */
  async hasRole(userId: string, role: Role): Promise<boolean> {
    const roles = await this.getUserRoles(userId);
    return roles.includes(role);
  }

  /**
   * Check if user has any of the specified roles
   */
  async hasAnyRole(userId: string, roles: Role[]): Promise<boolean> {
    if (roles.length === 0) return false;
    
    const userRoles = await this.getUserRoles(userId);
    return roles.some(role => userRoles.includes(role));
  }

  /**
   * Get user's roles with branch context
   */
  async getUserRolesWithBranch(userId: string): Promise<Array<{ role: Role; branchId: string | null }>> {
    try {
      const { data: roles } = await this.supabase
        .from('user_roles')
        .select('role, branch_id')
        .eq('user_id', userId);
      
      return roles?.map(r => ({
        role: r.role as Role,
        branchId: r.branch_id,
      })) || [];
    } catch (error) {
      console.error('[RBACService] getUserRolesWithBranch error:', error);
      return [];
    }
  }

  /**
   * Assign role to user
   */
  async assignRole(userId: string, role: Role, branchId?: string): Promise<void> {
    try {
      const { error } = await this.supabase.from('user_roles').insert({
        user_id: userId,
        role,
        branch_id: branchId,
      })
      .onConflict(['user_id', 'role', 'branch_id'])
      .ignore();
      
      if (error) throw error;
    } catch (error) {
      console.error('[RBACService] assignRole error:', error);
      throw error;
    }
  }

  /**
   * Remove role from user
   */
  async removeRole(userId: string, role: Role, branchId?: string): Promise<void> {
    try {
      let query = this.supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);
      
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      
      const { error } = await query;
      
      if (error) throw error;
    } catch (error) {
      console.error('[RBACService] removeRole error:', error);
      throw error;
    }
  }

  /**
   * Get all permissions for a user
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    try {
      console.log('[RBACService] Fetching permissions for user:', userId);
      
      // Use database function to get permissions
      const { data, error } = await this.supabase
        .rpc('get_user_permissions', { _user_id: userId });
      
      if (error) {
        console.error('[RBACService] Database error fetching permissions:', error);
        // Fallback to TypeScript mapping if database function fails
        console.log('[RBACService] Falling back to TypeScript mapping');
        const roles = await this.getUserRoles(userId);
        const permissions = new Set<Permission>();
        roles.forEach(role => {
          ROLE_PERMISSIONS[role]?.forEach(p => permissions.add(p));
        });
        return Array.from(permissions);
      }
      
      const permissions = (data || []).map((p: any) => p.permission_name as Permission);
      console.log('[RBACService] User permissions:', permissions);
      
      return permissions;
    } catch (error) {
      console.error('[RBACService] getUserPermissions error:', error);
      // Fallback to TypeScript mapping
      const roles = await this.getUserRoles(userId);
      const permissions = new Set<Permission>();
      roles.forEach(role => {
        ROLE_PERMISSIONS[role]?.forEach(p => permissions.add(p));
      });
      return Array.from(permissions);
    }
  }

  /**
   * Check if user is super admin
   */
  async isSuperAdmin(userId: string): Promise<boolean> {
    return this.hasRole(userId, Role.SUPER_ADMIN);
  }

  /**
   * Get branches where user has specific role
   */
  async getBranchesForRole(userId: string, role: Role): Promise<string[]> {
    try {
      const { data: roles } = await this.supabase
        .from('user_roles')
        .select('branch_id')
        .eq('user_id', userId)
        .eq('role', role);
      
      return roles?.map(r => r.branch_id).filter(Boolean) as string[] || [];
    } catch (error) {
      console.error('[RBACService] getBranchesForRole error:', error);
      return [];
    }
  }

  /**
   * Get all branches where user has any role
   */
  async getUserBranches(userId: string): Promise<string[]> {
    try {
      const { data: roles } = await this.supabase
        .from('user_roles')
        .select('branch_id')
        .eq('user_id', userId);
      
      const branchIds = new Set<string>();
      roles?.forEach(r => {
        if (r.branch_id) branchIds.add(r.branch_id);
      });
      
      return Array.from(branchIds);
    } catch (error) {
      console.error('[RBACService] getUserBranches error:', error);
      return [];
    }
  }

  /**
   * Sync user roles (replace all roles with new set)
   */
  async syncUserRoles(
    userId: string,
    roles: Array<{ role: Role; branchId?: string }>
  ): Promise<void> {
    try {
      // Delete existing roles
      await this.supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      
      // Insert new roles
      if (roles.length > 0) {
        await this.supabase.from('user_roles').insert(
          roles.map(r => ({
            user_id: userId,
            role: r.role,
            branch_id: r.branchId,
          }))
        );
      }
    } catch (error) {
      console.error('[RBACService] syncUserRoles error:', error);
      throw error;
    }
  }
}

// Singleton instance
export const rbacService = new RBACService();
