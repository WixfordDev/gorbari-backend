// firebase-admin v14 dropped the `admin.credential.cert(...)` namespace from
// the default import in favour of these modular exports.
const { initializeApp, cert } = require("firebase-admin/app");
const logger = require("./logger");

// Not validated in the Joi config schema, matching how Stripe's keys are
// handled here: optional infrastructure that the app must still boot without,
// for any environment where it hasn't been configured yet.
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
// Defensive: dotenv already expands \n inside a double-quoted value, but a
// .env edited without quotes later would otherwise silently break the key.
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

let app = null;

if (projectId && clientEmail && privateKey) {
  app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
} else {
  logger.warn(
    "Firebase Admin SDK not configured (FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY missing) - push notifications are disabled, in-app notifications still work."
  );
}

module.exports = app;
