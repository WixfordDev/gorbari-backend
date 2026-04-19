const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

const propertySchema = mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    catagory: {
      type: String,
      enum: ["House", "Apartment", "Condo", "Land", "Commercial", "Other"],
      default: "Other",
    },
    type: {
      type: String,
      enum: ["Buy", "Rent", "Lease", "Auction"],
      required: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
      default: null,
    },
    state: {
      type: String,
      trim: true,
      default: null,
    },
    zipCode: {
      type: String,
      trim: true,
      default: null,
    },
    country: {
      type: String,
      trim: true,
      default: null,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        index: "2dsphere",
      },
    },
    mapLink: {
      type: String,
      trim: true,
      default: null,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    areaSqFt: {
      type: Number,
      required: true,
      min: 0,
    },
    lotSize: {
      type: Number,
      min: 0,
      default: null,
    }, // For land/house
    yearBuilt: {
      type: Number,
      default: null,
    },
    bedrooms: {
      type: Number,
      min: 0,
      default: null,
    },
    bathrooms: {
      type: Number,
      min: 0,
      default: null,
    },
    kitchen: {
      type: Number,
      min: 0,
      default: null,
    },
    garage: {
      type: Number,
      min: 0,
      default: null,
    },

    images: {
      type: [String],
      required: true,
      validate: [(arr) => arr.length > 0, "At least one image is required"],
    },
    status: {
      type: String,
      enum: ["Available", "Sold", "Pending", "Rented", "Off-Market"],
      default: "Available",
    },
    features: {
      type: [String],
      default: [],
    },
    amenities: {
      type: [String],
      default: [],
    }, // Pool, Gym, Security
    other: {
      type: Map,
      of: String,
      default: {},
    },
    views: {
      type: Number,
      default: 0,
    },
    favorites: {
      type: Number,
      default: 0,
    },
    inquiries: {
      type: Number,
      default: 0,
    },
    isFeatures: {
      type: Boolean,
      default: false,
    },
    isBosted: {
      type: Boolean,
      default: false,
    },
    bostedRank: {
      type: Number,
      default: 1,
    },
    bosteExpiry: {
      type: Date,
      default: null,
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    commission: {
      percentage: {
        type: Number,
        default: 10,
        min: 0,
        max: 100,
      },
      amount: {
        type: Number,
        default: 0,
        min: 0,
      },
      status: {
        type: String,
        enum: ["pending", "paid", "waived"],
        default: "pending",
      },
      paidAt: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

propertySchema.virtual("pricePerSqFt").get(function () {
  if (this.price && this.areaSqFt) {
    return (this.price / this.areaSqFt).toFixed(2);
  }
  return null;
});

propertySchema.plugin(toJSON);
propertySchema.plugin(paginate);

const Property = mongoose.model("Property", propertySchema);

module.exports = Property;
