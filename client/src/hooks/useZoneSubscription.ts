import { useEffect, useRef, useState, useCallback } from 'react';
import { Preferences } from '@capacitor/preferences';
import { Geolocation } from '@capacitor/geolocation';
import { getApiBase } from '../config/api';
import {
  isNative,
  subscribeToTopic,
  unsubscribeFromTopic,
} from '../services/pushNotifications';

// ── Types ──

interface ZoneInfo {
  topic: string;
  nameEn: string;
  timeToShelter: number;
  center: { lat: number; lon: number };
  radius: number;
  neighbors: string[];
}

interface ZoneData {
  zones: Record<string, ZoneInfo>;
  cityToZones: Record<string, string[]>;
  alertNameToZone: Record<string, string>;
}

interface ZoneSubscriptionState {
  /** Current zone topic the user is in (null if unknown) */
  currentZone: string | null;
  /** All FCM topics currently subscribed to (zone + neighbors) */
  subscribedTopics: string[];
  /** Human-readable zone name (Hebrew key from zone data) */
  zoneName: string | null;
  /** Time to reach shelter in this zone (seconds) */
  timeToShelter: number | null;
}

const LOCATION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const PREFS_KEY_ZONE = 'lastZone';
const PREFS_KEY_LAT = 'lastLat';
const PREFS_KEY_LON = 'lastLon';

// ── Haversine ──

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Zone matching ──

function findZoneByCoords(
  lat: number,
  lon: number,
  zoneData: ZoneData | null,
): { name: string; topic: string; neighbors: string[]; timeToShelter: number } | null {
  if (!zoneData) return null;

  let bestName: string | null = null;
  let bestDist = Infinity;

  for (const [name, info] of Object.entries(zoneData.zones)) {
    const dist = haversine(lat, lon, info.center.lat, info.center.lon);
    // Match if within zone radius
    if (dist <= info.radius && dist < bestDist) {
      bestDist = dist;
      bestName = name;
    }
  }

  // If no zone matched by radius, find the closest zone center
  if (!bestName) {
    for (const [name, info] of Object.entries(zoneData.zones)) {
      const dist = haversine(lat, lon, info.center.lat, info.center.lon);
      if (dist < bestDist) {
        bestDist = dist;
        bestName = name;
      }
    }
  }

  if (!bestName) return null;

  const zone = zoneData.zones[bestName];
  return {
    name: bestName,
    topic: zone.topic,
    neighbors: zone.neighbors,
    timeToShelter: zone.timeToShelter,
  };
}

// ── Hook ──

export function useZoneSubscription(): ZoneSubscriptionState {
  const [currentZone, setCurrentZone] = useState<string | null>(null);
  const [subscribedTopics, setSubscribedTopics] = useState<string[]>([]);
  const [zoneName, setZoneName] = useState<string | null>(null);
  const [timeToShelter, setTimeToShelter] = useState<number | null>(null);
  const zoneDataRef = useRef<ZoneData | null>(null);
  const subscribedRef = useRef<string[]>([]);

  // Keep ref in sync with state for use in interval callback
  const currentZoneRef = useRef<string | null>(null);
  useEffect(() => {
    currentZoneRef.current = currentZone;
  }, [currentZone]);

  // Fetch zone data once on mount
  useEffect(() => {
    if (!isNative()) return;

    fetch(`${getApiBase()}/api/zones`)
      .then((res) => res.json())
      .then((data: ZoneData) => {
        zoneDataRef.current = data;
      })
      .catch((err) => console.error('[Zone] Failed to fetch zone data:', err));
  }, []);

  // Update subscriptions when zone changes
  const updateSubscriptions = useCallback(
    async (newTopic: string, neighborTopics: string[]) => {
      // Unsubscribe from old topics
      for (const topic of subscribedRef.current) {
        await unsubscribeFromTopic(topic);
      }

      // Subscribe to new zone + neighbors
      const newTopics = [newTopic, ...neighborTopics];
      const uniqueTopics = [...new Set(newTopics)];

      for (const topic of uniqueTopics) {
        await subscribeToTopic(topic);
      }

      subscribedRef.current = uniqueTopics;
      setSubscribedTopics(uniqueTopics);
    },
    [],
  );

  // Periodically check location and update zone subscription
  useEffect(() => {
    if (!isNative()) return;

    const checkZone = async () => {
      try {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 8000,
        });
        const { latitude, longitude } = pos.coords;

        const zone = findZoneByCoords(latitude, longitude, zoneDataRef.current);
        if (!zone) return;

        // Only update if zone changed
        if (zone.topic !== currentZoneRef.current) {
          await updateSubscriptions(zone.topic, zone.neighbors);

          setCurrentZone(zone.topic);
          setZoneName(zone.name);
          setTimeToShelter(zone.timeToShelter);

          // Cache last known zone for fallback on next app start
          await Preferences.set({ key: PREFS_KEY_ZONE, value: zone.topic });
          await Preferences.set({ key: PREFS_KEY_LAT, value: String(latitude) });
          await Preferences.set({ key: PREFS_KEY_LON, value: String(longitude) });

          console.log(`[Zone] Switched to zone: ${zone.name} (${zone.topic})`);
        }
      } catch (err) {
        console.error('[Zone] Location check failed:', err);

        // On first failure, try to restore from cached zone
        if (!currentZoneRef.current) {
          try {
            const cached = await Preferences.get({ key: PREFS_KEY_ZONE });
            if (cached.value) {
              setCurrentZone(cached.value);
              console.log('[Zone] Restored cached zone:', cached.value);
            }
          } catch {
            // Ignore cache read errors
          }
        }
      }
    };

    checkZone(); // Check immediately on mount
    const interval = setInterval(checkZone, LOCATION_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [updateSubscriptions]);

  return { currentZone, subscribedTopics, zoneName, timeToShelter };
}
