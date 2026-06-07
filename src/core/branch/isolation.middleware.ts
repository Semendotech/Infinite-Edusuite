import { createMiddleware } from '@tanstack/react-start';
import { branchService } from './branch.service';
import { rbacService } from '../rbac/rbac.service';
import { Role } from '../rbac/permissions';

export interface BranchIsolationContext {
  enabled: boolean;
  branchId: string | null;
  isSuperAdmin: boolean;
}

/**
 * Server middleware to enforce branch isolation
 * Automatically filters queries by branch_id for non-super-admins
 * 
 * Usage: Apply to server functions that need branch isolation
 */
export const withBranchIsolation = createMiddleware({ type: 'function' }).server(
  async ({ next, context }) => {
    const ctx = context as any;
    
    const userId = ctx?.userId;
    const branchId = ctx?.branchId;
    
    if (!userId) {
      throw new Error('Unauthorized: No user context');
    }
    
    // Check if user is super admin
    const isSuperAdmin = await rbacService.isSuperAdmin(userId);
    
    if (isSuperAdmin) {
      // Super admins bypass branch isolation
      return next({
        context: {
          ...ctx,
          branchIsolation: {
            enabled: false,
            branchId: null,
            isSuperAdmin: true,
          } as BranchIsolationContext,
        },
      });
    }
    
    // Validate branch access if branchId is provided
    if (branchId) {
      const hasAccess = await branchService.validateBranchAccess(userId, branchId);
      if (!hasAccess) {
        throw new Error('Unauthorized: Branch access denied');
      }
    }
    
    // Get user's accessible branches
    const accessibleBranches = await branchService.getUserBranches(userId);
    
    if (accessibleBranches.length === 0) {
      throw new Error('Unauthorized: No branch access found');
    }
    
    // Use provided branchId or default to first accessible branch
    const effectiveBranchId = branchId || accessibleBranches[0].id;
    
    return next({
      context: {
        ...ctx,
        branchIsolation: {
          enabled: true,
          branchId: effectiveBranchId,
          isSuperAdmin: false,
        } as BranchIsolationContext,
        accessibleBranches,
      },
    });
  }
);

/**
 * Request middleware to inject branch context
 * Runs before route loaders
 */
export const branchContextMiddleware = createMiddleware().server(
  async ({ next, context }) => {
    const ctx = context as any;
    const userId = ctx?.userId;
    
    if (!userId) {
      return next();
    }
    
    try {
      const branchContext = await branchService.getUserBranchContext(userId);
      
      return next({
        context: {
          ...ctx,
          branchContext,
        },
      });
    } catch (error) {
      console.error('[BranchContextMiddleware] Error:', error);
      // Continue without branch context if there's an error
      return next();
    }
  }
);
