const rateLimit = require('express-rate-limit');
const config = require('../config/config');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
});

/**
 * Guards the unauthenticated endpoints that send an email on request.
 *
 * These cost money per message and can be pointed at somebody else's inbox, so
 * successful calls are counted too — unlike authLimiter, the successful path is
 * exactly what needs limiting here. Disabled outside production so local
 * testing is not throttled.
 */
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    code: 429,
    message: 'Too many email requests. Please wait a few minutes and try again.',
  },
  skip: () => config.env !== 'production',
});

/**
 * Guards the public, unauthenticated contact-form endpoint. Unlike
 * emailLimiter this one is deliberately NOT skipped outside production: it
 * doesn't send an email that only matters once deployed, it writes a Contact
 * document straight into the database on every call, and that's just as easy
 * to spam locally as in prod.
 */
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    code: 429,
    message: 'Too many messages sent. Please wait a few minutes and try again.',
  },
});

/**
 * Baseline throttle for every other route. authLimiter/emailLimiter/
 * contactLimiter above are deliberately stricter for the endpoints that need
 * it; this is just a floor so no route is ever completely unthrottled - a
 * scraper hammering the public property-listing endpoints, for example, had
 * nothing at all standing in its way before this.
 */
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  emailLimiter,
  contactLimiter,
  globalLimiter,
};
