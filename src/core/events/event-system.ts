/**
 * Lightweight Event System
 * Pub/sub pattern for decoupled communication between modules
 * Used for notifications, analytics, and future integrations
 */

/**
 * Event listener function type
 */
export type EventListener<T = any> = (data: T) => void | Promise<void>;

/**
 * Event listener with metadata
 */
interface ListenerEntry<T = any> {
  listener: EventListener<T>;
  once: boolean;
  priority: number;
}

/**
 * Event emitter class
 */
export class EventEmitter<TEvents extends Record<string, any> = Record<string, any>> {
  private listeners: Map<keyof TEvents, ListenerEntry[]> = new Map();
  private maxListeners: number = 100;

  /**
   * Set maximum number of listeners per event
   */
  setMaxListeners(n: number): void {
    this.maxListeners = n;
  }

  /**
   * Add event listener
   */
  on<K extends keyof TEvents>(
    event: K,
    listener: EventListener<TEvents[K]>,
    priority: number = 0
  ): () => void {
    const listeners = this.listeners.get(event) || [];
    
    if (listeners.length >= this.maxListeners) {
      console.warn(`EventEmitter: Max listeners (${this.maxListeners}) exceeded for event "${String(event)}"`);
    }

    const entry: ListenerEntry<TEvents[K]> = {
      listener,
      once: false,
      priority,
    };

    // Insert in priority order (higher priority first)
    const index = listeners.findIndex(l => l.priority < priority);
    if (index === -1) {
      listeners.push(entry);
    } else {
      listeners.splice(index, 0, entry);
    }

    this.listeners.set(event, listeners);

    // Return unsubscribe function
    return () => this.off(event, listener);
  }

  /**
   * Add one-time event listener
   */
  once<K extends keyof TEvents>(
    event: K,
    listener: EventListener<TEvents[K]>,
    priority: number = 0
  ): () => void {
    const listeners = this.listeners.get(event) || [];
    
    const entry: ListenerEntry<TEvents[K]> = {
      listener,
      once: true,
      priority,
    };

    // Insert in priority order (higher priority first)
    const index = listeners.findIndex(l => l.priority < priority);
    if (index === -1) {
      listeners.push(entry);
    } else {
      listeners.splice(index, 0, entry);
    }

    this.listeners.set(event, listeners);

    // Return unsubscribe function
    return () => this.off(event, listener);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof TEvents>(event: K, listener: EventListener<TEvents[K]>): void {
    const listeners = this.listeners.get(event);
    if (!listeners) return;

    const index = listeners.findIndex(l => l.listener === listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }

    if (listeners.length === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners<K extends keyof TEvents>(event?: K): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Emit event
   */
  async emit<K extends keyof TEvents>(event: K, data: TEvents[K]): Promise<void> {
    const listeners = this.listeners.get(event);
    if (!listeners || listeners.length === 0) return;

    // Create a copy to avoid issues if listeners modify the array
    const listenersCopy = [...listeners];
    const toRemove: number[] = [];

    // Execute listeners in order
    for (let i = 0; i < listenersCopy.length; i++) {
      const entry = listenersCopy[i];
      
      try {
        await entry.listener(data);
        
        if (entry.once) {
          toRemove.push(i);
        }
      } catch (error) {
        console.error(`EventEmitter: Error in listener for event "${String(event)}":`, error);
        // Continue with other listeners even if one fails
      }
    }

    // Remove one-time listeners (in reverse order to maintain indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      const index = toRemove[i];
      const actualIndex = listeners.findIndex(l => l === listenersCopy[index]);
      if (actualIndex !== -1) {
        listeners.splice(actualIndex, 1);
      }
    }

    // Clean up if no listeners left
    if (listeners.length === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * Get listener count for an event
   */
  listenerCount<K extends keyof TEvents>(event: K): number {
    return this.listeners.get(event)?.length || 0;
  }

  /**
   * Get all event names
   */
  eventNames(): (keyof TEvents)[] {
    return Array.from(this.listeners.keys());
  }
}

/**
 * Domain-specific event types
 */
export interface AppEvents {
  // Student events
  'student:created': { studentId: string; userId: string; branchId: string };
  'student:updated': { studentId: string; userId: string; changes: Record<string, any> };
  'student:deleted': { studentId: string; userId: string };
  'student:enrolled': { studentId: string; courseId: string; userId: string };
  
  // User events
  'user:logged_in': { userId: string; branchId?: string };
  'user:logged_out': { userId: string };
  'user:role_assigned': { userId: string; role: string; branchId?: string };
  
  // Finance events
  'payment:received': { paymentId: string; studentId: string; amount: number; userId: string };
  'payment:failed': { paymentId: string; studentId: string; reason: string };
  'finance:audit:logged': { auditId: string; operationType: string; entityType: string; entityId: string; amount?: number; userId: string; branchId?: string };
  
  // Audit events
  'audit:logged': { auditId: string; action: string; entityType: string };
  
  // Notification events
  'notification:created': { notification: any; userId: string };
  
  // Saga/Transaction events
  'saga:started': { executionId: string; sagaId: string; input: any; userId: string };
  'saga:completed': { executionId: string; sagaId: string; result: any; userId: string };
  'saga:failed': { executionId: string; sagaId: string; error: string; userId: string };
  'saga:compensating': { executionId: string; sagaId: string; failedStepIndex: number; userId: string };
  'saga:compensated': { executionId: string; sagaId: string; userId: string };
  'saga:step:started': { stepId: string; stepName: string; attempt: number; userId: string };
  'saga:step:completed': { stepId: string; stepName: string; attempt: number; userId: string };
  'saga:step:failed': { stepId: string; stepName: string; attempt: number; error: string; userId: string };
  
  // Branch events
  'branch:created': { branchId: string; userId: string };
  'branch:updated': { branchId: string; userId: string };
  
  // System events
  'system:error': { error: Error; context?: Record<string, any> };
  'system:warning': { message: string; context?: Record<string, any> };
}

/**
 * Global event emitter instance
 */
export const eventEmitter = new EventEmitter<AppEvents>();

/**
 * Convenience function to emit events
 */
export function emit<K extends keyof AppEvents>(event: K, data: AppEvents[K]): Promise<void> {
  return eventEmitter.emit(event, data);
}

/**
 * Convenience function to listen to events
 */
export function on<K extends keyof AppEvents>(
  event: K,
  listener: EventListener<AppEvents[K]>,
  priority?: number
): () => void {
  return eventEmitter.on(event, listener, priority);
}

/**
 * Convenience function to listen to events once
 */
export function once<K extends keyof AppEvents>(
  event: K,
  listener: EventListener<AppEvents[K]>,
  priority?: number
): () => void {
  return eventEmitter.once(event, listener, priority);
}
