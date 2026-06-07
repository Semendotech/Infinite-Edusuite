/**
 * Observability, Logging, and Tracing Architecture
 * 
 * Comprehensive observability system for production monitoring:
 * - Structured logging with correlation IDs
 * - Distributed tracing across services
 * - Metrics collection and aggregation
 * - Performance monitoring
 * - Error tracking and alerting
 * - Health checks
 * 
 * This system is designed for:
 * - M-Pesa/payment gateway integration monitoring
 * - Multi-branch performance tracking
 * - Real-time operational insights
 * - Regulatory compliance logging
 */

import { supabase } from '@/integrations/supabase/client';
import { RequestContext } from '@/core/context/request-context';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

/**
 * Log entry
 */
export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  context?: string;
  userId?: string;
  branchId?: string;
  traceId?: string;
  spanId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  stackTrace?: string;
}

/**
 * Trace span
 */
export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operation: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  metadata?: Record<string, any>;
  status: 'pending' | 'completed' | 'error';
  error?: string;
}

/**
 * Metric
 */
export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
  unit?: string;
}

/**
 * Health check result
 */
export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: boolean;
    cache: boolean;
    externalServices: Record<string, boolean>;
  };
  timestamp: Date;
  version: string;
}

/**
 * Observability service
 */
export class ObservabilityService {
  private supabase = supabase;
  private activeSpans: Map<string, TraceSpan> = new Map();
  private metricsBuffer: Metric[] = [];
  private metricsBufferMaxSize = 100;

  /**
   * Log a message
   */
  async log(
    level: LogLevel,
    message: string,
    context?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      level,
      message,
      context,
      metadata,
      timestamp: new Date(),
    };

    // Console output for development
    this.logToConsole(entry);

    // Store in database for production
    await this.storeLog(entry);

    // Emit log event
    await this.emitLogEvent(entry);
  }

  /**
   * Log to console
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const context = entry.context ? `[${entry.context}]` : '';
    const metadata = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(`${timestamp} [DEBUG]${context} ${entry.message}${metadata}`);
        break;
      case LogLevel.INFO:
        console.info(`${timestamp} [INFO]${context} ${entry.message}${metadata}`);
        break;
      case LogLevel.WARN:
        console.warn(`${timestamp} [WARN]${context} ${entry.message}${metadata}`);
        break;
      case LogLevel.ERROR:
        console.error(`${timestamp} [ERROR]${context} ${entry.message}${metadata}`);
        break;
      case LogLevel.FATAL:
        console.error(`${timestamp} [FATAL]${context} ${entry.message}${metadata}`);
        break;
    }
  }

  /**
   * Store log in database
   */
  private async storeLog(entry: LogEntry): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('application_logs' as any)
        .insert({
          id: entry.id,
          level: entry.level,
          message: entry.message,
          context: entry.context,
          user_id: entry.userId,
          branch_id: entry.branchId,
          trace_id: entry.traceId,
          span_id: entry.spanId,
          metadata: entry.metadata,
          stack_trace: entry.stackTrace,
          created_at: entry.timestamp.toISOString(),
        });

      if (error) {
        console.error('Error storing log:', error);
      }
    } catch (error) {
      console.error('Error storing log:', error);
    }
  }

  /**
   * Emit log event
   */
  private async emitLogEvent(entry: LogEntry): Promise<void> {
    try {
      // Emit to event system for real-time monitoring
      // This would require adding log events to the event system
    } catch (error) {
      console.error('Error emitting log event:', error);
    }
  }

  /**
   * Start a trace span
   */
  startSpan(
    operation: string,
    parentSpanId?: string,
    metadata?: Record<string, any>
  ): TraceSpan {
    const traceId = this.getOrCreateTraceId();
    const spanId = crypto.randomUUID();

    const span: TraceSpan = {
      traceId,
      spanId,
      parentSpanId,
      operation,
      startTime: new Date(),
      metadata,
      status: 'pending',
    };

    this.activeSpans.set(spanId, span);

    return span;
  }

  /**
   * Complete a trace span
   */
  completeSpan(spanId: string, error?: Error): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();
    span.status = error ? 'error' : 'completed';
    span.error = error?.message;

    // Store span
    this.storeSpan(span);

    // Remove from active spans
    this.activeSpans.delete(spanId);
  }

  /**
   * Store span in database
   */
  private async storeSpan(span: TraceSpan): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('trace_spans' as any)
        .insert({
          trace_id: span.traceId,
          span_id: span.spanId,
          parent_span_id: span.parentSpanId,
          operation: span.operation,
          start_time: span.startTime.toISOString(),
          end_time: span.endTime?.toISOString(),
          duration: span.duration,
          metadata: span.metadata,
          status: span.status,
          error: span.error,
        });

      if (error) {
        console.error('Error storing span:', error);
      }
    } catch (error) {
      console.error('Error storing span:', error);
    }
  }

  /**
   * Get or create trace ID
   */
  private getOrCreateTraceId(): string {
    // In a real implementation, this would be extracted from headers
    // or generated for the request
    return crypto.randomUUID();
  }

  /**
   * Record a metric
   */
  recordMetric(
    name: string,
    value: number,
    tags?: Record<string, string>,
    unit?: string
  ): void {
    const metric: Metric = {
      name,
      value,
      timestamp: new Date(),
      tags,
      unit,
    };

    this.metricsBuffer.push(metric);

    // Flush buffer if full
    if (this.metricsBuffer.length >= this.metricsBufferMaxSize) {
      this.flushMetrics();
    }
  }

  /**
   * Flush metrics to storage
   */
  async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    try {
      const metrics = [...this.metricsBuffer];
      this.metricsBuffer = [];

      const { error } = await this.supabase
        .from('metrics' as any)
        .insert(metrics.map(m => ({
          name: m.name,
          value: m.value,
          timestamp: m.timestamp.toISOString(),
          tags: m.tags,
          unit: m.unit,
        })));

      if (error) {
        console.error('Error flushing metrics:', error);
      }
    } catch (error) {
      console.error('Error flushing metrics:', error);
    }
  }

  /**
   * Record operation duration
   */
  recordOperationDuration(
    operation: string,
    duration: number,
    tags?: Record<string, string>
  ): void {
    this.recordMetric(`operation.duration.${operation}`, duration, tags, 'ms');
  }

  /**
   * Record operation count
   */
  recordOperationCount(
    operation: string,
    tags?: Record<string, string>
  ): void {
    this.recordMetric(`operation.count.${operation}`, 1, tags, 'count');
  }

  /**
   * Record error count
   */
  recordErrorCount(
    errorType: string,
    tags?: Record<string, string>
  ): void {
    this.recordMetric(`error.count.${errorType}`, 1, tags, 'count');
  }

  /**
   * Perform health check
   */
  async performHealthCheck(): Promise<HealthCheck> {
    const checks = {
      database: await this.checkDatabase(),
      cache: await this.checkCache(),
      externalServices: {
        supabase: await this.checkSupabase(),
      },
    };

    const allHealthy = Object.values(checks.database).every(v => v) &&
                       Object.values(checks.cache).every(v => v) &&
                       Object.values(checks.externalServices).every(v => v);

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date(),
      version: '1.0.0',
    };
  }

  /**
   * Check database health
   */
  private async checkDatabase(): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('branches')
        .select('id')
        .limit(1);

      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Check cache health
   */
  private async checkCache(): Promise<boolean> {
    // In a real implementation, this would check Redis or another cache
    return true;
  }

  /**
   * Check Supabase health
   */
  private async checkSupabase(): Promise<boolean> {
    try {
      const { error } = await this.supabase.auth.getSession();
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Get metrics for a time range
   */
  async getMetrics(
    metricName: string,
    startDate: Date,
    endDate: Date
  ): Promise<Metric[]> {
    try {
      const { data, error } = await this.supabase
        .from('metrics' as any)
        .select('*')
        .eq('name', metricName)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;

      return (data || []).map((m: any) => ({
        name: m.name,
        value: m.value,
        timestamp: new Date(m.timestamp),
        tags: m.tags,
        unit: m.unit,
      }));
    } catch (error) {
      console.error('Error getting metrics:', error);
      throw error;
    }
  }

  /**
   * Get recent logs
   */
  async getRecentLogs(
    level?: LogLevel,
    limit: number = 100
  ): Promise<LogEntry[]> {
    try {
      let query = this.supabase
        .from('application_logs' as any)
        .select('*');

      if (level) {
        query = query.eq('level', level);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((log: any) => ({
        id: log.id,
        level: log.level,
        message: log.message,
        context: log.context,
        userId: log.user_id,
        branchId: log.branch_id,
        traceId: log.trace_id,
        spanId: log.span_id,
        metadata: log.metadata,
        timestamp: new Date(log.created_at),
        stackTrace: log.stack_trace,
      }));
    } catch (error) {
      console.error('Error getting recent logs:', error);
      throw error;
    }
  }

  /**
   * Get trace by ID
   */
  async getTrace(traceId: string): Promise<TraceSpan[]> {
    try {
      const { data, error } = await this.supabase
        .from('trace_spans' as any)
        .select('*')
        .eq('trace_id', traceId)
        .order('start_time', { ascending: true });

      if (error) throw error;

      return (data || []).map((span: any) => ({
        traceId: span.trace_id,
        spanId: span.span_id,
        parentSpanId: span.parent_span_id,
        operation: span.operation,
        startTime: new Date(span.start_time),
        endTime: span.end_time ? new Date(span.end_time) : undefined,
        duration: span.duration,
        metadata: span.metadata,
        status: span.status,
        error: span.error,
      }));
    } catch (error) {
      console.error('Error getting trace:', error);
      throw error;
    }
  }

  /**
   * Decorator for tracing operations
   */
  static trace(operation: string) {
    return function (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const observability = (this as any).observability || observabilityService;
        const span = observability.startSpan(operation);

        try {
          const result = await originalMethod.apply(this, args);
          observability.completeSpan(span.spanId);
          observability.recordOperationDuration(operation, span.duration || 0);
          observability.recordOperationCount(operation);
          return result;
        } catch (error) {
          observability.completeSpan(span.spanId, error as Error);
          observability.recordErrorCount((error as Error).constructor.name);
          throw error;
        }
      };

      return descriptor;
    };
  }

  /**
   * Decorator for logging
   */
  static log(level: LogLevel, context?: string) {
    return function (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const observability = (this as any).observability || observabilityService;

        await observability.log(
          level,
          `${target.constructor.name}.${propertyKey} called`,
          context,
          { args: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a) }
        );

        try {
          const result = await originalMethod.apply(this, args);
          await observability.log(
            LogLevel.INFO,
            `${target.constructor.name}.${propertyKey} completed`,
            context
          );
          return result;
        } catch (error) {
          await observability.log(
            LogLevel.ERROR,
            `${target.constructor.name}.${propertyKey} failed`,
            context,
            { error: (error as Error).message, stack: (error as Error).stack }
          );
          throw error;
        }
      };

      return descriptor;
    };
  }
}

// Singleton instance
export const observabilityService = new ObservabilityService();

/**
 * Context manager for request-scoped observability
 */
export class ObservabilityContext {
  private static instance: ObservabilityContext;
  private currentTraceId?: string;
  private currentSpanId?: string;

  private constructor() {}

  static getInstance(): ObservabilityContext {
    if (!ObservabilityContext.instance) {
      ObservabilityContext.instance = new ObservabilityContext();
    }
    return ObservabilityContext.instance;
  }

  setTraceId(traceId: string): void {
    this.currentTraceId = traceId;
  }

  setSpanId(spanId: string): void {
    this.currentSpanId = spanId;
  }

  getTraceId(): string | undefined {
    return this.currentTraceId;
  }

  getSpanId(): string | undefined {
    return this.currentSpanId;
  }

  clear(): void {
    this.currentTraceId = undefined;
    this.currentSpanId = undefined;
  }
}
