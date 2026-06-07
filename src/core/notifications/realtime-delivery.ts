/**
 * Real-Time Notification Delivery
 * 
 * Implements real-time notification delivery using Supabase real-time subscriptions.
 * Supports:
 * - In-app real-time notifications
 * - Supabase real-time subscription OR polling fallback
 * - Unread counters per user
 * - Mark-as-read functionality
 * - Notification grouping
 */

import { supabase } from '@/integrations/supabase/client';
import { Notification, NotificationType } from './notification-engine';
import { RequestContext } from '@/core/context/request-context';
import { emit } from '@/core/events/event-system';

/**
 * Real-time notification subscription
 */
export interface NotificationSubscription {
  userId: string;
  branchId: string;
  onNotification: (notification: Notification) => void;
  onUnreadCountChange: (count: number) => void;
  onError?: (error: Error) => void;
}

/**
 * Real-time notification delivery service
 */
export class RealtimeNotificationDelivery {
  private subscriptions: Map<string, NotificationSubscription> = new Map();
  private realtimeChannels: Map<string, any> = new Map();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private useRealtime = true;
  private pollingIntervalMs = 5000;

  /**
   * Subscribe to real-time notifications for a user
   */
  async subscribe(subscription: NotificationSubscription): Promise<() => void> {
    const subscriptionId = `${subscription.userId}-${subscription.branchId}`;
    
    // Check if already subscribed
    if (this.subscriptions.has(subscriptionId)) {
      throw new Error(`User ${subscription.userId} is already subscribed`);
    }

    // Store subscription
    this.subscriptions.set(subscriptionId, subscription);

    // Try real-time subscription first
    if (this.useRealtime) {
      try {
        await this.setupRealtimeSubscription(subscription);
      } catch (error) {
        console.warn('[RealtimeNotificationDelivery] Real-time subscription failed, falling back to polling:', error);
        this.setupPolling(subscription);
      }
    } else {
      this.setupPolling(subscription);
    }

    // Return unsubscribe function
    return () => this.unsubscribe(subscriptionId);
  }

  /**
   * Setup real-time subscription using Supabase
   */
  private async setupRealtimeSubscription(subscription: NotificationSubscription): Promise<void> {
    const channel = supabase
      .channel(`notifications:${subscription.userId}:${subscription.branchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${subscription.userId} AND branch_id=eq.${subscription.branchId}`,
        },
        (payload) => {
          const notification = this.transformNotification(payload.new);
          subscription.onNotification(notification);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${subscription.userId} AND branch_id=eq.${subscription.branchId}`,
        },
        (payload) => {
          // When a notification is marked as read, update unread count
          if (payload.new.read_at && !payload.old.read_at) {
            this.updateUnreadCount(subscription);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[RealtimeNotificationDelivery] Real-time subscription established');
          // Initial unread count fetch
          this.updateUnreadCount(subscription);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.error('[RealtimeNotificationDelivery] Real-time subscription error:', status);
          // Fallback to polling
          this.setupPolling(subscription);
        }
      });

    this.realtimeChannels.set(`${subscription.userId}-${subscription.branchId}`, channel);
  }

  /**
   * Setup polling fallback
   */
  private setupPolling(subscription: NotificationSubscription): Promise<void> {
    const subscriptionId = `${subscription.userId}-${subscription.branchId}`;

    // Initial fetch
    this.pollNotifications(subscription);
    this.updateUnreadCount(subscription);

    // Set up polling interval
    const interval = setInterval(() => {
      this.pollNotifications(subscription);
      this.updateUnreadCount(subscription);
    }, this.pollingIntervalMs);

    this.pollingIntervals.set(subscriptionId, interval);

    return Promise.resolve();
  }

  /**
   * Poll for new notifications
   */
  private async pollNotifications(subscription: NotificationSubscription): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('notifications' as any)
        .select('*')
        .eq('user_id', subscription.userId)
        .eq('branch_id', subscription.branchId)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        subscription.onError?.(error);
        return;
      }

      // Emit notifications (in a real implementation, we'd track last seen timestamp to avoid duplicates)
      for (const notification of data || []) {
        const transformed = this.transformNotification(notification);
        subscription.onNotification(transformed);
      }
    } catch (error) {
      subscription.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Update unread count
   */
  private async updateUnreadCount(subscription: NotificationSubscription): Promise<void> {
    try {
const { data, error } = await supabase
        .rpc('get_unread_notification_count' as any, {
          p_user_id: subscription.userId,
          p_branch_id: subscription.branchId,
        });

      if (error) {
        console.error('[RealtimeNotificationDelivery] Failed to get unread count:', error);
        return;
      }

      subscription.onUnreadCountChange(data || 0);
    } catch (error) {
      console.error('[RealtimeNotificationDelivery] Error updating unread count:', error);
    }
  }

  /**
   * Transform database notification to Notification type
   */
  private transformNotification(dbNotification: any): Notification {
    return {
      id: dbNotification.id,
      userId: dbNotification.user_id,
      branchId: dbNotification.branch_id,
      type: dbNotification.type as NotificationType,
      title: dbNotification.title,
      message: dbNotification.message,
      metadata: dbNotification.metadata || {},
      readAt: dbNotification.read_at ? new Date(dbNotification.read_at) : undefined,
      createdAt: new Date(dbNotification.created_at),
      correlationId: dbNotification.correlation_id,
      eventSource: dbNotification.event_source,
    };
  }

  /**
   * Unsubscribe from notifications
   */
  unsubscribe(subscriptionId: string): void {
    // Remove subscription
    this.subscriptions.delete(subscriptionId);

    // Unsubscribe from real-time channel
    const channel = this.realtimeChannels.get(subscriptionId);
    if (channel) {
      supabase.removeChannel(channel);
      this.realtimeChannels.delete(subscriptionId);
    }

    // Clear polling interval
    const interval = this.pollingIntervals.get(subscriptionId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(subscriptionId);
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(
    notificationId: string,
    userId: string,
    branchId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('notifications' as any)
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .eq('branch_id', branchId);

    if (error) throw error;

    // Emit event for other subscribers
    await emit('notification:read', {
      notificationId,
      userId,
      branchId,
    } as any);
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string, branchId: string): Promise<number> {
    const { data, error } = await supabase
      .rpc('mark_notifications_as_read' as any, {
        p_user_id: userId,
        p_branch_id: branchId,
      });

    if (error) throw error;

    // Emit event for other subscribers
    await emit('notification:all_read', {
      userId,
      branchId,
      count: data,
    } as any);

    return data || 0;
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string, branchId: string): Promise<number> {
    const { data, error } = await supabase
      .rpc('get_unread_notification_count' as any, {
        p_user_id: userId,
        p_branch_id: branchId,
      });

    if (error) throw error;

    return data || 0;
  }

  /**
   * Get grouped notifications
   */
  async getGroupedNotifications(
    userId: string,
    branchId: string,
    context: RequestContext
  ): Promise<Record<string, Notification[]>> {
    const { data, error } = await supabase
      .from('notifications' as any)
      .select('*')
      .eq('user_id', userId)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const notifications = (data || []).map((n: any) => this.transformNotification(n));

    // Group by event source
    const grouped: Record<string, Notification[]> = {};
    for (const notification of notifications) {
      const key = notification.eventSource || 'other';
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(notification);
    }

    return grouped;
  }

  /**
   * Enable/disable real-time mode
   */
  setRealtimeMode(enabled: boolean): void {
    this.useRealtime = enabled;
  }

  /**
   * Set polling interval
   */
  setPollingInterval(intervalMs: number): void {
    this.pollingIntervalMs = intervalMs;
  }
}

// Singleton instance
export const realtimeNotificationDelivery = new RealtimeNotificationDelivery();
