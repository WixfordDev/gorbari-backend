const crypto = require("crypto");

// The emails tell the user the code is valid for 3 minutes, so that is the
// single source of truth for the lifetime.
const ONE_TIME_CODE_TTL_MINUTES = 3;

/**
 * Generate a 6-digit one-time code and the instant it stops being valid.
 *
 * `crypto.randomInt` is used rather than `Math.random` because these codes are
 * the sole credential for verifying an email address and completing a password
 * reset. `Math.random` is not cryptographically secure and its output can be
 * predicted from previous values.
 */
const generateOneTimeCode = () => ({
  oneTimeCode: String(crypto.randomInt(100000, 1000000)),
  oneTimeCodeExpires: new Date(Date.now() + ONE_TIME_CODE_TTL_MINUTES * 60 * 1000),
});

const isOneTimeCodeExpired = (expiresAt) => !expiresAt || expiresAt.getTime() < Date.now();

module.exports = {
  ONE_TIME_CODE_TTL_MINUTES,
  generateOneTimeCode,
  isOneTimeCodeExpired,
};
