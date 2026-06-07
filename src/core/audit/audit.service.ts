import { supabase } from '@/integrations/supabase/client';

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  branch_id: string | null;
  metadata: Record<string, any> | string | number | boolean | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogInput {
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  branch_id?: string;
  metadata?: Record<string, any>;
  ip_address?: string;
}

/**
 * Audit Service
 * Centralized audit logging for compliance and security
 */
export class AuditService {
  private supabase = supabase;

  /**
   * Log an audit event
   */
  async log(input: AuditLogInput): Promise<void> {
    try {
      const { error } = await this.supabase.from('audit_logs').insert({
        actor_id: input.actor_id,
        action: input.action,
        entity_type: input.entity_type,
        entity_id: input.entity_id || null,
        branch_id: input.branch_id || null,
        metadata: input.metadata || null,
        ip_address: input.ip_address || null,
      });

      if (error) {
        console.error('[AuditService] Failed to log audit event:', error);
        // Don't throw error - audit logging should not break the application
      }
    } catch (error) {
      console.error('[AuditService] Error logging audit event:', error);
      // Don't throw error - audit logging should not break the application
    }
  }

  /**
   * Log with automatic context extraction
   */
  async logWithContext(
    userId: string,
    action: string,
    entityType: string,
    entityId?: string,
    additionalMetadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      actor_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata: additionalMetadata,
    });
  }

  /**
   * Get audit logs for a specific entity
   */
  async getEntityLogs(
    entityType: string,
    entityId: string,
    limit: number = 50
  ): Promise<AuditLog[]> {
    try {
      const { data, error } = await this.supabase
        .from('audit_logs')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[AuditService] Error getting entity logs:', error);
      throw error;
    }
  }

  /**
   * Get audit logs for a specific actor
   */
  async getActorLogs(
    actorId: string,
    limit: number = 50
  ): Promise<AuditLog[]> {
    try {
      const { data, error } = await this.supabase
        .from('audit_logs')
        .select('*')
        .eq('actor_id', actorId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[AuditService] Error getting actor logs:', error);
      throw error;
    }
  }

  /**
   * Get audit logs for a branch
   */
  async getBranchLogs(
    branchId: string,
    limit: number = 50
  ): Promise<AuditLog[]> {
    try {
      const { data, error } = await this.supabase
        .from('audit_logs')
        .select('*')
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[AuditService] Error getting branch logs:', error);
      throw error;
    }
  }

  /**
   * Get audit logs with pagination
   */
  async getLogsPaginated(
    filters: {
      actorId?: string;
      entityType?: string;
      entityId?: string;
      branchId?: string;
      action?: string;
    } = {},
    page: number = 1,
    pageSize: number = 50
  ): Promise<{ data: AuditLog[]; count: number; page: number; pageSize: number; totalPages: number }> {
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = this.supabase
        .from('audit_logs')
        .select('*', { count: 'exact' });

      if (filters.actorId) {
        query = query.eq('actor_id', filters.actorId);
      }
      if (filters.entityType) {
        query = query.eq('entity_type', filters.entityType);
      }
      if (filters.entityId) {
        query = query.eq('entity_id', filters.entityId);
      }
      if (filters.branchId) {
        query = query.eq('branch_id', filters.branchId);
      }
      if (filters.action) {
        query = query.eq('action', filters.action);
      }

      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: data || [],
        count: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    } catch (error) {
      console.error('[AuditService] Error getting paginated logs:', error);
      throw error;
    }
  }

  /**
   * Search audit logs by action pattern
   */
  async searchByAction(
    actionPattern: string,
    limit: number = 50
  ): Promise<AuditLog[]> {
    try {
      const { data, error } = await this.supabase
        .from('audit_logs')
        .select('*')
        .ilike('action', `%${actionPattern}%`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[AuditService] Error searching logs by action:', error);
      throw error;
    }
  }

  /**
   * Get audit statistics
   */
  async getStatistics(
    filters: {
      actorId?: string;
      branchId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{
    totalLogs: number;
    logsByAction: Record<string, number>;
    logsByEntityType: Record<string, number>;
    logsByActor: Record<string, number>;
  }> {
    try {
      let query = this.supabase.from('audit_logs').select('*');

      if (filters.actorId) {
        query = query.eq('actor_id', filters.actorId);
      }
      if (filters.branchId) {
        query = query.eq('branch_id', filters.branchId);
      }
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const logs = data || [];

      const logsByAction: Record<string, number> = {};
      const logsByEntityType: Record<string, number> = {};
      const logsByActor: Record<string, number> = {};

      logs.forEach(log => {
        logsByAction[log.action] = (logsByAction[log.action] || 0) + 1;
        logsByEntityType[log.entity_type] = (logsByEntityType[log.entity_type] || 0) + 1;
        if (log.actor_id) {
          logsByActor[log.actor_id] = (logsByActor[log.actor_id] || 0) + 1;
        }
      });

      return {
        totalLogs: logs.length,
        logsByAction,
        logsByEntityType,
        logsByActor,
      };
    } catch (error) {
      console.error('[AuditService] Error getting statistics:', error);
      throw error;
    }
  }

  /**
   * Export audit logs to CSV
   */
  async exportToCSV(
    filters: {
      actorId?: string;
      entityType?: string;
      entityId?: string;
      branchId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<string> {
    try {
      let query = this.supabase.from('audit_logs').select('*');

      if (filters.actorId) {
        query = query.eq('actor_id', filters.actorId);
      }
      if (filters.entityType) {
        query = query.eq('entity_type', filters.entityType);
      }
      if (filters.entityId) {
        query = query.eq('entity_id', filters.entityId);
      }
      if (filters.branchId) {
        query = query.eq('branch_id', filters.branchId);
      }
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString());
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const logs = data || [];

      // Convert to CSV
      const headers = ['id', 'actor_id', 'action', 'entity_type', 'entity_id', 'branch_id', 'ip_address', 'created_at'];
      const csvRows = [
        headers.join(','),
        ...logs.map(log =>
          headers.map(header => {
            const value = log[header as keyof AuditLog];
            // Escape quotes and wrap in quotes if contains comma
            const stringValue = String(value ?? '');
            if (stringValue.includes(',') || stringValue.includes('"')) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          }).join(',')
        ),
      ];

      return csvRows.join('\n');
    } catch (error) {
      console.error('[AuditService] Error exporting to CSV:', error);
      throw error;
    }
  }
}

// Singleton instance
export const auditService = new AuditService();
