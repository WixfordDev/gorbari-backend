/**
 * Escape user input destined for a $regex query.
 *
 * Without this, characters like `(` or `*` are interpreted as pattern syntax:
 * a search for "a(" throws an invalid-regex error, and a crafted pattern such
 * as `(a+)+$` can pin the event loop on catastrophic backtracking.
 */
const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = escapeRegex;
