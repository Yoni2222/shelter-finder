import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { isNative } from './pushNotifications';

/**
 * Listen for notification tap actions.
 * When the user taps a shelter alert notification that includes shelter coordinates,
 * open Google Maps in walking navigation mode.
 * No-op on web.
 */
export function initNotificationActions(): void {
  if (!isNative()) return;

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action.notification.data;

    if (data?.shelterLat && data?.shelterLon) {
      const lat = data.shelterLat;
      const lon = data.shelterLon;

      // On Android, use google.navigation intent for walking mode
      // On iOS, use Google Maps URL scheme (falls back to Apple Maps if not installed)
      const platform = Capacitor.getPlatform();
      let url: string;

      if (platform === 'android') {
        url = `google.navigation:q=${lat},${lon}&mode=w`;
      } else {
        // iOS: comgooglemaps scheme with walking mode, fallback to Apple Maps
        url = `comgooglemaps://?daddr=${lat},${lon}&directionsmode=walking`;
      }

      window.open(url, '_system');
    }
  });
}
