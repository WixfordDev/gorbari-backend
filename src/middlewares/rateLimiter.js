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

module.exports = {
  authLimiter,
  emailLimiter,
};
