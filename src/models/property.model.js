const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");
const { DIVISION_NAMES } = require("../config/bangladeshGeo");

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
    // URL identifier derived from the title at creation time. Deliberately not
    // regenerated when the title changes: the slug is the public URL, so a
    // stable value keeps inbound links and accumulated search ranking intact.
    // Sparse so the unique index tolerates the pre-migration documents that
    // have no slug yet.
    slug: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
      default: null,
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
    // Bangladesh's administrative geography, replacing the free-text city/state
    // pair for local listings. Constrained to the known divisions so a filter
    // by division cannot be defeated by a typo or an alternate spelling.
    //
    // Not required: properties predating this field have neither value, and
    // making them required would fail every update to an older listing.
    division: {
      type: String,
      trim: true,
      enum: [...DIVISION_NAMES, null],
      default: null,
      index: true,
    },
    district: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    // Kept alongside division/district rather than dropped: existing documents
    // hold values here, the public listing pages still read them, and a
    // non-Bangladeshi address has nowhere else to go.
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
