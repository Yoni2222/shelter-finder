import { Capacitor } from '@capacitor/core';

/**
 * Returns the base URL for API calls.
 * - Web (served from Express): empty string (relative URLs work)
 * - Native dev (emulator): http://localhost:3002 (via adb reverse)
 * - Native production: https://shelter-finder.com
 */
export function getApiBase(): string {
  if (!Capacitor.isNativePlatform()) return '';
  // In dev, server.url in capacitor.config.ts handles this
  // In production (no server.url), we need the full URL
  return 'https://shelter-finder.com';
}
