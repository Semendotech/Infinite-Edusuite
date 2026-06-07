import { supabase } from '@/integrations/supabase/client';
import { rbacService } from '@/core/rbac/rbac.service';
import { auditService } from '@/core/audit/audit.service';
import {
  branchRegistry,
  defaultBranchCode,
  getBranchRegistryByCode,
} from '@/config/branch-registry.config';

export interface Branch {
  id: string;
  name: string;
  code: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  is_main_campus?: boolean;
  status?: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  isMainCampus?: boolean;
}

export interface CreateBranchInput {
  name: string;
  code: string;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface UpdateBranchInput {
  name?: string;
  code?: string;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  is_active?: boolean;
  is_main_campus?: boolean;
  status?: string;
}

export interface BranchContext {
  currentBranch: Branch;
  accessibleBranches: Branch[];
  isMultiBranch: boolean;
}

/**
 * Branch Service
 * Handles multi-tenant branch isolation logic
 */
export class BranchService {
  private supabase = supabase;

  private mapBranch(raw: any): Branch | null {
    if (!raw) return null;
    return {
      ...raw,
      isMainCampus: raw.is_main_campus ?? false,
      status: raw.status ?? 'active',
    };
  }

  private mapRegistryEntry(entry: typeof branchRegistry[number]): Branch {
    const now = new Date().toISOString();
    return {
      id: entry.id,
      name: entry.name,
      code: entry.code,
      city: entry.city ?? null,
      address: entry.address ?? null,
      phone: entry.phone ?? null,
      email: entry.email ?? null,
      is_active: entry.status === 'active',
      is_main_campus: entry.isMainCampus,
      status: entry.status,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      isMainCampus: entry.isMainCampus,
    };
  }

  private async getDefaultBranch(): Promise<Branch> {
    const branch = await this.getBranchByCode(defaultBranchCode);
    if (branch) return branch;
    const registryEntry = getBranchRegistryByCode(defaultBranchCode);
    if (!registryEntry) {
      throw new Error(`Default branch registry entry missing for code: ${defaultBranchCode}`);
    }
    return this.mapRegistryEntry(registryEntry);
  }

  /**
   * Get user's accessible branches
   */
  async getUserBranches(userId: string): Promise<Branch[]> {
    try {
      const isSuperAdmin = await rbacService.isSuperAdmin(userId);
      
      if (isSuperAdmin) {
        const { data, error } = await this.supabase
          .from('branches')
          .select('*')
          .eq('is_active', true)
          .is('deleted_at', null);
        
        if (error) throw error;
        const branches = (data || []).map((branch) => this.mapBranch(branch)).filter((b): b is Branch => Boolean(b));
        return branches.length > 0 ? branches : [await this.getDefaultBranch()];
      }
      
      const { data: roles } = await this.supabase
        .from('user_roles')
        .select('branch_id')
        .eq('user_id', userId);
      
      const branchIds = [...new Set(roles?.map((r) => r.branch_id).filter((id): id is string => Boolean(id)) || [])];
      
      if (branchIds.length === 0) {
        const { data: profile } = await this.supabase
          .from('profiles')
          .select('branch_id')
          .eq('id', userId)
          .single();
        
        if (profile?.branch_id) {
          branchIds.push(profile.branch_id);
        }
      }
      
      if (branchIds.length === 0) {
        return [await this.getDefaultBranch()];
      }
      
      const { data, error } = await this.supabase
        .from('branches')
        .select('*')
        .in('id', branchIds)
        .eq('is_active', true)
        .is('deleted_at', null);
      
      if (error) throw error;
      const branches = (data || []).map((branch) => this.mapBranch(branch)).filter((b): b is Branch => Boolean(b));
      return branches.length > 0 ? branches : [await this.getDefaultBranch()];
    } catch (error) {
      console.error('[BranchService] getUserBranches error:', error);
      throw error;
    }
  }

  /**
   * Validate user has access to specific branch
   */
  async validateBranchAccess(userId: string, branchId: string): Promise<boolean> {
    try {
      const isSuperAdmin = await rbacService.isSuperAdmin(userId);
      if (isSuperAdmin) return true;
      
      // Check via user_roles
      const { data: roleAccess } = await this.supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('branch_id', branchId)
        .maybeSingle();
      
      if (roleAccess) return true;
      
      // Check via profile
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .eq('branch_id', branchId)
        .maybeSingle();
      
      return !!profile;
    } catch (error) {
      console.error('[BranchService] validateBranchAccess error:', error);
      return false;
    }
  }

  /**
   * Get current branch context for user
   */
  async getUserBranchContext(userId: string): Promise<BranchContext> {
    const accessibleBranches = await this.getUserBranches(userId);
    const currentBranch =
      accessibleBranches.find((branch) => branch.isMainCampus) ||
      accessibleBranches[0] ||
      (await this.getDefaultBranch());

    return {
      currentBranch,
      accessibleBranches,
      isMultiBranch: accessibleBranches.length > 1,
    };
  }

  async switchBranch(userId: string, branchId: string): Promise<BranchContext> {
    const branch = await this.getBranchById(branchId);
    if (!branch || !branch.is_active) {
      throw new Error('Branch not found or inactive');
    }

    const isSuperAdmin = await rbacService.isSuperAdmin(userId);
    const accessibleBranches = await this.getUserBranches(userId);

    if (!isSuperAdmin && !accessibleBranches.some((entry) => entry.id === branchId)) {
      throw new Error('User does not have access to the selected branch');
    }

    await auditService.log({
      actor_id: userId,
      action: 'branch_switch',
      entity_type: 'branch',
      entity_id: branch.id,
      branch_id: branch.id,
      metadata: {
        selectedBranchCode: branch.code,
        selectedBranchName: branch.name,
      },
    });

    return {
      currentBranch: branch,
      accessibleBranches,
      isMultiBranch: accessibleBranches.length > 1,
    };
  }

  /**
   * Get branch by ID
   */
  async getBranchById(branchId: string): Promise<Branch | null> {
    try {
      const { data, error } = await this.supabase
        .from('branches')
        .select('*')
        .eq('id', branchId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[BranchService] getBranchById error:', error);
      return null;
    }
  }

  /**
   * Get branch by code
   */
  async getBranchByCode(code: string): Promise<Branch | null> {
    try {
      const { data, error } = await this.supabase
        .from('branches')
        .select('*')
        .eq('code', code)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[BranchService] getBranchByCode error:', error);
      return null;
    }
  }

  /**
   * Create branch (super admin only)
   */
  async createBranch(data: CreateBranchInput): Promise<Branch> {
    try {
      const { data: result, error } = await this.supabase
        .from('branches')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    } catch (error) {
      console.error('[BranchService] createBranch error:', error);
      throw error;
    }
  }

  /**
   * Update branch (super admin only)
   */
  async updateBranch(branchId: string, data: UpdateBranchInput): Promise<Branch> {
    try {
      const { data: result, error } = await this.supabase
        .from('branches')
        .update(data)
        .eq('id', branchId)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    } catch (error) {
      console.error('[BranchService] updateBranch error:', error);
      throw error;
    }
  }

  /**
   * Delete branch (soft delete, super admin only)
   */
  async deleteBranch(branchId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('branches')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', branchId);
      
      if (error) throw error;
    } catch (error) {
      console.error('[BranchService] deleteBranch error:', error);
      throw error;
    }
  }
}

// Singleton instance
export const branchService = new BranchService();
