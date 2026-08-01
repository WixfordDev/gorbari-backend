const mongoose = require("mongoose");
const config = require("../../config/config");

const connect = async () => {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  console.log("Connected to MongoDB");
};

const disconnect = async () => {
  await mongoose.disconnect();
  console.log("Disconnected from MongoDB");
};

// Idempotent upsert keyed on a unique field (e.g. email, name, title).
// Uses create()/save() so the model's pre("save") hooks always run (bcrypt
// hashing, security answer hashing), matching production behaviour.
const upsertByUnique = async (Model, uniqueField, docs) => {
  const result = { created: 0, updated: 0 };
  for (const doc of docs) {
    const existing = await Model.findOne({ [uniqueField]: doc[uniqueField] });
    if (existing) {
      const { _id, ...rest } = doc;
      existing.set(rest);
      await existing.save();
      result.updated += 1;
    } else {
      await Model.create(doc);
      result.created += 1;
    }
  }
  return result;
};

module.exports = { connect, disconnect, upsertByUnique };
