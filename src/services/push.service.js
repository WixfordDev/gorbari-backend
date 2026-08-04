const { getMessaging } = require("firebase-admin/messaging");
const logger = require("../config/logger");
const firebaseApp = require("../config/firebase");

/**
 * Send a single push message to one device token.
 *
 * Silent no-op when Firebase isn't configured or the user has no token
 * (never granted permission, or hasn't opened the site since this shipped) -
 * the in-app notification (already created before this is called) is the
 * fallback either way, so a missing token is not an error.
 */
const sendPushToToken = async (token, { title, body, data } = {}) => {
  if (!firebaseApp || !token) return;

  try {
    await getMessaging(firebaseApp).send({
      token,
      notification: { title, body },
      // FCM requires every data value to be a string.
      data: Object.fromEntries(
        Object.entries(data || {}).map(([key, value]) => [key, String(value)])
      ),
    });
  } catch (err) {
    logger.error("Failed to send push notification: %s", err.message || err);
  }
};

module.exports = { sendPushToToken };
