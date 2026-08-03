const mongoose = require("mongoose");
const { User } = require("../../models");
const { upsertByUnique } = require("./helpers");

// Stable, deterministic IDs so other seeders can reference these users
// (e.g. properties.createdBy => the agent).
const IDS = {
  admin: new mongoose.Types.ObjectId("64b000000000000000000001"),
  agent: new mongoose.Types.ObjectId("64b000000000000000000002"),
  user: new mongoose.Types.ObjectId("64b000000000000000000003"),
};

// Passwords are stored as plaintext here; the User pre("save") hook hashes
// them with bcrypt (rounds 8), matching production signup behaviour.
const usersData = [
  {
    _id: IDS.admin,
    fullName: "Testing Super Admin",
    email: "admin@gmail.com",
    phoneNumber: "01735566789",
    password: "1Qazxsw2$",
    role: "admin",
    isEmailVerified: true,
  },
  {
    _id: IDS.agent,
    fullName: "Testing Agent",
    email: "agent@gmail.com",
    phoneNumber: "01735566788",
    password: "1Qazxsw2$",
    role: "agent",
    isEmailVerified: true,
  },
  {
    _id: IDS.user,
    fullName: "Testing User",
    email: "user@gmail.com",
    phoneNumber: "01734456873",
    dataOfBirth: new Date("2000-06-22"),
    password: "1Qazxsw2$",
    role: "user",
    isEmailVerified: true,
  },
];

const seedUsers = async () => {
  const result = await upsertByUnique(User, "email", usersData);
  console.log(`Users seeded (${result.created} created, ${result.updated} updated)`);
  return IDS;
};

module.exports = { seedUsers, IDS };
