/**
 * Backfill the validity window on transactions created before the fields
 * existed.
 *
 * `takeSubscriptions` always computed an expiry date, but the Transaction
 * schema had no field to hold it, so Mongoose silently discarded it on write.
 * Those rows would render an empty Validity column on the agent's history page.
 *
 * The window is reconstructed from what survived: `createdAt` is the moment the
 * purchase was submitted, and `subscriptionLimitation` is the plan's length in
 * days. Where that field is absent the plan is consulted instead. A transaction
 * whose plan has since been deleted is left alone rather than guessed at.
 *
 * Idempotent: rows that already carry both dates are skipped.
 *
 *   node src/utils/seed/backfillTransactionDates.js
 */
const mongoose = require("mongoose");
const config = require("../../config/config");
const { Transaction, Subscription } = require("../../models");

const backfillTransactionDates = async () => {
  const transactions = await Transaction.find({
    $or: [
      { subscriptionStartDate: null },
      { subscriptionStartDate: { $exists: false } },
      { subscriptionExpirationDate: null },
      { subscriptionExpirationDate: { $exists: false } },
    ],
  })
    .select("_id createdAt subscriptionLimitation subscriptionId")
    .sort({ createdAt: 1 });

  if (!transactions.length) {
    console.log("No transactions need dates. Nothing to do.");
    return { updated: 0, skipped: 0 };
  }

  console.log(`Found ${transactions.length} transaction(s) without a validity window.`);

  let updated = 0;
  let skipped = 0;

  for (const transaction of transactions) {
    let days = transaction.subscriptionLimitation;

    // Older rows may predate subscriptionLimitation being populated.
    if (!days && transaction.subscriptionId) {
      const plan = await Subscription.findById(transaction.subscriptionId).select("days");
      days = plan?.days;
    }

    if (!days) {
      console.log(`  ${transaction._id}  skipped - plan length unknown`);
      skipped += 1;
      continue;
    }

    const startDate = transaction.createdAt;
    const expirationDate = new Date(startDate);
    expirationDate.setDate(expirationDate.getDate() + days);

    // updateOne rather than save() to avoid running validators against legacy
    // documents that may predate later required fields.
    await Transaction.updateOne(
      { _id: transaction._id },
      { $set: { subscriptionStartDate: startDate, subscriptionExpirationDate: expirationDate } }
    );

    console.log(
      `  ${transaction._id}  ${startDate.toISOString().slice(0, 10)} -> ${expirationDate
        .toISOString()
        .slice(0, 10)}  (${days} days)`
    );
    updated += 1;
  }

  return { updated, skipped };
};

const run = async () => {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  console.log("Connected to MongoDB");
  try {
    const { updated, skipped } = await backfillTransactionDates();
    console.log(`Done. ${updated} updated, ${skipped} skipped.`);
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

module.exports = { backfillTransactionDates };
