/**
 * Analytics Service
 * Provides analytics and insights using audit logs
 * Demonstrates how to use the audit logging system for analytics
 */

import { BaseService, ServiceOptions } from '../base.service';
import { RequestContext } from '@/core/context/request-context';
import { Permission } from '@/core/rbac/permissions';
import { auditService } from '@/core/audit/audit.service';

/**
 * Analytics metrics
 */
export interface AnalyticsMetrics {
  totalActions: number;
  actionsByType: Record<string, number>;
  actionsByEntity: Record<string, number>;
  actionsByUser: Record<string, number>;
  actionsByBranch: Record<string, number>;
  actionsOverTime: Array<{ date: string; count: number }>;
  topActions: Array<{ action: string; count: number }>;
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    actorId: string | null;
    branchId: string | null;
    createdAt: string;
  }>;
}

/**
 * User activity summary
 */
export interface UserActivitySummary {
  userId: string;
  totalActions: number;
  actionsByType: Record<string, number>;
  lastActivity: string | null;
  mostCommonAction: string;
}

/**
 * Branch activity summary
 */
export interface BranchActivitySummary {
  branchId: string;
  totalActions: number;
  actionsByType: Record<string, number>;
  activeUsers: number;
}

/**
 * Analytics Service
 */
export class AnalyticsService extends BaseService {
  public auditService = auditService;

  /**
   * Get analytics metrics for a branch
   */
  async getBranchAnalytics(branchId: string, context: RequestContext): Promise<AnalyticsMetrics> {
    this.requirePermission(context, Permission.AUDIT_VIEW);

    if (!this.validateBranchAccess(context, branchId)) {
      throw new Error('You do not have access to this branch');
    }

    const logs = await this.auditService.getBranchLogs(branchId, 1000);

    return this.calculateMetrics(logs);
  }

  /**
   * Get analytics metrics for a user
   */
  async getUserAnalytics(userId: string, context: RequestContext): Promise<UserActivitySummary> {
    this.requirePermission(context, Permission.AUDIT_VIEW);

    const logs = await this.auditService.getActorLogs(userId, 100);

    const actionsByType: Record<string, number> = {};
    let totalActions = 0;
    let lastActivity: string | null = null;

    logs.forEach((log: any) => {
      actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;
      totalActions++;
      if (!lastActivity || new Date(log.created_at) > new Date(lastActivity)) {
        lastActivity = log.created_at;
      }
    });

    const mostCommonAction = Object.entries(actionsByType)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

    return {
      userId,
      totalActions,
      actionsByType,
      lastActivity,
      mostCommonAction,
    };
  }

  /**
   * Get analytics metrics for all branches (admin only)
   */
  async getGlobalAnalytics(context: RequestContext): Promise<AnalyticsMetrics> {
    this.requirePermission(context, Permission.AUDIT_VIEW);

    if (!context.isSuperAdmin) {
      throw new Error('Only super admins can access global analytics');
    }

    // Get recent logs from all branches
    const logs = await this.auditService.getBranchLogs('', 1000);

    return this.calculateMetrics(logs);
  }

  /**
   * Get branch activity summary
   */
  async getBranchActivitySummary(context: RequestContext): Promise<BranchActivitySummary[]> {
    this.requirePermission(context, Permission.AUDIT_VIEW);

    if (!context.isSuperAdmin && !context.branchId) {
      throw new Error('Branch ID is required');
    }

    const branchId = context.isSuperAdmin ? undefined : context.branchId;
    const logs = branchId 
      ? await this.auditService.getBranchLogs(branchId, 1000)
      : await this.auditService.getBranchLogs('', 1000);

    const branchSummaries: Record<string, BranchActivitySummary> = {};

    logs.forEach((log: any) => {
      if (!log.branch_id) return;

      if (!branchSummaries[log.branch_id]) {
        branchSummaries[log.branch_id] = {
          branchId: log.branch_id,
          totalActions: 0,
          actionsByType: {},
          activeUsers: 0,
        };
      }

      branchSummaries[log.branch_id].totalActions++;
      branchSummaries[log.branch_id].actionsByType[log.action] = 
        (branchSummaries[log.branch_id].actionsByType[log.action] || 0) + 1;
    });

    return Object.values(branchSummaries).map(summary => ({
      branchId: summary.branchId,
      totalActions: summary.totalActions,
      actionsByType: summary.actionsByType,
      activeUsers: summary.activeUsers,
    }));
  }

  /**
   * Calculate metrics from audit logs
   */
  private calculateMetrics(logs: any[]): AnalyticsMetrics {
    const actionsByType: Record<string, number> = {};
    const actionsByEntity: Record<string, number> = {};
    const actionsByUser: Record<string, number> = {};
    const actionsByBranch: Record<string, number> = {};
    const actionsOverTime: Record<string, number> = {};

    logs.forEach((log: any) => {
      // By type
      actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;

      // By entity
      actionsByEntity[log.entity_type] = (actionsByEntity[log.entity_type] || 0) + 1;

      // By user
      if (log.actor_id) {
        actionsByUser[log.actor_id] = (actionsByUser[log.actor_id] || 0) + 1;
      }

      // By branch
      if (log.branch_id) {
        actionsByBranch[log.branch_id] = (actionsByBranch[log.branch_id] || 0) + 1;
      }

      // Over time (by day)
      const date = new Date(log.created_at).toISOString().split('T')[0];
      actionsOverTime[date] = (actionsOverTime[date] || 0) + 1;
    });

    // Sort actions over time
    const sortedActionsOverTime = Object.entries(actionsOverTime)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Get top actions
    const topActions = Object.entries(actionsByType)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Recent activity
    const recentActivity = logs.slice(0, 20).map((log: any) => ({
      id: log.id,
      action: log.action,
      entityType: log.entity_type,
      actorId: log.actor_id,
      branchId: log.branch_id,
      createdAt: log.created_at,
    }));

    return {
      totalActions: logs.length,
      actionsByType,
      actionsByEntity,
      actionsByUser,
      actionsByBranch,
      actionsOverTime: sortedActionsOverTime,
      topActions,
      recentActivity,
    };
  }

  /**
   * Get audit statistics
   */
  async getAuditStatistics(context: RequestContext, startDate?: string, endDate?: string): Promise<{
    totalLogs: number;
    logsByAction: Record<string, number>;
    logsByEntity: Record<string, number>;
    logsByBranch: Record<string, number>;
    errorRate: number;
  }> {
    this.requirePermission(context, Permission.AUDIT_VIEW);

    const branchId = context.isSuperAdmin ? undefined : context.branchId;

    const logs = branchId 
      ? await this.auditService.getBranchLogs(branchId, 1000)
      : await this.auditService.getBranchLogs('', 1000);

    const totalLogs = logs.length;
    const errorLogs = logs.filter((log: any) => log.action === 'error').length;
    const errorRate = totalLogs > 0 ? (errorLogs / totalLogs) * 100 : 0;

    const logsByAction: Record<string, number> = {};
    const logsByEntity: Record<string, number> = {};
    const logsByBranch: Record<string, number> = {};

    logs.forEach((log: any) => {
      logsByAction[log.action] = (logsByAction[log.action] || 0) + 1;
      logsByEntity[log.entity_type] = (logsByEntity[log.entity_type] || 0) + 1;
      if (log.branch_id) {
        logsByBranch[log.branch_id] = (logsByBranch[log.branch_id] || 0) + 1;
      }
    });

    return {
      totalLogs,
      logsByAction,
      logsByEntity,
      logsByBranch,
      errorRate,
    };
  }

  /**
   * Search audit logs
   */
  async searchAuditLogs(query: string, context: RequestContext): Promise<any[]> {
    this.requirePermission(context, Permission.AUDIT_VIEW);

    const branchId = context.isSuperAdmin ? undefined : context.branchId;

    // This would require a search method in the audit service
    // For now, return recent logs
    return branchId 
      ? await this.auditService.getBranchLogs(branchId, 50)
      : await this.auditService.getBranchLogs('', 50);
  }

  /**
   * Get activity timeline
   */
  async getActivityTimeline(context: RequestContext, limit: number = 50): Promise<any[]> {
    this.requirePermission(context, Permission.AUDIT_VIEW);

    const branchId = context.isSuperAdmin ? undefined : context.branchId;

    if (branchId) {
      return await this.auditService.getBranchLogs(branchId, limit);
    }

    return await this.auditService.getBranchLogs('', limit);
  }
}

// Singleton instance
export const analyticsService = new AnalyticsService();
