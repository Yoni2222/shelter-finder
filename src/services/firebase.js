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
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!serviceAccountPath) {
    console.warn('[Firebase] FIREBASE_SERVICE_ACCOUNT not set — push notifications disabled.');
    return;
  }

  try {
    const resolvedPath = require('path').resolve(__dirname, '..', '..', serviceAccountPath);
    const serviceAccount = require(resolvedPath);

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
      },
      payload: {
        aps: {
          'mutable-content': 1,
          'content-available': 1,
          alert: {
            title: 'Rocket Alert',
            body: 'Seek shelter immediately',
          },
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
      headers: { 'apns-priority': '10' },
      payload: {
        aps: {
          'mutable-content': 1,
          'content-available': 1,
          alert: { title: 'Rocket Alert', body: 'Seek shelter immediately' },
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
