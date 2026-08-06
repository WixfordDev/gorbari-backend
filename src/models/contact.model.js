const mongoose = require("mongoose");
const validator = require("validator");
const { toJSON, paginate } = require("./plugins");

const contactSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.type === "property";
      },
    },
    property: {
      type: mongoose.Types.ObjectId,
      ref: "Property",
      required: function () {
        return this.type === "property";
      },
    },
    propertyWoner: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.type === "property";
      },
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
    },
    fullName: {
      type: String,
      trim: true,
      required: function () {
        return this.type === "general";
      },
    },
    email: {
      type: String,
      lowercase: true,
      required: function () {
        return this.type === "general";
      },
      validate(value) {
        if (value && !validator.isEmail(value)) {
          throw new Error("Invalid email");
        }
      },
    },
    phoneNumber: {
      type: String,
    },
    address: {
      type: String,
    },
    message: {
      type: String,
      trim: true,
      // Required for every enquiry: a lead with no message is not actionable,
      // and previously a property enquiry could be saved completely empty.
      required: true,
    },
    // What the sender is asking for. Kept separate from `type` (which
    // distinguishes a site-wide contact form from a property enquiry) so an
    // agent can tell a purchase request apart from a general question, and so a
    // future payment flow has an existing record to attach to.
    intent: {
      type: String,
      enum: ["general", "buy", "rent", "lease", "auction", "visit"],
      default: "general",
    },
    type: {
      type: String,
      enum: ["general", "property"],
      required: true,
      default: "general",
    },
    // Follow-up state for an agent's workflow. Defaults to new so existing
    // records read as untouched, "seen" when the agent opens the enquiry, and
    // "replied" when they confirm they have responded. Doubles as "whose turn
    // it is" once replies start flowing both ways: a reply from the property
    // owner sets it back to "replied", a follow-up from the sender sets it
    // back to "new" so the owner sees it needs attention again.
    status: {
      type: String,
      enum: ["new", "seen", "replied"],
      default: "new",
    },
    // The message thread for this enquiry, oldest first. The original
    // `message` field is the sender's opening message and is left alone;
    // everything after that - either side - lives here.
    replies: [
      {
        sender: {
          type: mongoose.Types.ObjectId,
          ref: "User",
          required: true,
        },
        message: {
          type: String,
          trim: true,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

contactSchema.plugin(toJSON);
contactSchema.plugin(paginate);

const Contact = mongoose.model("Contact", contactSchema);

module.exports = Contact;
