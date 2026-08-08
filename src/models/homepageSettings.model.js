const mongoose = require("mongoose");
const { toJSON } = require("./plugins");

// Singleton, like AboutUs/PrivacyPolicy/TermsAndCondition - one document,
// upserted by the admin, read publicly by the website's homepage.
const homepageSettingsSchema = new mongoose.Schema(
  {
    // Ordered: display order on the homepage follows selection order.
    heroProperties: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Property",
      },
    ],
    dreamHomeProperties: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Property",
      },
    ],
    // For the "Ready to Find Your Dream Home?" section (DreamHomeLanding.jsx)
    // - not to be confused with dreamHomeProperties above, which belongs to
    // the separate "Explore & Find Your Dream Home" section. Unlimited, like
    // heroProperties/featuredProperties: falls back to boosted properties on
    // the frontend when empty, so it's never required to be non-empty here.
    dreamHomeLandingProperties: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Property",
      },
    ],
    featuredProperties: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Property",
      },
    ],
    // Heading/subheading for the "Explore & Find Your Dream Home" section.
    // Inline HTML only (bold/italic/colour) — sanitised on write in
    // info.service.js, which strips block tags so the admin can emphasise a
    // word without altering the fixed responsive type scale the layout relies
    // on. The rich-text body below them keeps structural tags.
    //
    // The accent span matches the convention every other section header uses
    // (Meet Our Expert <accent>Agents</accent>, Featured <accent>Properties</accent>).
    dreamHomeHeading: {
      type: String,
      default:
        'Explore &amp; Find Your <span class="text-gradient">Dream Home</span>',
    },
    dreamHomeSubheading: {
      type: String,
      default:
        "We believe there's a perfect home for everyone. Discover our platform's powerful features.",
    },
    // Rich HTML for the rest of that section's text panel (quote, feature
    // list, etc.) - admin-authored, like AboutUs.
    dreamHomeContent: {
      type: String,
      default:
        "<blockquote>We believe there's a perfect home for everybody, no matter the budget. That's why we always find the best homes for your budget.</blockquote>",
    },
  },
  {
    timestamps: true,
  }
);

homepageSettingsSchema.plugin(toJSON);

module.exports = mongoose.model("HomepageSettings", homepageSettingsSchema);
