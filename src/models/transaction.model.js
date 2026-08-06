const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, "Amount must be a positive value."],
    },
    transactionId: {
      type: String,
      required: false
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      required: false,
    },
    subscriptionLimitation: {
      type: Number,
      default: 0,
    },
    // The validity window is stored per transaction rather than read from
    // user.subscription, which only ever holds the most recent purchase and so
    // cannot describe the period an older transaction paid for.
    subscriptionStartDate: {
      type: Date,
      default: null,
    },
    subscriptionExpirationDate: {
      type: Date,
      default: null,
    },
    type: {
      type: String,
      enum: [
        "bkash",
        "nagad",
        "rocket",
        "surecash",
        "stripe",
        "paypal",
        "wise",
        "card",
      ],
      required: true,
      trim: true,
      lowercase: true,
    },
    screenshot: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "canceled"],
      default: "pending", 
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Apply the plugins to the Transaction schema
transactionSchema.plugin(toJSON);
transactionSchema.plugin(paginate);

module.exports = mongoose.model("Transaction", transactionSchema);
