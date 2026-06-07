/**
 * Notification Service
 * Real-time notification system using the event system
 * Handles in-app notifications, email notifications, and push notifications
 */

import { emit, on, once } from '@/core/events/event-system';
import { supabase } from '@/integrations/supabase/client';

/**
 * Notification types
 */
export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  PAYMENT = 'payment',
  STUDENT = 'student',
  SYSTEM = 'system',
}

/**
 * Notification priority
 */
export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * Notification interface
 */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

/**
 * Create notification input
 */
export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  data?: Record<string, any>;
  expiresAt?: Date;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  userId: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  paymentNotifications: boolean;
  studentNotifications: boolean;
  systemNotifications: boolean;
}

/**
 * Notification Service
 */
export class NotificationService {
  private listeners: Map<string, (() => void)[]> = new Map();

  /**
   * Initialize notification service
   * Sets up event listeners for automatic notifications
   */
  initialize(): void {
    // Student events
    on('student:created', this.handleStudentCreated.bind(this));
    on('student:updated', this.handleStudentUpdated.bind(this));
    on('student:enrolled', this.handleStudentEnrolled.bind(this));

    // Payment events
    on('payment:received', this.handlePaymentReceived.bind(this));
    on('payment:failed', this.handlePaymentFailed.bind(this));

    // System events
    on('system:error', this.handleSystemError.bind(this));
    on('system:warning', this.handleSystemWarning.bind(this));

    // Audit events
    on('audit:logged', this.handleAuditLogged.bind(this));
  }

  /**
   * Create notification
   */
  async createNotification(input: CreateNotificationInput): Promise<Notification> {
    const notification: Notification = {
      id: crypto.randomUUID(),
      userId: input.userId,
      type: input.type,
      priority: input.priority || NotificationPriority.NORMAL,
      title: input.title,
      message: input.message,
      data: input.data,
      read: false,
      createdAt: new Date(),
      expiresAt: input.expiresAt,
    };

    // Store in database (if table exists)
    try {
      await this.storeNotification(notification);
    } catch (error) {
      console.error('Failed to store notification:', error);
    }

    // Emit notification event for real-time delivery
    await emit('notification:created', {
      notification,
      userId: input.userId,
    });

    return notification;
  }

  /**
   * Store notification in database
   */
  private async storeNotification(notification: Notification): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications' as any)
        .insert({
          id: notification.id,
          user_id: notification.userId,
          type: notification.type,
          priority: notification.priority,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          read: notification.read,
          expires_at: notification.expiresAt?.toISOString(),
        });

      if (error) throw error;
    } catch (error) {
      // If notifications table doesn't exist, just log it
      console.log('Notification (not stored):', notification);
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId: string, unreadOnly = false): Promise<Notification[]> {
    try {
      let query = supabase
        .from('notifications' as any)
        .select('*')
        .eq('user_id', userId);

      if (unreadOnly) {
        query = query.eq('read', false);
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(50);

      if (error) throw error;

      return ((data || []) as any).map((n: any) => ({
        id: n.id,
        userId: n.user_id,
        type: n.type,
        priority: n.priority,
        title: n.title,
        message: n.message,
        data: n.data,
        read: n.read,
        createdAt: new Date(n.created_at),
        expiresAt: n.expires_at ? new Date(n.expires_at) : undefined,
      }));
    } catch (error) {
      console.error('Failed to get notifications:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications' as any)
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications' as any)
        .update({ read: true })
        .eq('user_id', userId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications' as any)
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  }

  /**
   * Subscribe to user notifications (real-time)
   */
  subscribeToNotifications(userId: string, callback: (notification: Notification) => void): () => void {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notification = this.mapDbNotification(payload.new);
          callback(notification);
        }
      )
      .subscribe();

    const unsubscribe = () => {
      supabase.removeChannel(channel);
    };

    // Store unsubscribe function
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, []);
    }
    this.listeners.get(userId)!.push(unsubscribe);

    return unsubscribe;
  }

  /**
   * Unsubscribe from all notifications for user
   */
  unsubscribeAll(userId: string): void {
    const unsubscribers = this.listeners.get(userId) || [];
    unsubscribers.forEach(unsub => unsub());
    this.listeners.delete(userId);
  }

  /**
   * Map database notification to Notification interface
   */
  private mapDbNotification(dbNotification: any): Notification {
    return {
      id: dbNotification.id,
      userId: dbNotification.user_id,
      type: dbNotification.type,
      priority: dbNotification.priority,
      title: dbNotification.title,
      message: dbNotification.message,
      data: dbNotification.data,
      read: dbNotification.read,
      createdAt: new Date(dbNotification.created_at),
      expiresAt: dbNotification.expires_at ? new Date(dbNotification.expires_at) : undefined,
    };
  }

  // ==================== EVENT HANDLERS ====================

  /**
   * Handle student created event
   */
  private async handleStudentCreated(data: { studentId: string; userId: string; branchId: string }): Promise<void> {
    await this.createNotification({
      userId: data.userId,
      type: NotificationType.STUDENT,
      priority: NotificationPriority.NORMAL,
      title: 'Student Created',
      message: `A new student has been registered successfully.`,
      data: { studentId: data.studentId, branchId: data.branchId },
    });
  }

  /**
   * Handle student updated event
   */
  private async handleStudentUpdated(data: { studentId: string; userId: string; changes: Record<string, any> }): Promise<void> {
    await this.createNotification({
      userId: data.userId,
      type: NotificationType.STUDENT,
      priority: NotificationPriority.LOW,
      title: 'Student Updated',
      message: `Student information has been updated.`,
      data: { studentId: data.studentId, changes: data.changes },
    });
  }

  /**
   * Handle student enrolled event
   */
  private async handleStudentEnrolled(data: { studentId: string; courseId: string; userId: string }): Promise<void> {
    await this.createNotification({
      userId: data.userId,
      type: NotificationType.STUDENT,
      priority: NotificationPriority.NORMAL,
      title: 'Student Enrolled',
      message: `Student has been enrolled in a course.`,
      data: { studentId: data.studentId, courseId: data.courseId },
    });
  }

  /**
   * Handle payment received event
   */
  private async handlePaymentReceived(data: { paymentId: string; studentId: string; amount: number; userId: string }): Promise<void> {
    await this.createNotification({
      userId: data.userId,
      type: NotificationType.PAYMENT,
      priority: NotificationPriority.HIGH,
      title: 'Payment Received',
      message: `A payment of ${data.amount} has been received.`,
      data: { paymentId: data.paymentId, studentId: data.studentId, amount: data.amount },
    });
  }

  /**
   * Handle payment failed event
   */
  private async handlePaymentFailed(data: { paymentId: string; studentId: string; reason: string }): Promise<void> {
    // Notify finance team
    await this.createNotification({
      userId: data.studentId,
      type: NotificationType.ERROR,
      priority: NotificationPriority.URGENT,
      title: 'Payment Failed',
      message: `Payment failed: ${data.reason}`,
      data: { paymentId: data.paymentId, studentId: data.studentId, reason: data.reason },
    });
  }

  /**
   * Handle system error event
   */
  private async handleSystemError(data: { error: Error; context?: Record<string, any> }): Promise<void> {
    // Notify super admins
    await this.createNotification({
      userId: 'system', // Would need to get actual admin user IDs
      type: NotificationType.ERROR,
      priority: NotificationPriority.URGENT,
      title: 'System Error',
      message: `A system error has occurred: ${data.error.message}`,
      data: { error: data.error.message, context: data.context },
    });
  }

  /**
   * Handle system warning event
   */
  private async handleSystemWarning(data: { message: string; context?: Record<string, any> }): Promise<void> {
    await this.createNotification({
      userId: 'system',
      type: NotificationType.WARNING,
      priority: NotificationPriority.HIGH,
      title: 'System Warning',
      message: data.message,
      data: { context: data.context },
    });
  }

  /**
   * Handle audit logged event
   */
  private async handleAuditLogged(data: { auditId: string; action: string; entityType: string }): Promise<void> {
    // This could trigger notifications for sensitive actions
    if (['delete', 'update'].includes(data.action.toLowerCase())) {
      await this.createNotification({
        userId: 'system',
        type: NotificationType.INFO,
        priority: NotificationPriority.LOW,
        title: 'Audit Log',
        message: `Action logged: ${data.action} on ${data.entityType}`,
        data: { auditId: data.auditId, action: data.action, entityType: data.entityType },
      });
    }
  }

  /**
   * Get notification preferences for user
   */
  async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const { data, error } = await supabase
        .from('notification_preferences' as any)
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Return default preferences
        return this.getDefaultPreferences(userId);
      }

      const n = data as any;
      return {
        userId: n.user_id,
        inAppEnabled: n.in_app_enabled ?? true,
        emailEnabled: n.email_enabled ?? false,
        pushEnabled: n.push_enabled ?? false,
        paymentNotifications: n.payment_notifications ?? true,
        studentNotifications: n.student_notifications ?? true,
        systemNotifications: n.system_notifications ?? true,
      };
    } catch (error) {
      console.error('Failed to get notification preferences:', error);
      return this.getDefaultPreferences(userId);
    }
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(preferences: Partial<NotificationPreferences>): Promise<void> {
    try {
      const { error } = await supabase
        .from('notification_preferences' as any)
        .upsert({
          user_id: preferences.userId,
          in_app_enabled: preferences.inAppEnabled,
          email_enabled: preferences.emailEnabled,
          push_enabled: preferences.pushEnabled,
          payment_notifications: preferences.paymentNotifications,
          student_notifications: preferences.studentNotifications,
          system_notifications: preferences.systemNotifications,
        });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
    }
  }

  /**
   * Get default notification preferences
   */
  private getDefaultPreferences(userId: string): NotificationPreferences {
    return {
      userId,
      inAppEnabled: true,
      emailEnabled: false,
      pushEnabled: false,
      paymentNotifications: true,
      studentNotifications: true,
      systemNotifications: true,
    };
  }
}

// Singleton instance
export const notificationService = new NotificationService();
