/**
 * Backfill `slug` on properties created before the field existed.
 *
 * Idempotent: documents that already have a slug are skipped, so the script is
 * safe to re-run. Soft-deleted properties are included — they can be restored,
 * and leaving them without a slug would mean an unreachable URL if that happens.
 *
 *   node src/utils/seed/backfillPropertySlugs.js
 */
const mongoose = require("mongoose");
const config = require("../../config/config");
const { Property } = require("../../models");
const { buildUniqueSlug } = require("../slug");

const backfillPropertySlugs = async () => {
  const properties = await Property.find({
    $or: [{ slug: null }, { slug: { $exists: false } }],
  })
    .select("_id title slug")
    .sort({ createdAt: 1 });

  if (!properties.length) {
    console.log("No properties need a slug. Nothing to do.");
    return { updated: 0 };
  }

  console.log(`Found ${properties.length} propert${properties.length === 1 ? "y" : "ies"} without a slug.`);

  // Slugs assigned during this run are not yet visible to a fresh exists()
  // query on documents we have not saved, so track them here as well.
  const claimed = new Set();
  const slugExists = async (slug) =>
    claimed.has(slug) || Boolean(await Property.exists({ slug }));

  let updated = 0;
  for (const property of properties) {
    const slug = await buildUniqueSlug(property.title, slugExists);
    claimed.add(slug);

    // updateOne rather than save() to avoid running validators against legacy
    // documents that may predate later required fields.
    await Property.updateOne({ _id: property._id }, { $set: { slug } });
    console.log(`  ${property._id}  ${JSON.stringify(property.title)} -> ${slug}`);
    updated += 1;
  }

  return { updated };
};

const run = async () => {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  console.log("Connected to MongoDB");
  try {
    const { updated } = await backfillPropertySlugs();
    console.log(`Done. ${updated} propert${updated === 1 ? "y" : "ies"} updated.`);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

if (require.main === module) {
  run().catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
}

module.exports = { backfillPropertySlugs };
