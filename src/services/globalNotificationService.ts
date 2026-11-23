// Pure in-memory pub/sub notification event bus for real-time Socket.IO toasts & voice announcements.
// Persistent notifications are stored strictly in MySQL via notificationApi (/api/notifications).

export type TargetRole = 'PATIENT' | 'DOCTOR' | 'NURSE' | 'PHARMACIST' | 'CAREGIVER' | 'INSURANCE' | 'ADMIN' | 'ALL';

export interface GlobalNotification {
  id: string;
  title: string;
  message: string;
  type?: string;
  category?: string;
  targetRole?: TargetRole | string;
  recipientRole?: TargetRole | string;
  targetUserId?: string;
  recipientUserId?: string;
  dependentId?: string;
  timestamp?: string;
  createdAt?: string;
  isRead?: boolean;
  read?: boolean;
  priority?: string;
  relatedEntityId?: string;
  relatedModule?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

type NotificationListener = (notification: GlobalNotification) => void;

class GlobalNotificationService {
  private listeners: Set<NotificationListener> = new Set();

  subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispatchNotification(notification: GlobalNotification): void {
    const payload: GlobalNotification = {
      ...notification,
      id: notification.id || `rt-${Date.now()}`,
      timestamp: notification.timestamp || new Date().toISOString(),
      isRead: notification.isRead ?? false,
    };
    this.listeners.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.error('[GlobalNotificationService] Listener error:', err);
      }
    });
  }
}

export const globalNotificationService = new GlobalNotificationService();
