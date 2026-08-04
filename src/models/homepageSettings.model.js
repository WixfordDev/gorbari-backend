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
    // Plain-text heading/subheading for the "Explore & Find Your Dream Home"
    // section, editable separately from the rich-text body below them so the
    // admin can't accidentally break their styling/size.
    dreamHomeHeading: {
      type: String,
      default: "Explore & Find Your Dream Home",
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
        "<blockquote>We believe there's a perfect home for everybody, no matter the budget.</blockquote>",
    },
  },
  {
    timestamps: true,
  }
);

homepageSettingsSchema.plugin(toJSON);

module.exports = mongoose.model("HomepageSettings", homepageSettingsSchema);
