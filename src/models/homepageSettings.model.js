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
    // Rich HTML for the "Explore & Find Your Dream Home" section's text
    // panel (heading, copy, feature list) - admin-authored, like AboutUs.
    dreamHomeContent: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

homepageSettingsSchema.plugin(toJSON);

module.exports = mongoose.model("HomepageSettings", homepageSettingsSchema);
