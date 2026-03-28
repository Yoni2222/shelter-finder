import { Capacitor, registerPlugin } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

/**
 * Native bridge to Firebase Messaging for topic subscription.
 * The actual implementation lives in the native Android/iOS code.
 * On web, these are no-ops.
 */
interface FirebaseTopicPlugin {
  subscribeToTopic(options: { topic: string }): Promise<void>;
  unsubscribeFromTopic(options: { topic: string }): Promise<void>;
}

const FirebaseTopics = Capacitor.isNativePlatform()
  ? registerPlugin<FirebaseTopicPlugin>('FirebaseTopics')
  : null;

/**
 * Check if running in a Capacitor native environment (not web browser).
 */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Initialize push notifications: request permission and register with FCM.
 * Returns true if registration succeeded, false otherwise.
 * No-op on web (returns false).
 */
export async function initPushNotifications(): Promise<boolean> {
  if (!isNative()) return false;

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return false;

  await PushNotifications.register();

  PushNotifications.addListener('registration', async (token) => {
    console.log('[Push] Registered with token:', token.value);
    // Register token with our server for testing
    try {
      await fetch('/api/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.value }),
      });
      console.log('[Push] Token registered with server');
    } catch (err) {
      console.warn('[Push] Failed to register token with server:', err);
    }
  });

  PushNotifications.addListener('registrationError', (error) => {
    console.error('[Push] Registration error:', error);
  });

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('[Push] Notification received:', notification.title);
  });

  return true;
}

/**
 * Subscribe to an FCM topic for zone-based alerts.
 * Uses native Firebase Messaging SDK via custom Capacitor plugin bridge.
 */
export async function subscribeToTopic(topic: string): Promise<void> {
  if (!isNative() || !FirebaseTopics) return;
  try {
    await FirebaseTopics.subscribeToTopic({ topic });
    console.log('[Push] Subscribed to topic:', topic);
  } catch (err) {
    console.warn('[Push] Topic subscribe failed:', topic, err);
  }
}

/**
 * Unsubscribe from an FCM topic.
 */
export async function unsubscribeFromTopic(topic: string): Promise<void> {
  if (!isNative() || !FirebaseTopics) return;
  try {
    await FirebaseTopics.unsubscribeFromTopic({ topic });
    console.log('[Push] Unsubscribed from topic:', topic);
  } catch (err) {
    console.warn('[Push] Topic unsubscribe failed:', topic, err);
  }
}
