const { AboutUs, PrivacyPolicy, TermsAndCondition } = require("../../models");

const aboutUsData = {
  content:
    "GhorBari is Bangladesh's trusted real estate platform, connecting buyers, renters, and agents. We make property discovery simple with verified listings, transparent pricing, and powerful tools for agents to grow their business. From family homes in Gulshan to commercial spaces in Motijheel, find the right property for every need.",
};

const privacyPolicyData = {
  content:
    "Your privacy matters to us. We collect only the information needed to provide our services: account details, property preferences, and transaction records. Your personal data is never sold to third parties. We use encryption and strict access controls to keep your information secure, and you may request deletion of your data at any time.",
};

const termsConditionsData = {
  content:
    "By using GhorBari you agree to provide accurate information, use listings responsibly, and respect other users. Agents are responsible for the accuracy of their listings and payments. We reserve the right to remove content that violates these terms. Subscriptions are billed per plan and are non-refundable once activated.",
};

const seedContentPages = async () => {
  await upsertSingle(AboutUs, aboutUsData, "AboutUs");
  await upsertSingle(PrivacyPolicy, privacyPolicyData, "PrivacyPolicy");
  await upsertSingle(TermsAndCondition, termsConditionsData, "TermsAndCondition");
  console.log("Content pages seeded (AboutUs, PrivacyPolicy, TermsAndCondition)");
};

const upsertSingle = async (Model, data, label) => {
  const existing = await Model.findOne();
  if (existing) {
    await existing.set(data).save();
  } else {
    await Model.create(data);
  }
};

module.exports = { seedContentPages };
