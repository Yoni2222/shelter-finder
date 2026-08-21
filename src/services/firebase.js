'use strict';

const admin = require('firebase-admin');

let messagingClient = null;
let firebaseInitialized = false;

/**
 * Initialize Firebase Admin SDK.
 * Reads service account from the path in FIREBASE_SERVICE_ACCOUNT env var.
 * Degrades gracefully if not configured.
 */
function initFirebase() {
  // Two ways to supply the service account:
  //   1. FIREBASE_SERVICE_ACCOUNT_JSON — the full JSON pasted as an env var
  //      (preferred on hosts like Koyeb where the file is not in the repo).
  //   2. FIREBASE_SERVICE_ACCOUNT — a path to a JSON file on disk (local dev).
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;

  let serviceAccount = null;

  try {
    if (inlineJson) {
      serviceAccount = JSON.parse(inlineJson);
      console.log('[Firebase] Using service account from FIREBASE_SERVICE_ACCOUNT_JSON env var.');
    } else if (serviceAccountPath) {
      const resolvedPath = require('path').resolve(__dirname, '..', '..', serviceAccountPath);
      serviceAccount = require(resolvedPath);
      console.log('[Firebase] Using service account file:', serviceAccountPath);
    } else {
      console.warn('[Firebase] No service account configured (set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT) — push notifications disabled.');
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    messagingClient = admin.messaging();
    firebaseInitialized = true;
    console.log('[Firebase] Initialized successfully.');
  } catch (err) {
    console.error('[Firebase] Failed to initialize:', err.message);
  }
}

/**
 * Send a data-only FCM message to a topic.
 * @param {string} topic - FCM topic name
 * @param {Record<string, string>} data - Data payload (all values must be strings)
 * @returns {Promise<string|null>} Message ID or null on failure
 */
async function sendToTopic(topic, data) {
  if (!firebaseInitialized || !messagingClient) {
    console.warn('[Firebase] Not initialized — skipping send to topic:', topic);
    return null;
  }

  const message = {
    topic,
    data,
    android: {
      priority: 'high',
      ttl: 0,
    },
    apns: {
      headers: {
        'apns-priority': '10',
        // Required from iOS 13. Must be 'alert': a payload carrying
        // content-available is sent as a background push, which iOS never
        // displays - that is why iPhones saw nothing.
        'apns-push-type': 'alert',
      },
      payload: {
        aps: {
          // Lets ShelterAlertExtension rewrite the body with the nearest
          // shelter before it is shown.
          'mutable-content': 1,
          alert: {
            title: 'Rocket Alert',
            body: 'Seek shelter immediately',
          },
          sound: 'default',
        },
      },
    },
  };

  try {
    const messageId = await messagingClient.send(message);
    console.log('[Firebase] Sent to topic "%s" — messageId: %s', topic, messageId);
    return messageId;
  } catch (err) {
    console.error('[Firebase] Failed to send to topic "%s":', topic, err.message);
    return null;
  }
}

/**
 * Send a data message to a specific device token (for testing).
 */
async function sendToToken(token, data) {
  if (!firebaseInitialized || !messagingClient) return null;

  const message = {
    token,
    data,
    android: { priority: 'high', ttl: 0 },
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-push-type': 'alert',
      },
      payload: {
        aps: {
          'mutable-content': 1,
          alert: {
            title: 'Rocket Alert',
            body: 'Seek shelter immediately',
          },
          sound: 'default',
        },
      },
    },
  };

  try {
    const messageId = await messagingClient.send(message);
    console.log('[Firebase] Sent to token — messageId: %s', messageId);
    return messageId;
  } catch (err) {
    console.error('[Firebase] Failed to send to token:', err.message);
    return null;
  }
}

/**
 * Check if Firebase is initialized and ready to send.
 */
function isReady() {
  return firebaseInitialized;
}

module.exports = { initFirebase, sendToTopic, sendToToken, isReady };
