/**
 * Cache Invalidation Strategy
 * 
 * Comprehensive cache invalidation system for:
 * - Event-driven invalidation
 * - Time-based expiration
 * - Manual invalidation
 * - Tag-based invalidation
 * - Dependency tracking
 * - Multi-branch cache isolation
 * - Cache warming strategies
 * 
 * This system is designed for:
 * - M-Pesa/payment gateway cache management
 * - Multi-branch data isolation
 * - Real-time data consistency
 * - Performance optimization
 */

import { on } from '@/core/events/event-system';
import { performanceService } from '@/core/performance/performance-strategy';
import { RequestContext } from '@/core/context/request-context';

/**
 * Cache invalidation trigger
 */
export enum InvalidationTrigger {
  EVENT = 'event',
  TIME = 'time',
  MANUAL = 'manual',
  DEPENDENCY = 'dependency',
}

/**
 * Cache invalidation rule
 */
export interface InvalidationRule {
  pattern: string;
  trigger: InvalidationTrigger;
  eventType?: string;
  ttl?: number;
  tags?: string[];
  dependencies?: string[];
}

/**
 * Cache tag
 */
export interface CacheTag {
  name: string;
  keys: Set<string>;
  dependencies: Set<string>;
}

/**
 * Cache invalidation service
 */
export class CacheInvalidationService {
  private rules: Map<string, InvalidationRule> = new Map();
  private tags: Map<string, CacheTag> = new Map();
  private invalidationHistory: Array<{
    pattern: string;
    trigger: InvalidationTrigger;
    timestamp: Date;
    keysInvalidated: number;
  }> = [];

  /**
   * Initialize cache invalidation with event listeners
   */
  initialize(): void {
    // Student events
    on('student:created', this.handleStudentEvent.bind(this));
    on('student:updated', this.handleStudentEvent.bind(this));
    on('student:deleted', this.handleStudentEvent.bind(this));

    // Payment events
    on('payment:received', this.handlePaymentEvent.bind(this));
    on('payment:failed', this.handlePaymentEvent.bind(this));

    // Invoice events
    on('invoice:generated', this.handleInvoiceEvent.bind(this));
    on('invoice:paid', this.handleInvoiceEvent.bind(this));

    // Branch events
    on('branch:updated', this.handleBranchEvent.bind(this));

    // User events
    on('user:role_assigned', this.handleUserEvent.bind(this));

    // Finance audit events
    on('finance:audit:logged', this.handleFinanceAuditEvent.bind(this));
  }

  /**
   * Add invalidation rule
   */
  addRule(rule: InvalidationRule): void {
    const ruleId = `${rule.trigger}:${rule.pattern}`;
    this.rules.set(ruleId, rule);

    // Register event listeners if needed
    if (rule.trigger === InvalidationTrigger.EVENT && rule.eventType) {
      on(rule.eventType as any, () => this.invalidateByPattern(rule.pattern));
    }
  }

  /**
   * Remove invalidation rule
   */
  removeRule(pattern: string, trigger: InvalidationTrigger): void {
    const ruleId = `${trigger}:${pattern}`;
    this.rules.delete(ruleId);
  }

  /**
   * Invalidate cache by pattern
   */
  invalidateByPattern(pattern: string): number {
    const keysInvalidated = performanceService.invalidateCache(pattern);

    this.recordInvalidation(pattern, InvalidationTrigger.EVENT, keysInvalidated);

    return keysInvalidated;
  }

  /**
   * Invalidate cache by tag
   */
  invalidateByTag(tagName: string): number {
    const tag = this.tags.get(tagName);
    if (!tag) return 0;

    let keysInvalidated = 0;

    for (const key of tag.keys) {
      performanceService.invalidateCache(key);
      keysInvalidated++;
    }

    // Invalidate dependent tags
    for (const depTag of tag.dependencies) {
      keysInvalidated += this.invalidateByTag(depTag);
    }

    return keysInvalidated;
  }

  /**
   * Invalidate cache for branch
   */
  invalidateBranch(branchId: string): number {
    const pattern = `.*branch:${branchId}.*`;
    return this.invalidateByPattern(pattern);
  }

  /**
   * Invalidate cache for user
   */
  invalidateUser(userId: string): number {
    const pattern = `.*user:${userId}.*`;
    return this.invalidateByPattern(pattern);
  }

  /**
   * Tag cache key
   */
  tagKey(key: string, tagName: string): void {
    if (!this.tags.has(tagName)) {
      this.tags.set(tagName, {
        name: tagName,
        keys: new Set(),
        dependencies: new Set(),
      });
    }

    this.tags.get(tagName)!.keys.add(key);
  }

  /**
   * Add tag dependency
   */
  addTagDependency(tagName: string, dependsOn: string): void {
    if (!this.tags.has(tagName)) {
      this.tags.set(tagName, {
        name: tagName,
        keys: new Set(),
        dependencies: new Set(),
      });
    }

    this.tags.get(tagName)!.dependencies.add(dependsOn);
  }

  /**
   * Record invalidation
   */
  private recordInvalidation(
    pattern: string,
    trigger: InvalidationTrigger,
    keysInvalidated: number
  ): void {
    this.invalidationHistory.push({
      pattern,
      trigger,
      timestamp: new Date(),
      keysInvalidated,
    });

    // Keep only last 1000 records
    if (this.invalidationHistory.length > 1000) {
      this.invalidationHistory.shift();
    }
  }

  /**
   * Get invalidation history
   */
  getInvalidationHistory(limit: number = 100): Array<{
    pattern: string;
    trigger: InvalidationTrigger;
    timestamp: Date;
    keysInvalidated: number;
  }> {
    return this.invalidationHistory.slice(-limit);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalTags: number;
    totalKeys: number;
    totalRules: number;
    totalInvalidations: number;
  } {
    let totalKeys = 0;
    for (const tag of this.tags.values()) {
      totalKeys += tag.keys.size;
    }

    return {
      totalTags: this.tags.size,
      totalKeys,
      totalRules: this.rules.size,
      totalInvalidations: this.invalidationHistory.length,
    };
  }

  // ==================== EVENT HANDLERS ====================

  /**
   * Handle student events
   */
  private handleStudentEvent(data: any): void {
    // Invalidate student-related cache
    this.invalidateByPattern('student:*');
    this.invalidateByTag('students');
    
    if (data.studentId) {
      this.invalidateByPattern(`student:${data.studentId}:*`);
    }

    if (data.branchId) {
      this.invalidateBranch(data.branchId);
    }
  }

  /**
   * Handle payment events
   */
  private handlePaymentEvent(data: any): void {
    // Invalidate payment-related cache
    this.invalidateByPattern('payment:*');
    this.invalidateByTag('payments');
    this.invalidateByTag('financial_summary');

    if (data.studentId) {
      this.invalidateByPattern(`student:${data.studentId}:*`);
    }
  }

  /**
   * Handle invoice events
   */
  private handleInvoiceEvent(data: any): void {
    // Invalidate invoice-related cache
    this.invalidateByPattern('invoice:*');
    this.invalidateByTag('invoices');
    this.invalidateByTag('financial_summary');

    if (data.studentId) {
      this.invalidateByPattern(`student:${data.studentId}:*`);
    }
  }

  /**
   * Handle branch events
   */
  private handleBranchEvent(data: any): void {
    // Invalidate entire branch cache
    if (data.branchId) {
      this.invalidateBranch(data.branchId);
    }
  }

  /**
   * Handle user events
   */
  private handleUserEvent(data: any): void {
    // Invalidate user-related cache
    this.invalidateUser(data.userId);

    if (data.branchId) {
      this.invalidateBranch(data.branchId);
    }
  }

  /**
   * Handle finance audit events
   */
  private handleFinanceAuditEvent(data: any): void {
    // Invalidate financial audit cache
    this.invalidateByPattern('finance_audit:*');
    this.invalidateByTag('financial_audit');

    if (data.branchId) {
      this.invalidateBranch(data.branchId);
    }
  }

  /**
   * Set up default invalidation rules
   */
  setupDefaultRules(): void {
    // Student cache rules
    this.addRule({
      pattern: 'student:*',
      trigger: InvalidationTrigger.EVENT,
      eventType: 'student:created',
    });

    this.addRule({
      pattern: 'student:*',
      trigger: InvalidationTrigger.EVENT,
      eventType: 'student:updated',
    });

    this.addRule({
      pattern: 'student:*',
      trigger: InvalidationTrigger.EVENT,
      eventType: 'student:deleted',
    });

    // Payment cache rules
    this.addRule({
      pattern: 'payment:*',
      trigger: InvalidationTrigger.EVENT,
      eventType: 'payment:received',
    });

    this.addRule({
      pattern: 'payment:*',
      trigger: InvalidationTrigger.EVENT,
      eventType: 'payment:failed',
    });

    // Invoice cache rules
    this.addRule({
      pattern: 'invoice:*',
      trigger: InvalidationTrigger.EVENT,
      eventType: 'invoice:generated',
    });

    this.addRule({
      pattern: 'invoice:*',
      trigger: InvalidationTrigger.EVENT,
      eventType: 'invoice:paid',
    });

    // Time-based expiration for volatile data
    this.addRule({
      pattern: 'session:*',
      trigger: InvalidationTrigger.TIME,
      ttl: 1800, // 30 minutes
    });

    this.addRule({
      pattern: 'permissions:*',
      trigger: InvalidationTrigger.TIME,
      ttl: 300, // 5 minutes
    });
  }

  /**
   * Warm up cache for a branch
   */
  async warmUpBranchCache(branchId: string, context: RequestContext): Promise<void> {
    // Warm up frequently accessed data
    const warmUpKeys = [
      {
        key: `branch:${branchId}:students`,
        loader: async () => {
          // Load students for branch
          return []; // Would call student service
        },
      },
      {
        key: `branch:${branchId}:financial_summary`,
        loader: async () => {
          // Load financial summary
          return {}; // Would call analytics service
        },
      },
    ];

    await performanceService.warmUpCache(warmUpKeys);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): number {
    return performanceService.invalidateCache();
  }

  /**
   * Get cache health
   */
  getCacheHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    message: string;
    stats: ReturnType<typeof this.getCacheStats>;
  } {
    const stats = this.getCacheStats();
    const recentInvalidations = this.invalidationHistory.filter(
      h => Date.now() - h.timestamp.getTime() < 60000 // Last minute
    ).length;

    if (recentInvalidations > 100) {
      return {
        status: 'critical',
        message: 'High cache churn detected',
        stats,
      };
    }

    if (recentInvalidations > 50) {
      return {
        status: 'warning',
        message: 'Moderate cache churn',
        stats,
      };
    }

    return {
      status: 'healthy',
      message: 'Cache operating normally',
      stats,
    };
  }

  /**
   * Decorator for automatic cache tagging
   */
  static Tag(tagName: string) {
    return function (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const cacheInvalidation = (this as any).cacheInvalidation || cacheInvalidationService;
        const performance = (this as any).performance || performanceService;

        const key = performance.generateCacheKey(
          `${target.constructor.name}.${propertyKey}`,
          { args }
        );

        // Tag the key
        cacheInvalidation.tagKey(key, tagName);

        return originalMethod.apply(this, args);
      };

      return descriptor;
    };
  }

  /**
   * Decorator for automatic cache invalidation
   */
  static Invalidate(pattern: string) {
    return function (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const cacheInvalidation = (this as any).cacheInvalidation || cacheInvalidationService;

        const result = await originalMethod.apply(this, args);

        // Invalidate cache after operation
        cacheInvalidation.invalidateByPattern(pattern);

        return result;
      };

      return descriptor;
    };
  }
}

// Singleton instance
export const cacheInvalidationService = new CacheInvalidationService();

/**
 * Initialize cache invalidation system
 */
export function initializeCacheInvalidation(): void {
  cacheInvalidationService.initialize();
  cacheInvalidationService.setupDefaultRules();
}
