import { useEffect, useRef, useState } from 'react';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { isNative } from '../services/pushNotifications';

// ── Types ──

interface ShelterRecord {
  id: string;
  lat: number;
  lon: number;
  name: string;
  address: string;
  category: string;
}

interface BundleVersion {
  version: string;
  count: number;
  generatedAt: string;
}

interface ShelterBundleState {
  /** All shelters from the local bundle (empty on web or if not yet loaded) */
  shelters: ShelterRecord[];
  /** Whether the bundle is currently being downloaded */
  loading: boolean;
  /** Bundle version string */
  version: string | null;
  /** Find the nearest shelter to given coordinates */
  findNearest: (lat: number, lon: number) => ShelterRecord | null;
}

const PREFS_KEY_VERSION = 'shelterBundleVersion';
const BUNDLE_FILENAME = 'shelter-bundle.json';

// ── Haversine (lightweight, for nearest-shelter lookup) ──

function distKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Hook ──

export function useShelterBundle(): ShelterBundleState {
  const [shelters, setShelters] = useState<ShelterRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const sheltersRef = useRef<ShelterRecord[]>([]);

  // Load bundle from filesystem or download if needed
  useEffect(() => {
    if (!isNative()) return;

    let cancelled = false;

    const loadBundle = async () => {
      setLoading(true);
      try {
        // 1. Check server version
        const serverVersion = await fetchServerVersion();

        // 2. Check locally stored version
        const localVersion = (await Preferences.get({ key: PREFS_KEY_VERSION })).value;

        // 3. If versions match, load from local filesystem
        if (serverVersion && localVersion === serverVersion) {
          const localData = await readLocalBundle();
          if (localData && !cancelled) {
            sheltersRef.current = localData;
            setShelters(localData);
            setVersion(localVersion);
            setLoading(false);
            console.log(`[Bundle] Loaded ${localData.length} shelters from cache (v${localVersion})`);
            return;
          }
        }

        // 4. Download new bundle
        console.log('[Bundle] Downloading shelter bundle...');
        const response = await fetch('/api/shelter-bundle');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data: ShelterRecord[] = await response.json();
        if (cancelled) return;

        // 5. Save to filesystem
        await Filesystem.writeFile({
          path: BUNDLE_FILENAME,
          data: JSON.stringify(data),
          directory: Directory.Data,
          encoding: Encoding.UTF8,
        });

        // 6. Update stored version
        if (serverVersion) {
          await Preferences.set({ key: PREFS_KEY_VERSION, value: serverVersion });
        }

        sheltersRef.current = data;
        setShelters(data);
        setVersion(serverVersion);
        console.log(`[Bundle] Downloaded ${data.length} shelters (v${serverVersion})`);
      } catch (err) {
        console.error('[Bundle] Load failed:', err);

        // Try to load stale local data as fallback
        try {
          const localData = await readLocalBundle();
          if (localData && !cancelled) {
            sheltersRef.current = localData;
            setShelters(localData);
            console.log(`[Bundle] Loaded ${localData.length} shelters from stale cache`);
          }
        } catch {
          // No local data available
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadBundle();

    return () => {
      cancelled = true;
    };
  }, []);

  // Find nearest shelter to given coordinates
  const findNearest = (lat: number, lon: number): ShelterRecord | null => {
    const data = sheltersRef.current;
    if (data.length === 0) return null;

    let best: ShelterRecord | null = null;
    let bestDist = Infinity;

    for (const s of data) {
      const d = distKm(lat, lon, s.lat, s.lon);
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }

    return best;
  };

  return { shelters, loading, version, findNearest };
}

// ── Helpers ──

async function fetchServerVersion(): Promise<string | null> {
  try {
    const res = await fetch('/api/shelter-version');
    if (!res.ok) return null;
    const data: BundleVersion = await res.json();
    return data.version;
  } catch {
    return null;
  }
}

async function readLocalBundle(): Promise<ShelterRecord[] | null> {
  try {
    const result = await Filesystem.readFile({
      path: BUNDLE_FILENAME,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    return JSON.parse(result.data as string);
  } catch {
    return null;
  }
}
