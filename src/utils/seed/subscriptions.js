const { Subscription } = require("../../models");
const { upsertByUnique } = require("./helpers");
const { IDS } = require("./users");

const subscriptionsData = [
  {
    createdBy: IDS.admin,
    title: "Basic",
    subTitle: "For getting started",
    description: "List a single property and explore the platform.",
    features: ["1 Property Listing", "1 Photo per Property", "Email Support"],
    type: "monthly",
    amount: 600,
    days: 30,
    propertyPromotionCradit: 0,
    propertyImageCradit: 1,
    propertyVideoCradit: 0,
    isViewsContact: false,
    bostProperty: 0,
    bostCraditn: 0,
    isEmailSupport: true,
  },
  {
    createdBy: IDS.admin,
    title: "Standard",
    subTitle: "For growing agents",
    description: "List more properties and boost visibility to reach more buyers.",
    features: [
      "10 Property Listings",
      "10 Photos per Property",
      "1 Video Upload",
      "2 Boost Credits",
      "View Contact Requests",
    ],
    type: "monthly",
    amount: 1200,
    days: 30,
    propertyPromotionCradit: 2,
    propertyImageCradit: 10,
    propertyVideoCradit: 1,
    isViewsContact: true,
    bostProperty: 2,
    bostCraditn: 2,
    isEmailSupport: true,
  },
  {
    createdBy: IDS.admin,
    title: "Premium",
    subTitle: "For serious sellers",
    description: "Unlimited listings with maximum visibility and priority support.",
    features: [
      "Unlimited Property Listings",
      "20 Photos per Property",
      "5 Video Uploads",
      "10 Boost Credits",
      "View Contact Requests",
      "Featured Placement",
    ],
    type: "monthly",
    amount: 3000,
    days: 30,
    propertyPromotionCradit: 5,
    propertyImageCradit: 20,
    propertyVideoCradit: 5,
    isViewsContact: true,
    bostProperty: 10,
    bostCraditn: 10,
    isEmailSupport: true,
  },
];

const seedSubscriptions = async () => {
  const result = await upsertByUnique(Subscription, "title", subscriptionsData);
  console.log(`Subscriptions seeded (${result.created} created, ${result.updated} updated)`);
};

module.exports = { seedSubscriptions };
