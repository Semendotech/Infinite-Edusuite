/**
 * Domain Event Store Architecture
 * 
 * Event Sourcing pattern implementation for immutable domain events.
 * This provides:
 * - Append-only event log
 * - Event replay capabilities
 * - Event versioning
 * - Event projection/snapshot support
 * - Cross-service event propagation
 * - Event serialization/deserialization
 * - Event metadata tracking
 */

import { supabase } from '@/integrations/supabase/client';
import { emit } from './event-system';
import { RequestContext } from '@/core/context/request-context';

/**
 * Domain event interface
 */
export interface DomainEvent {
  id: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  version: number;
  data: Record<string, any>;
  metadata?: {
    userId?: string;
    branchId?: string;
    ipAddress?: string;
    userAgent?: string;
    correlationId?: string;
    causationId?: string;
    timestamp: Date;
  };
  createdAt: Date;
}

/**
 * Event envelope for storage
 */
export interface EventEnvelope {
  id: string;
  aggregate_id: string;
  aggregate_type: string;
  event_type: string;
  version: number;
  data: Record<string, any>;
  metadata: Record<string, any>;
  created_at: string;
}

/**
 * Event snapshot for performance
 */
export interface EventSnapshot {
  aggregateId: string;
  aggregateType: string;
  version: number;
  state: Record<string, any>;
  createdAt: Date;
}

/**
 * Event store service
 */
export class EventStore {
  private supabase = supabase;

  /**
   * Append event to event store
   */
  async appendEvent(
    event: DomainEvent,
    context: RequestContext
  ): Promise<void> {
    const envelope: EventEnvelope = {
      id: event.id,
      aggregate_id: event.aggregateId,
      aggregate_type: event.aggregateType,
      event_type: event.eventType,
      version: event.version,
      data: event.data,
      metadata: {
        userId: context.userId,
        branchId: context.branchId,
        ipAddress: context.metadata?.ipAddress,
        userAgent: context.metadata?.userAgent,
        correlationId: event.metadata?.correlationId,
        causationId: event.metadata?.causationId,
        timestamp: event.metadata?.timestamp || new Date(),
      },
      created_at: event.createdAt.toISOString(),
    };

    // Store in event store
    await this.storeEnvelope(envelope);

    // Emit to event system for real-time processing
    await this.emitEvent(event);

    // Create snapshot every N events for performance
    if (event.version % 10 === 0) {
      await this.createSnapshot(event.aggregateId, event.aggregateType, event.version);
    }
  }

  /**
   * Store event envelope
   */
  private async storeEnvelope(envelope: EventEnvelope): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('event_store' as any)
        .insert(envelope);

      if (error) {
        console.error('Error storing event envelope:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error storing event envelope:', error);
      throw error;
    }
  }

  /**
   * Emit event to event system
   */
  private async emitEvent(event: DomainEvent): Promise<void> {
    try {
      await emit(event.eventType as any, {
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        eventType: event.eventType,
        version: event.version,
        data: event.data,
        metadata: event.metadata,
      });
    } catch (error) {
      console.error('Error emitting event:', error);
      // Don't throw - event emission should not break event storage
    }
  }

  /**
   * Get events for an aggregate
   */
  async getEvents(
    aggregateId: string,
    aggregateType: string,
    fromVersion?: number
  ): Promise<DomainEvent[]> {
    try {
      let query = this.supabase
        .from('event_store' as any)
        .select('*')
        .eq('aggregate_id', aggregateId)
        .eq('aggregate_type', aggregateType);

      if (fromVersion) {
        query = query.gte('version', fromVersion);
      }

      const { data, error } = await query.order('version', { ascending: true });

      if (error) throw error;

      return (data || []).map((envelope: any) => ({
        id: envelope.id,
        aggregateId: envelope.aggregate_id,
        aggregateType: envelope.aggregate_type,
        eventType: envelope.event_type,
        version: envelope.version,
        data: envelope.data,
        metadata: envelope.metadata,
        createdAt: new Date(envelope.created_at),
      }));
    } catch (error) {
      console.error('Error getting events:', error);
      throw error;
    }
  }

  /**
   * Get latest version for an aggregate
   */
  async getLatestVersion(
    aggregateId: string,
    aggregateType: string
  ): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('event_store' as any)
        .select('version')
        .eq('aggregate_id', aggregateId)
        .eq('aggregate_type', aggregateType)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return data?.version || 0;
    } catch (error) {
      console.error('Error getting latest version:', error);
      return 0;
    }
  }

  /**
   * Create snapshot for performance
   */
  async createSnapshot(
    aggregateId: string,
    aggregateType: string,
    version: number
  ): Promise<void> {
    try {
      // Get current state by replaying events
      const events = await this.getEvents(aggregateId, aggregateType);
      const state = this.replayEvents(events);

      const snapshot: EventSnapshot = {
        aggregateId,
        aggregateType,
        version,
        state,
        createdAt: new Date(),
      };

      const { error } = await this.supabase
        .from('event_snapshots' as any)
        .upsert({
          aggregate_id: aggregateId,
          aggregate_type: aggregateType,
          version,
          state,
          created_at: snapshot.createdAt.toISOString(),
        });

      if (error) {
        console.error('Error creating snapshot:', error);
      }
    } catch (error) {
      console.error('Error creating snapshot:', error);
    }
  }

  /**
   * Get latest snapshot
   */
  async getSnapshot(
    aggregateId: string,
    aggregateType: string
  ): Promise<EventSnapshot | null> {
    try {
      const { data, error } = await this.supabase
        .from('event_snapshots' as any)
        .select('*')
        .eq('aggregate_id', aggregateId)
        .eq('aggregate_type', aggregateType)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) return null;

      return {
        aggregateId: data.aggregate_id,
        aggregateType: data.aggregate_type,
        version: data.version,
        state: data.state,
        createdAt: new Date(data.created_at),
      };
    } catch (error) {
      console.error('Error getting snapshot:', error);
      return null;
    }
  }

  /**
   * Replay events to reconstruct state
   */
  replayEvents(events: DomainEvent[]): Record<string, any> {
    const state: Record<string, any> = {};

    for (const event of events) {
      this.applyEvent(state, event);
    }

    return state;
  }

  /**
   * Apply event to state
   */
  private applyEvent(state: Record<string, any>, event: DomainEvent): void {
    switch (event.eventType) {
      case 'student:created':
        state.id = event.data.id;
        state.registrationNumber = event.data.registrationNumber;
        state.firstName = event.data.firstName;
        state.lastName = event.data.lastName;
        state.email = event.data.email;
        state.status = event.data.status || 'active';
        break;

      case 'student:updated':
        Object.assign(state, event.data.changes);
        break;

      case 'payment:received':
        state.paidAmount = (state.paidAmount || 0) + event.data.amount;
        state.lastPaymentDate = event.data.paymentDate;
        break;

      case 'invoice:generated':
        state.invoiceTotal = (state.invoiceTotal || 0) + event.data.totalAmount;
        state.invoiceCount = (state.invoiceCount || 0) + 1;
        break;

      default:
        // Generic event application
        Object.assign(state, event.data);
    }
  }

  /**
   * Get state with snapshot optimization
   */
  async getState(
    aggregateId: string,
    aggregateType: string
  ): Promise<Record<string, any>> {
    // Try to get snapshot first
    const snapshot = await this.getSnapshot(aggregateId, aggregateType);

    if (snapshot) {
      // Replay events after snapshot
      const events = await this.getEvents(aggregateId, aggregateType, snapshot.version + 1);
      const state = { ...snapshot.state };
      
      for (const event of events) {
        this.applyEvent(state, event);
      }

      return state;
    }

    // No snapshot, replay all events
    const events = await this.getEvents(aggregateId, aggregateType);
    return this.replayEvents(events);
  }

  /**
   * Get events by type
   */
  async getEventsByType(
    eventType: string,
    limit: number = 100
  ): Promise<DomainEvent[]> {
    try {
      const { data, error } = await this.supabase
        .from('event_store' as any)
        .select('*')
        .eq('event_type', eventType)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((envelope: any) => ({
        id: envelope.id,
        aggregateId: envelope.aggregate_id,
        aggregateType: envelope.aggregate_type,
        eventType: envelope.event_type,
        version: envelope.version,
        data: envelope.data,
        metadata: envelope.metadata,
        createdAt: new Date(envelope.created_at),
      }));
    } catch (error) {
      console.error('Error getting events by type:', error);
      throw error;
    }
  }

  /**
   * Get events for a branch
   */
  async getEventsByBranch(
    branchId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<DomainEvent[]> {
    try {
      let query = this.supabase
        .from('event_store' as any)
        .select('*')
        .eq('metadata->>branchId', branchId);

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(1000);

      if (error) throw error;

      return (data || []).map((envelope: any) => ({
        id: envelope.id,
        aggregateId: envelope.aggregate_id,
        aggregateType: envelope.aggregate_type,
        eventType: envelope.event_type,
        version: envelope.version,
        data: envelope.data,
        metadata: envelope.metadata,
        createdAt: new Date(envelope.created_at),
      }));
    } catch (error) {
      console.error('Error getting events by branch:', error);
      throw error;
    }
  }

  /**
   * Create domain event
   */
  createEvent(
    aggregateId: string,
    aggregateType: string,
    eventType: string,
    data: Record<string, any>,
    context: RequestContext
  ): DomainEvent {
    return {
      id: crypto.randomUUID(),
      aggregateId,
      aggregateType,
      eventType,
      version: 0, // Will be set when appending
      data,
      metadata: {
        userId: context.userId,
        branchId: context.branchId,
        ipAddress: context.metadata?.ipAddress,
        userAgent: context.metadata?.userAgent,
        timestamp: new Date(),
      },
      createdAt: new Date(),
    };
  }

  /**
   * Subscribe to events for an aggregate
   */
  subscribeToAggregate(
    aggregateId: string,
    aggregateType: string,
    callback: (event: DomainEvent) => void
  ): () => void {
    const channel = this.supabase
      .channel(`event_store:${aggregateId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_store',
          filter: `aggregate_id=eq.${aggregateId}`,
        },
        (payload) => {
          const envelope = payload.new as any;
          const event: DomainEvent = {
            id: envelope.id,
            aggregateId: envelope.aggregate_id,
            aggregateType: envelope.aggregate_type,
            eventType: envelope.event_type,
            version: envelope.version,
            data: envelope.data,
            metadata: envelope.metadata,
            createdAt: new Date(envelope.created_at),
          };
          callback(event);
        }
      )
      .subscribe();

    return () => {
      this.supabase.removeChannel(channel);
    };
  }
}

// Singleton instance
export const eventStore = new EventStore();

/**
 * Aggregate base class for event sourcing
 */
export abstract class EventSourcedAggregate {
  protected aggregateId: string;
  protected aggregateType: string;
  protected version: number = 0;
  protected state: Record<string, any> = {};

  constructor(aggregateId: string, aggregateType: string) {
    this.aggregateId = aggregateId;
    this.aggregateType = aggregateType;
  }

  /**
   * Load aggregate from event store
   */
  async load(): Promise<void> {
    this.state = await eventStore.getState(this.aggregateId, this.aggregateType);
    this.version = await eventStore.getLatestVersion(this.aggregateId, this.aggregateType);
  }

  /**
   * Apply event to aggregate
   */
  protected apply(event: DomainEvent): void {
    eventStore.applyEvent(this.state, event);
    this.version = event.version;
  }

  /**
   * Emit event
   */
  protected async emit(
    eventType: string,
    data: Record<string, any>,
    context: RequestContext
  ): Promise<void> {
    this.version++;
    
    const event = eventStore.createEvent(
      this.aggregateId,
      this.aggregateType,
      eventType,
      data,
      context
    );
    
    event.version = this.version;
    
    await eventStore.appendEvent(event, context);
  }

  /**
   * Get current state
   */
  getState(): Record<string, any> {
    return { ...this.state };
  }

  /**
   * Get current version
  */
  getVersion(): number {
    return this.version;
  }
}
