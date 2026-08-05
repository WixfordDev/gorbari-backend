const sanitizeHtml = require("sanitize-html");

/**
 * Admin-authored HTML is rendered with dangerouslySetInnerHTML on the website,
 * so it has to be sanitised before it is stored. Sanitising on write rather
 * than on read means every consumer is protected without having to remember to
 * do it, and the stored value is the safe value.
 *
 * Note that he.decode() runs before this: the editor posts entity-encoded
 * markup, decoding turns it back into real tags, and those tags are what needs
 * checking. Sanitising first would inspect harmless entity text and let the
 * decoded result through unchecked.
 */

// Inline formatting only. Headings have a fixed responsive size scale that the
// page layout depends on, so block-level tags, headings and lists are dropped
// rather than escaped — the admin gets colour, weight and emphasis without
// being able to break the type scale or push the section out of alignment.
const INLINE_TAGS = ["b", "strong", "i", "em", "u", "s", "span", "mark", "br"];

// The body panel is a genuine rich-text field, so it keeps structural tags.
const BLOCK_TAGS = [
  ...INLINE_TAGS,
  "p", "blockquote", "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "a", "img", "hr", "div",
];

// style is allowed because colour and highlight are the point of this feature,
// but only the specific properties below, and only against a value pattern —
// an unrestricted style attribute allows url() and expression() payloads.
const ALLOWED_STYLES = {
  "*": {
    color: [/^#(0x)?[0-9a-f]+$/i, /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/i, /^[a-z-]+$/i],
    "background-color": [/^#(0x)?[0-9a-f]+$/i, /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/i, /^[a-z-]+$/i],
    "font-weight": [/^(bold|bolder|lighter|normal|\d{3})$/i],
    "font-style": [/^(italic|normal|oblique)$/i],
    "text-decoration": [/^[a-z\s-]+$/i],
  },
};

const baseOptions = {
  allowedStyles: ALLOWED_STYLES,
  // class is needed for the site's own .text-gradient accent on headings.
  allowedAttributes: {
    "*": ["style", "class"],
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height"],
  },
  // Blocks javascript: and data: URIs, which are the usual way an href or src
  // smuggles script past a tag allowlist.
  allowedSchemes: ["http", "https", "mailto"],
  // Discard the content of these outright. Without this, sanitize-html strips
  // the <script> tag but keeps the code inside it as visible text.
  nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe"],
  transformTags: {
    // A link that opens a new tab can reach back through window.opener without
    // this, and admin-authored content may point anywhere.
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: "noopener noreferrer nofollow" },
    }),
  },
};

/** Sanitise a heading/subheading: inline formatting only. */
const sanitizeInlineHtml = (html) =>
  typeof html === "string"
    ? sanitizeHtml(html, { ...baseOptions, allowedTags: INLINE_TAGS })
    : html;

/** Sanitise a rich-text body: structural tags allowed. */
const sanitizeRichHtml = (html) =>
  typeof html === "string"
    ? sanitizeHtml(html, { ...baseOptions, allowedTags: BLOCK_TAGS })
    : html;

module.exports = { sanitizeInlineHtml, sanitizeRichHtml };
