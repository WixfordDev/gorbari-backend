const RESERVED_SLUGS = require("../config/reservedSlugs");

/**
 * Convert arbitrary text into a URL-safe slug.
 *
 * Unicode is normalised to NFKD first so accented Latin characters decompose to
 * their base letter plus a combining mark, which the diacritic strip then
 * removes ("Café" -> "cafe") rather than dropping the letter entirely.
 */
const slugifyText = (text) =>
  String(text || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    // Non-alphanumerics collapse to a single separator so "3 BHK / Park-View"
    // does not leave empty segments behind.
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    // Keep URLs a sane length. Trailing partial words are trimmed at the last
    // separator so the slug never ends mid-word.
    .slice(0, 80)
    .replace(/-+[^-]*$/, (match) => (match.length > 20 ? "" : match))
    .replace(/^-+|-+$/g, "");

/**
 * Build a slug for `title` that no other document is using.
 *
 * `existsFn` is injected rather than querying a model directly so this stays
 * usable from both the service and the migration script, and testable without a
 * database.
 *
 * Collisions get an incrementing numeric suffix: `-2`, `-3`, and so on. The
 * unique index is still the authority — this only avoids the common case of a
 * predictable clash, so callers must handle a duplicate-key error from a
 * concurrent insert.
 */
const buildUniqueSlug = async (title, existsFn) => {
  const base = slugifyText(title) || "property";

  // A slug that matches a literal route segment would be shadowed by that route,
  // so push it into the suffixed branch below.
  let candidate = RESERVED_SLUGS.has(base) ? `${base}-1` : base;

  let suffix = 1;
  while (await existsFn(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
};

module.exports = {
  slugifyText,
  buildUniqueSlug,
};
