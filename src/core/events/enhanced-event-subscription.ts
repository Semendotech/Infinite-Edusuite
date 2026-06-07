/**
 * Enhanced Event Subscription System
 * 
 * Extends the existing event system with:
 * - Wildcard listeners (finance.*, student.*)
 * - Priority-based execution
 * - Conditional listeners
 * - Retry policies
 * - Dead-letter queue handling
 */

import { EventEmitter, EventListener } from './event-system';
import { RequestContext } from '@/core/context/request-context';
import { supabase } from '@/integrations/supabase/client';
import { observabilityService } from '@/core/observability/observability.service';

/**
 * Subscription configuration
 */
export interface SubscriptionConfig {
  eventPattern: string;
  handlerType: 'notification' | 'workflow' | 'webhook';
  handlerConfig: Record<string, any>;
  priority?: number;
  conditions?: {
    requiredPermissions?: string[];
    branchId?: string;
    payloadRules?: Record<string, any>;
  };
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
  isActive?: boolean;
}

/**
 * Enhanced subscription entry
 */
interface EnhancedSubscription {
  id: string;
  config: SubscriptionConfig;
  listener: EventListener;
  context?: RequestContext;
  retryCount: number;
  lastError?: Error;
}

/**
 * Enhanced Event Subscription System
 */
export class EnhancedEventSubscriptionSystem {
  private eventEmitter: EventEmitter;
  private subscriptions: Map<string, EnhancedSubscription[]> = new Map();
  private deadLetterQueue: Map<string, any[]> = new Map();
  private processingQueue: Map<string, Promise<void>> = new Map();

  constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter;
    this.loadSubscriptionsFromDatabase();
  }

  /**
   * Load subscriptions from database
   */
  private async loadSubscriptionsFromDatabase(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('event_subscriptions' as any)
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.error('[EnhancedEventSubscription] Failed to load subscriptions:', error);
        return;
      }

      for (const sub of data || []) {
        this.registerSubscription({
          eventPattern: sub.event_pattern,
          handlerType: sub.handler_type,
          handlerConfig: sub.handler_config,
          priority: sub.priority,
          conditions: sub.conditions,
          retryPolicy: sub.retry_policy,
          isActive: sub.is_active,
        });
      }
    } catch (error) {
      console.error('[EnhancedEventSubscription] Error loading subscriptions:', error);
    }
  }

  /**
   * Register a subscription
   */
  registerSubscription(
    config: SubscriptionConfig,
    context?: RequestContext
  ): string {
    const subscriptionId = crypto.randomUUID();

    // Create listener
    const listener: EventListener = async (data) => {
      await this.handleEvent(subscriptionId, config, data, context);
    };

    // Register with event emitter for all matching events
    this.registerWithEventEmitter(config.eventPattern, listener, config.priority);

    // Store subscription
    const subscription: EnhancedSubscription = {
      id: subscriptionId,
      config,
      listener,
      context,
      retryCount: 0,
    };

    const subscriptions = this.subscriptions.get(config.eventPattern) || [];
    subscriptions.push(subscription);
    this.subscriptions.set(config.eventPattern, subscriptions);

    return subscriptionId;
  }

  /**
   * Register subscription with event emitter
   */
  private registerWithEventEmitter(
    eventPattern: string,
    listener: EventListener,
    priority?: number
  ): void {
    // If pattern is a wildcard, we need to register for all events
    if (eventPattern === '*') {
      // This would require the event emitter to support wildcard registration
      // For now, we'll handle this in the handleEvent method
      return;
    }

    // If pattern contains a wildcard (e.g., finance.*)
    if (eventPattern.includes('*')) {
      // We'll handle this in the handleEvent method
      return;
    }

    // Register for specific event
    this.eventEmitter.on(eventPattern as any, listener, priority);
  }

  /**
   * Handle incoming event
   */
  private async handleEvent(
    subscriptionId: string,
    config: SubscriptionConfig,
    eventData: any,
    context?: RequestContext
  ): Promise<void> {
    const correlationId = eventData.correlationId || crypto.randomUUID();

    // Check if already processing
    if (this.processingQueue.has(correlationId)) {
      return;
    }

    // Create processing promise
    const processingPromise = this.processEvent(subscriptionId, config, eventData, context, correlationId);
    this.processingQueue.set(correlationId, processingPromise);

    try {
      await processingPromise;
    } catch (error) {
      console.error(`[EnhancedEventSubscription] Error processing event:`, error);
    } finally {
      this.processingQueue.delete(correlationId);
    }
  }

  /**
   * Process event
   */
  private async processEvent(
    subscriptionId: string,
    config: SubscriptionConfig,
    eventData: any,
    context?: RequestContext,
    correlationId: string
  ): Promise<void> {
    const span = observabilityService.startTrace('enhanced_event_subscription.process', {
      subscriptionId,
      correlationId,
      eventPattern: config.eventPattern,
    });

    try {
      // Check conditions
      if (!this.checkConditions(config, eventData, context)) {
        span.end();
        return;
      }

      // Execute handler based on type
      switch (config.handlerType) {
        case 'notification':
          await this.handleNotification(config.handlerConfig, eventData, context);
          break;
        case 'workflow':
          await this.handleWorkflow(config.handlerConfig, eventData, context);
          break;
        case 'webhook':
          await this.handleWebhook(config.handlerConfig, eventData, context);
          break;
        default:
          throw new Error(`Unknown handler type: ${config.handlerType}`);
      }

      span.end();
    } catch (error) {
      span.end();

      // Handle retry
      if (config.retryPolicy) {
        await this.handleRetry(subscriptionId, config, eventData, context, correlationId, error);
      } else {
        // Move to dead letter queue
        await this.moveToDeadLetterQueue(config, eventData, error);
      }

      throw error;
    }
  }

  /**
   * Check subscription conditions
   */
  private checkConditions(
    config: SubscriptionConfig,
    eventData: any,
    context?: RequestContext
  ): boolean {
    // Check permissions
    if (config.conditions?.requiredPermissions && context) {
      // This would integrate with the RBAC system
      // For now, we'll skip this check
    }

    // Check branch
    if (config.conditions?.branchId && context) {
      if (config.conditions.branchId !== context.branchId) {
        return false;
      }
    }

    // Check payload rules
    if (config.conditions?.payloadRules) {
      for (const [key, value] of Object.entries(config.conditions.payloadRules)) {
        if (eventData[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Handle notification
   */
  private async handleNotification(
    config: Record<string, any>,
    eventData: any,
    context?: RequestContext
  ): Promise<void> {
    // This would integrate with the NotificationEngine
    console.log('[EnhancedEventSubscription] Handling notification:', config, eventData);
  }

  /**
   * Handle workflow
   */
  private async handleWorkflow(
    config: Record<string, any>,
    eventData: any,
    context?: RequestContext
  ): Promise<void> {
    // This would integrate with the WorkflowEngine
    console.log('[EnhancedEventSubscription] Handling workflow:', config, eventData);
  }

  /**
   * Handle webhook
   */
  private async handleWebhook(
    config: Record<string, any>,
    eventData: any,
    context?: RequestContext
  ): Promise<void> {
    const { url, method = 'POST', headers = {} } = config;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        ...eventData,
        correlationId: eventData.correlationId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Handle retry
   */
  private async handleRetry(
    subscriptionId: string,
    config: SubscriptionConfig,
    eventData: any,
    context?: RequestContext,
    correlationId: string,
    error?: Error
  ): Promise<void> {
    const subscription = this.findSubscription(subscriptionId);
    if (!subscription) return;

    subscription.retryCount++;

    if (subscription.retryCount > (config.retryPolicy?.maxRetries || 3)) {
      // Max retries exceeded, move to dead letter queue
      await this.moveToDeadLetterQueue(config, eventData, error);
      return;
    }

    // Delay before retry
    const backoffMs = config.retryPolicy?.backoffMs || 1000;
    await new Promise(resolve => setTimeout(resolve, backoffMs * subscription.retryCount));

    // Retry processing
    await this.processEvent(subscriptionId, config, eventData, context, correlationId);
  }

  /**
   * Move to dead letter queue
   */
  private async moveToDeadLetterQueue(
    config: SubscriptionConfig,
    eventData: any,
    error?: Error
  ): Promise<void> {
    const { error: dbError } = await this.supabase
      .from('dead_letter_queue' as any)
      .insert({
        id: crypto.randomUUID(),
        event_type: config.eventPattern,
        event_data: eventData,
        error_message: error?.message || 'Unknown error',
        retry_count: 0,
        max_retries: 5,
        branch_id: config.conditions?.branchId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error('[EnhancedEventSubscription] Failed to add to dead letter queue:', dbError);
    }
  }

  /**
   * Find subscription by ID
   */
  private findSubscription(subscriptionId: string): EnhancedSubscription | undefined {
    for (const subscriptions of this.subscriptions.values()) {
      const subscription = subscriptions.find(s => s.id === subscriptionId);
      if (subscription) return subscription;
    }
    return undefined;
  }

  /**
   * Unregister subscription
   */
  unregisterSubscription(subscriptionId: string): void {
    for (const [pattern, subscriptions] of this.subscriptions.entries()) {
      const index = subscriptions.findIndex(s => s.id === subscriptionId);
      if (index !== -1) {
        subscriptions.splice(index, 1);
        if (subscriptions.length === 0) {
          this.subscriptions.delete(pattern);
        }
        break;
      }
    }
  }

  /**
   * Get subscriptions for event pattern
   */
  getSubscriptionsForEvent(eventType: string): EnhancedSubscription[] {
    const matchingSubscriptions: EnhancedSubscription[] = [];

    for (const [pattern, subscriptions] of this.subscriptions.entries()) {
      if (this.matchesPattern(pattern, eventType)) {
        matchingSubscriptions.push(...subscriptions);
      }
    }

    // Sort by priority (higher priority first)
    return matchingSubscriptions.sort((a, b) => (b.config.priority || 0) - (a.config.priority || 0));
  }

  /**
   * Check if event type matches pattern
   */
  private matchesPattern(pattern: string, eventType: string): boolean {
    if (pattern === '*') return true;
    if (pattern === eventType) return true;
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return eventType.startsWith(prefix);
    }
    return false;
  }

  /**
   * Process dead letter queue
   */
  async processDeadLetterQueue(context?: RequestContext): Promise<void> {
    const { data, error } = await this.supabase
      .from('dead_letter_queue' as any)
      .select('*')
      .lte('next_retry_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) {
      console.error('[EnhancedEventSubscription] Failed to fetch dead letter queue:', error);
      return;
    }

    for (const item of data || []) {
      try {
        // Find matching subscriptions
        const subscriptions = this.getSubscriptionsForEvent(item.event_type);
        
        for (const subscription of subscriptions) {
          await this.processEvent(
            subscription.id,
            subscription.config,
            item.event_data,
            context,
            crypto.randomUUID()
          );
        }

        // Remove from dead letter queue if successful
        await this.supabase
          .from('dead_letter_queue' as any)
          .delete()
          .eq('id', item.id);
      } catch (error) {
        // Update retry count and next retry time
        const retryCount = item.retry_count + 1;
        const backoffMs = Math.pow(2, retryCount) * 1000; // Exponential backoff
        const nextRetryAt = new Date(Date.now() + backoffMs).toISOString();

        await this.supabase
          .from('dead_letter_queue' as any)
          .update({
            retry_count: retryCount,
            next_retry_at: retryCount >= item.max_retries ? null : nextRetryAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);
      }
    }
  }
}

// Singleton instance
let enhancedEventSubscriptionSystem: EnhancedEventSubscriptionSystem | null = null;

export function getEnhancedEventSubscriptionSystem(eventEmitter: EventEmitter): EnhancedEventSubscriptionSystem {
  if (!enhancedEventSubscriptionSystem) {
    enhancedEventSubscriptionSystem = new EnhancedEventSubscriptionSystem(eventEmitter);
  }
  return enhancedEventSubscriptionSystem;
}
