import { supabase } from '@/integrations/supabase/client';
import { auditService } from '@/core/audit/audit.service';
import { handleError, toAppError } from '@/lib/error-handler';
import { RequestContext } from '@/core/context/request-context';

/**
 * Service options for context and behavior
 */
export interface ServiceOptions {
  context?: RequestContext;
  skipAudit?: boolean;
  skipValidation?: boolean;
  skipErrorHandling?: boolean;
}

/**
 * Result type for service operations
 */
export interface ServiceResult<T> {
  data: T | null;
  error: Error | null;
  success: boolean;
}

/**
 * Base Service Class
 * Provides common service functionality including:
 * - Audit logging integration
 * - Error handling
 * - Validation hooks
 * - Branch isolation support
 * - Request context support
 * 
 * All services should extend this class
 */
export class BaseService {
  protected supabase = supabase;
  protected auditService = auditService;

  /**
   * Execute service operation with error handling and optional audit logging
   */
  protected async execute<T>(
    operation: () => Promise<T>,
    options: ServiceOptions = {}
  ): Promise<T> {
    try {
      const result = await operation();
      
      // Audit logging
      if (!options.skipAudit && options.context) {
        await this.logAudit(options.context, operation, result);
      }
      
      return result;
    } catch (error) {
      if (!options.skipErrorHandling) {
        this.handleError(error, options.context);
      }
      throw toAppError(error);
    }
  }

  /**
   * Execute operation with typed result
   */
  protected async executeWithResult<T>(
    operation: () => Promise<T>,
    options: ServiceOptions = {}
  ): Promise<ServiceResult<T>> {
    try {
      const data = await this.execute(operation, options);
      return { data, error: null, success: true };
    } catch (error) {
      return {
        data: null,
        error: toAppError(error),
        success: false,
      };
    }
  }

  /**
   * Apply branch isolation filter to query
   */
  protected withBranchIsolation(query: any, branchId?: string) {
    if (branchId) {
      return query.eq('branch_id', branchId);
    }
    return query;
  }

  /**
   * Apply soft delete filter (exclude deleted records)
   */
  protected withSoftDeleteFilter(query: any) {
    return query.is('deleted_at', null);
  }

  /**
   * Get operation name for audit logging
   */
  protected getOperationName(operation: Function): string {
    return operation.name || 'unknown_operation';
  }

  /**
   * Get entity name for audit logging
   */
  protected getEntityName(): string {
    return this.constructor.name.replace('Service', '').toLowerCase();
  }

  /**
   * Extract entity ID from result for audit logging
   */
  protected extractEntityId(result: any): string | undefined {
    return result?.id || result?.[0]?.id;
  }

  /**
   * Handle errors with context
   */
  protected handleError(error: unknown, context?: RequestContext): void {
    const appError = toAppError(error);
    
    console.error(`[${this.constructor.name}] Error:`, {
      message: appError.message,
      code: appError.code,
      userId: context?.userId,
      branchId: context?.branchId,
      requestId: context?.requestId,
      stack: appError.stack,
    });
  }

  /**
   * Log audit event
   */
  protected async logAudit(
    context: RequestContext,
    operation: Function,
    result?: any
  ): Promise<void> {
    try {
      await this.auditService.log({
        actor_id: context.userId,
        action: this.getOperationName(operation),
        entity_type: this.getEntityName(),
        entity_id: this.extractEntityId(result),
        branch_id: context.branchId,
        ip_address: context.ipAddress,
        metadata: {
          requestId: context.requestId,
          timestamp: context.timestamp,
        },
      });
    } catch (error) {
      // Audit logging should not break the application
      console.error('[BaseService] Audit logging failed:', error);
    }
  }

  /**
   * Validate input using a validation function
   */
  protected validate<T>(
    input: unknown,
    validator: (data: unknown) => T,
    options: ServiceOptions = {}
  ): T {
    if (options.skipValidation) {
      return input as T;
    }

    try {
      return validator(input);
    } catch (error) {
      throw new Error(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if user has permission from context
   */
  protected checkPermission(context: RequestContext, permission: string): boolean {
    return context.permissions?.includes(permission as any) || context.isSuperAdmin || false;
  }

  /**
   * Require permission or throw error
   */
  protected requirePermission(context: RequestContext, permission: string): void {
    if (!this.checkPermission(context, permission)) {
      throw new Error(`Unauthorized: Missing permission '${permission}'`);
    }
  }

  /**
   * Check if user has role from context
   */
  protected hasRole(context: RequestContext, role: string): boolean {
    return context.roles?.includes(role as any) || context.isSuperAdmin || false;
  }

  /**
   * Validate branch access from context
   */
  protected validateBranchAccess(context: RequestContext, branchId: string): boolean {
    if (context.isSuperAdmin) return true;
    return context.branchIds?.includes(branchId) || false;
  }

  /**
   * Create paginated response
   */
  protected createPaginatedResponse<T>(
    data: T[],
    page: number,
    pageSize: number,
    total: number
  ) {
    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: page * pageSize < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Sanitize input for database operations
   */
  protected sanitizeInput<T extends Record<string, any>>(input: T): Partial<T> {
    const sanitized: Partial<T> = {};
    
    Object.entries(input).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        sanitized[key as keyof T] = value;
      }
    });
    
    return sanitized;
  }

  /**
   * Transform database record to DTO
   * Override in child classes for custom transformations
   */
  protected toDTO<T>(record: any): T {
    return record as T;
  }

  /**
   * Transform DTO to database record
   * Override in child classes for custom transformations
   */
  protected fromDTO<T>(dto: any): T {
    return dto as T;
  }
}
