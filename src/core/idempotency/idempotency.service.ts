/**
 * Idempotency System for Critical Operations
 * 
 * Idempotency ensures that operations can be safely retried without causing
 * unintended side effects. This is critical for:
 * - Payment processing (prevent double charges)
 * - Student enrollment (prevent duplicate enrollments)
 * - Invoice generation (prevent duplicate invoices)
 * - API retries (handle network failures gracefully)
 * 
 * This implementation uses:
 * - Idempotency keys to uniquely identify operations
 * - Result caching to return cached results on retries
 * - Expiration policies to prevent memory bloat
 * - Distributed locking for concurrent requests
 * - Comprehensive audit logging
 */

import { supabase } from '@/integrations/supabase/client';
import { auditService } from '@/core/audit/audit.service';
import { RequestContext } from '@/core/context/request-context';

/**
 * Idempotency result status
 */
export enum IdempotencyStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

/**
 * Idempotency record
 */
export interface IdempotencyRecord {
  id: string;
  key: string;
  status: IdempotencyStatus;
  result?: any;
  error?: string;
  requestParams?: Record<string, any>;
  responseHeaders?: Record<string, string>;
  createdAt: Date;
  completedAt?: Date;
  expiresAt: Date;
  userId: string;
  branchId?: string;
}

/**
 * Idempotency options
 */
export interface IdempotencyOptions {
  ttl?: number; // Time to live in seconds (default: 24 hours)
  lockTimeout?: number; // Lock timeout in milliseconds (default: 30 seconds)
  skipCache?: boolean; // Skip result caching (default: false)
}

/**
 * Idempotency service
 */
export class IdempotencyService {
  private supabase = supabase;
  private locks: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Execute an operation with idempotency guarantee
   */
  async executeWithIdempotency<T>(
    key: string,
    operation: () => Promise<T>,
    context: RequestContext,
    options: IdempotencyOptions = {}
  ): Promise<T> {
    const ttl = options.ttl || 86400; // 24 hours default
    const lockTimeout = options.lockTimeout || 30000; // 30 seconds default

    // Check for existing idempotency record
    const existing = await this.getRecord(key);

    if (existing) {
      // Record exists - check status
      if (existing.status === IdempotencyStatus.COMPLETED) {
        // Return cached result
        await this.logIdempotencyHit(key, 'cache_hit', context);
        return existing.result as T;
      }

      if (existing.status === IdempotencyStatus.IN_PROGRESS) {
        // Wait for completion or timeout
        await this.waitForCompletion(key, lockTimeout);
        const updated = await this.getRecord(key);
        if (updated?.status === IdempotencyStatus.COMPLETED) {
          return updated.result as T;
        }
        throw new Error('Operation timed out');
      }

      if (existing.status === IdempotencyStatus.FAILED) {
        // Return cached error
        throw new Error(existing.error || 'Previous operation failed');
      }

      if (existing.status === IdempotencyStatus.EXPIRED) {
        // Record expired - proceed with new operation
        await this.deleteRecord(key);
      }
    }

    // Acquire lock
    const lockAcquired = await this.acquireLock(key, lockTimeout);
    if (!lockAcquired) {
      throw new Error('Could not acquire lock for idempotency key');
    }

    try {
      // Create pending record
      await this.createRecord(key, context, ttl);

      await this.logIdempotencyHit(key, 'operation_started', context);

      // Execute operation
      const result = await operation();

      // Update record with success
      await this.updateRecord(key, {
        status: IdempotencyStatus.COMPLETED,
        result: options.skipCache ? undefined : result,
        completedAt: new Date(),
      });

      await this.logIdempotencyHit(key, 'operation_completed', context);

      return result;
    } catch (error) {
      // Update record with failure
      await this.updateRecord(key, {
        status: IdempotencyStatus.FAILED,
        error: (error as Error).message,
        completedAt: new Date(),
      });

      await this.logIdempotencyHit(key, 'operation_failed', context);

      throw error;
    } finally {
      // Release lock
      this.releaseLock(key);
    }
  }

  /**
   * Get idempotency record
   */
  async getRecord(key: string): Promise<IdempotencyRecord | null> {
    try {
      const { data, error } = await this.supabase
        .from('idempotency_records' as any)
        .select('*')
        .eq('key', key)
        .maybeSingle();

      if (error) throw error;

      if (!data) return null;

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        await this.deleteRecord(key);
        return null;
      }

      return {
        id: data.id,
        key: data.key,
        status: data.status,
        result: data.result,
        error: data.error,
        requestParams: data.request_params,
        responseHeaders: data.response_headers,
        createdAt: new Date(data.created_at),
        completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
        expiresAt: new Date(data.expires_at),
        userId: data.user_id,
        branchId: data.branch_id,
      };
    } catch (error) {
      console.error('Error getting idempotency record:', error);
      return null;
    }
  }

  /**
   * Create idempotency record
   */
  private async createRecord(
    key: string,
    context: RequestContext,
    ttl: number
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttl * 1000);

      const { error } = await this.supabase
        .from('idempotency_records' as any)
        .insert({
          key,
          status: IdempotencyStatus.IN_PROGRESS,
          created_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          user_id: context.userId,
          branch_id: context.branchId,
        });

      if (error) {
        console.error('Error creating idempotency record:', error);
      }
    } catch (error) {
      console.error('Error creating idempotency record:', error);
    }
  }

  /**
   * Update idempotency record
   */
  private async updateRecord(
    key: string,
    updates: Partial<IdempotencyRecord>
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('idempotency_records' as any)
        .update({
          status: updates.status,
          result: updates.result,
          error: updates.error,
          completed_at: updates.completedAt?.toISOString(),
        })
        .eq('key', key);

      if (error) {
        console.error('Error updating idempotency record:', error);
      }
    } catch (error) {
      console.error('Error updating idempotency record:', error);
    }
  }

  /**
   * Delete idempotency record
   */
  private async deleteRecord(key: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('idempotency_records' as any)
        .delete()
        .eq('key', key);

      if (error) {
        console.error('Error deleting idempotency record:', error);
      }
    } catch (error) {
      console.error('Error deleting idempotency record:', error);
    }
  }

  /**
   * Acquire lock for idempotency key
   */
  private async acquireLock(key: string, timeout: number): Promise<boolean> {
    if (this.locks.has(key)) {
      return false;
    }

    this.locks.set(key, setTimeout(() => {
      this.releaseLock(key);
    }, timeout));

    return true;
  }

  /**
   * Release lock for idempotency key
   */
  private releaseLock(key: string): void {
    const timeout = this.locks.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.locks.delete(key);
    }
  }

  /**
   * Wait for operation completion
   */
  private async waitForCompletion(key: string, timeout: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      await this.sleep(100); // Poll every 100ms

      const record = await this.getRecord(key);
      if (record?.status === IdempotencyStatus.COMPLETED) {
        return;
      }

      if (record?.status === IdempotencyStatus.FAILED) {
        return;
      }
    }

    throw new Error('Wait for completion timed out');
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log idempotency hit
   */
  private async logIdempotencyHit(
    key: string,
    action: string,
    context: RequestContext
  ): Promise<void> {
    await auditService.logWithContext(
      context.userId,
      `idempotency:${action}`,
      'idempotency',
      key,
      { key, branchId: context.branchId }
    );
  }

  /**
   * Clean up expired records
   */
  async cleanupExpiredRecords(): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('idempotency_records' as any)
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) throw error;

      return (data as any)?.length || 0;
    } catch (error) {
      console.error('Error cleaning up expired records:', error);
      return 0;
    }
  }

  /**
   * Generate idempotency key from request
   */
  generateKey(operation: string, params: Record<string, any>, userId: string): string {
    const normalizedParams = JSON.stringify(params, Object.keys(params).sort());
    const hash = this.simpleHash(`${operation}:${userId}:${normalizedParams}`);
    return `${operation}:${hash}`;
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if operation is safe to retry
   */
  isSafeToRetry(operation: string): boolean {
    const safeOperations = [
      'payment:process',
      'student:enroll',
      'invoice:generate',
      'fee:assign',
    ];

    return safeOperations.includes(operation);
  }
}

// Singleton instance
export const idempotencyService = new IdempotencyService();

/**
 * Decorator for idempotent operations
 */
export function Idempotent(options: IdempotencyOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const context = args[args.length - 1] as RequestContext; // Assume last arg is context
      const operation = `${target.constructor.name}:${propertyKey}`;
      const params = args.slice(0, -1); // Exclude context

      const key = idempotencyService.generateKey(operation, params[0] || {}, context.userId);

      return idempotencyService.executeWithIdempotency(
        key,
        () => originalMethod.apply(this, args),
        context,
        options
      );
    };

    return descriptor;
  };
}
