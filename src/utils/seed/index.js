const mongoose = require("mongoose");
const config = require("../../config/config");
const { connect, disconnect } = require("./helpers");
const { seedUsers } = require("./users");
const { seedProperties } = require("./properties");
const { seedSubscriptions } = require("./subscriptions");
const { seedPaymentGateways } = require("./paymentGateways");
const { seedContentPages } = require("./contentPages");

// CLI flags:
//   --reset, -r  Drop the seeded collections before re-seeding (NEVER the whole DB)
//   --force, -f  Allow seeding in production (DANGEROUS, opt-in only)
const args = process.argv.slice(2);
const isReset = args.includes("--reset") || args.includes("-r");
const isForce = args.includes("--force") || args.includes("-f");

const SEEDED_COLLECTIONS = [
  "users",
  "properties",
  "subscriptions",
  "paymentgateways",
  "aboutuses",
  "privacies",
  "termsconditions",
];

const dropCollection = async (name) => {
  const collections = await mongoose.connection.db.listCollections({ name }).toArray();
  if (collections.length === 0) return;
  await mongoose.connection.db.dropCollection(name);
  console.log(`Dropped collection: ${name}`);
};

const run = async () => {
  if (isReset) {
    console.log("--reset passed: dropping seeded collections only...");
    for (const name of SEEDED_COLLECTIONS) {
      await dropCollection(name);
    }
  }

  await seedUsers();
  await seedSubscriptions();
  await seedPaymentGateways();
  await seedProperties();
  await seedContentPages();

  console.log("Database seeding completed!");
};

const main = async () => {
  if (config.env === "production" && !isForce) {
    console.error(
      "Seeding is blocked in production. If you really intend to seed the production database, re-run with --force."
    );
    process.exit(1);
  }

  try {
    await connect();
    await run();
    await disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err.message || err);
    try {
      await disconnect();
    } catch (e) {
      // ignore disconnect errors on failure path
    }
    process.exit(1);
  }
};

main();
