/**
 * Performance Optimization Strategy
 * 
 * Comprehensive performance optimization guidelines and utilities for:
 * - Database query optimization
 * - Caching strategies
 * - Pagination and lazy loading
 * - Batch operations
 * - Index optimization
 * - Connection pooling
 * - Memory management
 * 
 * This strategy is designed for:
 * - Multi-branch scaling
 * - M-Pesa/payment gateway performance
 * - High-concurrency operations
 * - Large dataset handling
 */

import { supabase } from '@/integrations/supabase/client';
import { RequestContext } from '@/core/context/request-context';

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum number of items
  strategy: 'lru' | 'lfu' | 'fifo';
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  queryTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  connectionPoolUsage: number;
}

/**
 * Performance optimization service
 */
export class PerformanceService {
  private supabase = supabase;
  private cache: Map<string, { data: any; expiresAt: number; hits: number }> = new Map();
  private cacheConfig: CacheConfig = {
    ttl: 300, // 5 minutes default
    maxSize: 1000,
    strategy: 'lru',
  };

  /**
   * Execute query with pagination
   */
  async executePaginatedQuery<T>(
    tableName: string,
    options: PaginationOptions,
    filters?: Record<string, any>
  ): Promise<PaginatedResult<T>> {
    const { page, pageSize, sortBy, sortOrder } = options;
    const offset = (page - 1) * pageSize;

    let query = this.supabase.from(tableName as any).select('*', { count: 'exact' });

    // Apply filters
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }

    // Apply sorting
    if (sortBy) {
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    }

    // Apply pagination
    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
      data: (data || []) as T[],
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  /**
   * Execute batch operations
   */
  async executeBatchOperation<T>(
    operation: 'insert' | 'update' | 'delete',
    tableName: string,
    items: T[],
    batchSize: number = 100
  ): Promise<void> {
    const batches = this.chunkArray(items, batchSize);

    for (const batch of batches) {
      try {
        let query;

        switch (operation) {
          case 'insert':
            query = this.supabase.from(tableName as any).insert(batch);
            break;
          case 'update':
            query = this.supabase.from(tableName as any).upsert(batch);
            break;
          case 'delete':
            query = this.supabase.from(tableName as any).delete().in('id', batch.map((b: any) => b.id));
            break;
        }

        const { error } = await query;

        if (error) throw error;
      } catch (error) {
        console.error(`Batch ${operation} failed:`, error);
        throw error;
      }
    }
  }

  /**
   * Chunk array into batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get cached data
   */
  getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);

    if (!cached) return null;

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count for LRU
    cached.hits++;
    this.evictIfNeeded();

    return cached.data as T;
  }

  /**
   * Set cached data
   */
  setCached<T>(key: string, data: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.cacheConfig.ttl) * 1000;

    this.cache.set(key, {
      data,
      expiresAt,
      hits: 0,
    });

    this.evictIfNeeded();
  }

  /**
   * Invalidate cache
   */
  invalidateCache(pattern?: string): void {
    if (pattern) {
      // Invalidate matching keys
      const regex = new RegExp(pattern);
      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Invalidate all
      this.cache.clear();
    }
  }

  /**
   * Evict cache entries based on strategy
   */
  private evictIfNeeded(): void {
    if (this.cache.size <= this.cacheConfig.maxSize) return;

    switch (this.cacheConfig.strategy) {
      case 'lru':
        this.evictLRU();
        break;
      case 'lfu':
        this.evictLFU();
        break;
      case 'fifo':
        this.evictFIFO();
        break;
    }
  }

  /**
   * Evict least recently used
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestHits = Infinity;

    for (const [key, value] of this.cache.entries()) {
      if (value.hits < oldestHits) {
        oldestHits = value.hits;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Evict least frequently used
   */
  private evictLFU(): void {
    let leastUsedKey: string | null = null;
    let leastUsedHits = Infinity;

    for (const [key, value] of this.cache.entries()) {
      if (value.hits < leastUsedHits) {
        leastUsedHits = value.hits;
        leastUsedKey = key;
      }
    }

    if (leastUsedKey) {
      this.cache.delete(leastUsedKey);
    }
  }

  /**
   * Evict first in first out
   */
  private evictFIFO(): void {
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
    }
  }

  /**
   * Execute query with caching
   */
  async executeWithCache<T>(
    key: string,
    queryFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try cache first
    const cached = this.getCached<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute query
    const result = await queryFn();

    // Cache result
    this.setCached(key, result, ttl);

    return result;
  }

  /**
   * Execute query with performance monitoring
   */
  async executeWithMonitoring<T>(
    queryFn: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await queryFn();

      const duration = Date.now() - startTime;

      // Log slow queries
      if (duration > 1000) {
        console.warn(`Slow query detected: ${operationName} took ${duration}ms`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Query failed: ${operationName} after ${duration}ms`, error);
      throw error;
    }
  }

  /**
   * Optimize query with selective field loading
   */
  async executeSelectiveQuery<T>(
    tableName: string,
    fields: string[],
    filters?: Record<string, any>
  ): Promise<T[]> {
    let query = this.supabase.from(tableName as any).select(fields.join(','));

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []) as T[];
  }

  /**
   * Execute query with connection pooling optimization
   */
  async executeWithConnectionPool<T>(
    queryFn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await queryFn();
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 100;
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    let totalHits = 0;
    for (const cached of this.cache.values()) {
      totalHits += cached.hits;
    }

    const hitRate = this.cache.size > 0 ? totalHits / this.cache.size : 0;

    return {
      size: this.cache.size,
      maxSize: this.cacheConfig.maxSize,
      hitRate,
    };
  }

  /**
   * Warm up cache for frequently accessed data
   */
  async warmUpCache(
    keys: Array<{ key: string; loader: () => Promise<any> }>
  ): Promise<void> {
    const promises = keys.map(async ({ key, loader }) => {
      try {
        const data = await loader();
        this.setCached(key, data);
      } catch (error) {
        console.error(`Failed to warm up cache for key ${key}:`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Optimize memory usage by clearing old cache entries
   */
  optimizeMemory(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, value] of this.cache.entries()) {
      if (now > value.expiresAt) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Generate cache key
   */
  generateCacheKey(
    operation: string,
    params: Record<string, any>
  ): string {
    const normalizedParams = JSON.stringify(params, Object.keys(params).sort());
    return `${operation}:${normalizedParams}`;
  }

  /**
   * Decorator for caching
   */
  static Cached(ttl?: number) {
    return function (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const performance = (this as any).performance || performanceService;
        const key = performance.generateCacheKey(
          `${target.constructor.name}.${propertyKey}`,
          { args }
        );

        return performance.executeWithCache(key, () => originalMethod.apply(this, args), ttl);
      };

      return descriptor;
    };
  }

  /**
   * Decorator for performance monitoring
   */
  static Monitored(operationName?: string) {
    return function (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const performance = (this as any).performance || performanceService;
        const name = operationName || `${target.constructor.name}.${propertyKey}`;

        return performance.executeWithMonitoring(
          () => originalMethod.apply(this, args),
          name
        );
      };

      return descriptor;
    };
  }
}

// Singleton instance
export const performanceService = new PerformanceService();

/**
 * Query optimization utilities
 */
export class QueryOptimizer {
  /**
   * Optimize query by adding necessary indexes (documentation)
   */
  static getRecommendedIndexes(tableName: string): Array<{
    name: string;
    columns: string[];
    unique?: boolean;
  }> {
    const indexes: Record<string, Array<{ name: string; columns: string[]; unique?: boolean }>> = {
      students: [
        { name: 'idx_students_branch', columns: ['branch_id'] },
        { name: 'idx_students_registration', columns: ['registration_number'], unique: true },
        { name: 'idx_students_email', columns: ['email'], unique: true },
        { name: 'idx_students_status', columns: ['status'] },
      ],
      payments: [
        { name: 'idx_payments_student', columns: ['student_id'] },
        { name: 'idx_payments_branch', columns: ['branch_id'] },
        { name: 'idx_payments_status', columns: ['status'] },
        { name: 'idx_payments_date', columns: ['payment_date'] },
      ],
      invoices: [
        { name: 'idx_invoices_student', columns: ['student_id'] },
        { name: 'idx_invoices_branch', columns: ['branch_id'] },
        { name: 'idx_invoices_number', columns: ['invoice_number'], unique: true },
        { name: 'idx_invoices_status', columns: ['status'] },
      ],
      audit_logs: [
        { name: 'idx_audit_actor', columns: ['actor_id'] },
        { name: 'idx_audit_branch', columns: ['branch_id'] },
        { name: 'idx_audit_entity', columns: ['entity_type', 'entity_id'] },
        { name: 'idx_audit_created', columns: ['created_at'] },
      ],
    };

    return indexes[tableName] || [];
  }

  /**
   * Analyze query for potential optimizations
   */
  static analyzeQuery(query: string): Array<{
    type: 'warning' | 'suggestion';
    message: string;
  }> {
    const suggestions: Array<{ type: 'warning' | 'suggestion'; message: string }> = [];

    // Check for SELECT *
    if (query.includes('SELECT *')) {
      suggestions.push({
        type: 'warning',
        message: 'SELECT * can be inefficient. Specify only required columns.',
      });
    }

    // Check for missing WHERE clause
    if (!query.includes('WHERE') && !query.includes('LIMIT')) {
      suggestions.push({
        type: 'warning',
        message: 'Query without WHERE clause or LIMIT may return many rows.',
      });
    }

    // Check for LIKE with leading wildcard
    if (query.includes('LIKE %')) {
      suggestions.push({
        type: 'suggestion',
        message: 'LIKE with leading wildcard prevents index usage.',
      });
    }

    return suggestions;
  }

  /**
   * Suggest pagination for large datasets
   */
  static suggestPagination(estimatedRows: number): {
    recommended: boolean;
    pageSize: number;
    reason: string;
  } {
    if (estimatedRows > 1000) {
      return {
        recommended: true,
        pageSize: 50,
        reason: 'Large dataset detected. Pagination recommended.',
      };
    }

    if (estimatedRows > 100) {
      return {
        recommended: true,
        pageSize: 100,
        reason: 'Medium dataset. Pagination suggested for better UX.',
      };
    }

    return {
      recommended: false,
      pageSize: estimatedRows,
      reason: 'Dataset size is manageable without pagination.',
    };
  }
}
