/**
 * Slugs that must never be handed out, because a literal route segment would
 * shadow them.
 *
 * `GET /property/all` and `GET /property/selp/all` are declared before
 * `GET /property/:idOrSlug`, so Express matches them first — a property slugged
 * `all` would be unreachable. `create` is listed for the same reason on the
 * POST side, and to leave room for the conventional REST verbs.
 */
const RESERVED_SLUGS = new Set(["all", "selp", "create", "new", "edit", "search"]);

module.exports = RESERVED_SLUGS;
