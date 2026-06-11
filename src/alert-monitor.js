'use strict';

const { sendToTopic, isReady } = require('./services/firebase');
const { getZoneByName } = require('./data/zone-helpers');

const OREF_API = 'https://www.oref.org.il/warningMessages/alert/Alerts.json';
const POLL_INTERVAL_MS = 8000;
const SEEN_ALERT_TTL_MS = 5 * 60 * 1000; // 5 minutes

const OREF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://www.oref.org.il/',
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'application/json',
};

// Map of "alertKey" -> timestamp when first seen
const recentAlerts = new Map();
let pollTimer = null;
let running = false;

/**
 * Generate a unique key for an alert to detect duplicates.
 */
function alertKey(zone, alertTime) {
  return zone + '|' + (alertTime || Date.now());
}

/**
 * Purge alerts older than TTL from the seen set.
 */
function purgeExpired() {
  const now = Date.now();
  for (const [key, ts] of recentAlerts) {
    if (now - ts > SEEN_ALERT_TTL_MS) {
      recentAlerts.delete(key);
    }
  }
}

/**
 * Parse the Pikud HaOref API response.
 * Returns an array of zone name strings, or empty array.
 */
function parseAlerts(body) {
  if (!body) return [];

  // Strip UTF-8 BOM and surrounding whitespace. The oref endpoint prefixes
  // its JSON with a BOM (EF BB BF) and returns BOM + CRLF when idle.
  const clean = body.replace(/^﻿/, '').trim();
  if (clean === '') return [];

  try {
    const parsed = JSON.parse(clean);

    const collect = (val) => {
      if (!val) return [];
      // Modern format: data is an array of zone-name strings
      if (Array.isArray(val)) {
        return val.map(s => String(s).trim()).filter(Boolean);
      }
      // Legacy format: data is a comma-separated string
      return String(val).split(',').map(s => s.trim()).filter(Boolean);
    };

    // Modern endpoint: a single object { id, cat, title, data: [...], desc }
    if (parsed && !Array.isArray(parsed) && parsed.data !== undefined) {
      return collect(parsed.data);
    }

    // Legacy endpoint: an array of objects each with a .data field
    if (Array.isArray(parsed)) {
      const zones = [];
      for (const item of parsed) {
        if (item && item.data !== undefined) zones.push(...collect(item.data));
      }
      return zones;
    }

    return [];
  } catch {
    return [];
  }
}


/**
 * Poll the Pikud HaOref API once.
 */
async function poll() {
  try {
    const res = await fetch(OREF_API, {
      headers: OREF_HEADERS,
      signal: AbortSignal.timeout(6000),
    });

    const body = await res.text();
    const zones = parseAlerts(body);

    if (zones.length === 0) return;

    purgeExpired();
    const now = Date.now();
    const alertTime = new Date().toISOString();

    for (const zone of zones) {
      // Dedupe by zone name within the TTL window. The endpoint keeps
      // returning the same active alert across polls; without this we would
      // re-notify every poll interval. A genuinely new alert in the same
      // zone re-fires after the TTL purge.
      const key = zone;

      if (recentAlerts.has(key)) continue; // Already processed within TTL
      recentAlerts.set(key, now);

      // Look up zone data (topic + timeToShelter) from comprehensive zone mapping
      const zoneInfo = getZoneByName(zone);
      if (!zoneInfo) {
        console.log('[AlertMonitor] New alert in zone "%s" — no FCM topic mapped, skipping.', zone);
        continue;
      }

      const topic = zoneInfo.topic;
      console.log('[AlertMonitor] NEW ALERT: zone="%s" → topic="%s" (shelter in %ds)', zone, topic, zoneInfo.timeToShelter);

      if (isReady()) {
        await sendToTopic(topic, {
          zone,
          timeToShelter: String(zoneInfo.timeToShelter),
          alertTime,
        });
      } else {
        console.log('[AlertMonitor] Firebase not ready — alert not sent via FCM.');
      }
    }
  } catch (err) {
    // Network errors, timeouts, parse errors — log and continue
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      console.warn('[AlertMonitor] API request timed out.');
    } else {
      console.warn('[AlertMonitor] Poll error:', err.message);
    }
  }
}

/**
 * Start polling the Pikud HaOref API.
 */
function start() {
  if (running) {
    console.log('[AlertMonitor] Already running.');
    return;
  }

  running = true;
  console.log('[AlertMonitor] Started — polling every %ds.', POLL_INTERVAL_MS / 1000);
  poll(); // First poll immediately
  pollTimer = setInterval(poll, POLL_INTERVAL_MS);
}

/**
 * Stop polling.
 */
function stop() {
  if (!running) return;

  running = false;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  console.log('[AlertMonitor] Stopped.');
}

module.exports = { start, stop };
