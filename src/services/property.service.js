const httpStatus = require("http-status");
const { Property, Favorite } = require("../models");
const ApiError = require("../utils/ApiError");
const { default: mongoose } = require("mongoose");
const { buildUniqueSlug } = require("../utils/slug");
const {
  findDivisionByDistrict,
  isValidDistrictForDivision,
  DIVISION_NAMES,
} = require("../config/bangladeshGeo");
const notificationService = require("./notification.service");
const logger = require("../config/logger");

/**
 * Reconcile the division/district pair before it reaches the database.
 *
 * A district belongs to exactly one division, so the district is treated as
 * authoritative and the division is derived from it. That lets a client send
 * only a district — which is what happens when the user picks the district
 * first, or when Google Places returns one — and still store a consistent pair.
 *
 * A mismatched pair is a contradiction rather than a preference, so it is
 * rejected instead of silently corrected: quietly rewriting the division would
 * publish the property somewhere the agent did not choose.
 */
const normalizeAdministrativeArea = (body) => {
  const district = body.district ? String(body.district).trim() : null;
  const division = body.division ? String(body.division).trim() : null;

  if (!district && !division) return;

  if (district) {
    const owningDivision = findDivisionByDistrict(district);
    if (!owningDivision) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Unknown district "${district}"`
      );
    }

    if (division && !isValidDistrictForDivision(district, division)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `District "${district}" belongs to ${owningDivision} division, not ${division}`
      );
    }

    // Canonical casing, so a value typed as "dhaka" is stored as "Dhaka" and
    // an exact-match filter on division keeps working.
    body.district = findCanonicalDistrict(district);
    body.division = owningDivision;
    return;
  }

  if (!DIVISION_NAMES.some((name) => name.toLowerCase() === division.toLowerCase())) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Unknown division "${division}"`);
  }
  body.division = DIVISION_NAMES.find(
    (name) => name.toLowerCase() === division.toLowerCase()
  );
};

const findCanonicalDistrict = (district) => {
  const owningDivision = findDivisionByDistrict(district);
  if (!owningDivision) return district;
  const { getDistrictsByDivision } = require("../config/bangladeshGeo");
  return (
    getDistrictsByDivision(owningDivision).find(
      (name) => name.toLowerCase() === district.trim().toLowerCase()
    ) || district
  );
};

// Number of times a create is retried when the unique slug index rejects the
// insert. A retry only happens when a concurrent request claimed the same slug
// between our uniqueness check and the insert, so the window is tiny and a
// couple of attempts is ample.
const SLUG_RETRY_LIMIT = 3;

const slugExists = async (slug) => Boolean(await Property.exists({ slug }));

/**
 * Fields an agent may legitimately leave blank.
 *
 * A property with no stated price or room count is a real listing — land has no
 * bedrooms, and a price is often "on request" — so these are stored as null
 * rather than 0. Zero is kept meaningful: a studio genuinely has 0 bedrooms,
 * and the listing pages show a stated 0 while hiding an unstated one.
 */
const OPTIONAL_NUMERIC_FIELDS = ["price", "areaSqFt", "lotSize", "bedrooms", "bathrooms"];

/**
 * Turn a cleared form field back into null.
 *
 * Requests arrive as multipart/form-data, which has no concept of a type: every
 * value is a string, and a field the user emptied comes through as "". Passing
 * that to a Number path throws a CastError, so the whole update would fail
 * because someone deleted a price.
 */
const normalizeOptionalNumbers = (body) => {
  OPTIONAL_NUMERIC_FIELDS.forEach((field) => {
    if (!(field in body)) return;
    const value = body[field];
    if (value === "" || value === null || value === undefined) {
      body[field] = null;
      return;
    }
    if (typeof value === "string" && value.trim() === "") {
      body[field] = null;
    }
  });
};

/**
 * There is no "favourite location" concept of its own - users only favourite
 * individual properties. This derives interest in an area from that: anyone
 * who has favourited a property in the same district as this new one is
 * assumed to care about that district, and gets notified.
 */
const notifyFavouriteAreaUsers = async (property) => {
  if (!property.district) return;

  const propertiesInDistrict = await Property.find({
    district: property.district,
    isDeleted: false,
    _id: { $ne: property._id },
  }).select("_id");

  if (propertiesInDistrict.length === 0) return;

  const favourites = await Favorite.find({
    property: { $in: propertiesInDistrict.map((p) => p._id) },
    isDeleted: false,
  }).select("user");

  const interestedUserIds = new Set(
    favourites
      .map((f) => String(f.user))
      // Don't notify the lister about their own new listing.
      .filter((id) => id !== String(property.createdBy))
  );

  await Promise.all(
    [...interestedUserIds].map((userId) =>
      notificationService
        .createNotification({
          userId,
          sendBy: property.createdBy,
          title: "New property in your favourite area",
          content: `A new listing "${property.title}" was just added in ${property.district}.`,
          type: "new-property",
          priority: "low",
        })
        .catch((err) =>
          logger.error(
            "Failed to notify favourite-area user %s for property %s: %s",
            userId,
            property._id,
            err.message || err
          )
        )
    )
  );
};

const createProperty = async (propertyBody) => {
  normalizeAdministrativeArea(propertyBody);
  normalizeOptionalNumbers(propertyBody);

  // Calculate 10% commission from price
  if (propertyBody.price) {
    const commissionPercentage = 10;
    const commissionAmount = propertyBody.price * (commissionPercentage / 100);

    propertyBody.commission = {
      percentage: commissionPercentage,
      amount: commissionAmount,
      status: "pending",
    };
  }

  // The slug is server-derived from the title, so ignore any client-supplied
  // value rather than letting a request pick its own URL.
  const { slug: _ignoredSlug, ...body } = propertyBody;

  // buildUniqueSlug only rules out slugs that exist when it runs. Two
  // simultaneous creates with the same title can therefore both settle on the
  // same candidate, and the unique index rejects the loser — retry with a fresh
  // suffix instead of surfacing a duplicate-key error.
  let property;
  for (let attempt = 1; ; attempt += 1) {
    try {
      const slug = await buildUniqueSlug(body.title, slugExists);
      property = await Property.create({ ...body, slug });
      break;
    } catch (err) {
      const isDuplicateSlug = err.code === 11000 && err.keyPattern && err.keyPattern.slug;
      if (!isDuplicateSlug || attempt >= SLUG_RETRY_LIMIT) {
        throw err;
      }
    }
  }

  // The listing is already saved, so this must not slow down or fail the
  // create response - it can involve notifying an arbitrary number of users.
  notifyFavouriteAreaUsers(property).catch((err) =>
    logger.error("Favourite-area notification pass failed for property %s: %s", property._id, err.message || err)
  );

  return property;
};

const queryProperties = async (filter, options) => {
  const matchStage = { isDeleted: false };

  // ✅ Handle isBosted filter safely
  if (filter.isBosted !== undefined) {
    matchStage.isBosted =
      filter.isBosted === "true" || filter.isBosted === true;
  }

  // 🔍 Dynamic filters
  Object.keys(filter).forEach((key) => {
    const value = filter[key];
    if (!value || value === "") return;

    // ❌ already handled
    if (key === "isBosted") return;

    if (
      [
        "title",
        "type",
        "address",
        "city",
        "state",
        "country",
        "zipCode",
        "status",
        "catagory",
      ].includes(key)
    ) {
      if (Array.isArray(value)) {
        matchStage[key] = {
          $in: value.map((v) => new RegExp(v, "i")),
        };
      } else if (typeof value === "string" && value.includes(",")) {
        const values = value
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);

        matchStage[key] = {
          $in: values.map((v) => new RegExp(v, "i")),
        };
      } else {
        matchStage[key] = { $regex: value, $options: "i" };
      }
    } else if (
      typeof value === "object" &&
      (value.min !== undefined || value.max !== undefined)
    ) {
      matchStage[key] = {};
      if (value.min !== undefined) matchStage[key].$gte = Number(value.min);
      if (value.max !== undefined) matchStage[key].$lte = Number(value.max);
    } else if (Array.isArray(value)) {
      matchStage[key] = {
        $in: value.map((v) => (isNaN(v) ? v : Number(v))),
      };
    } else if (typeof value === "string" && value.includes(",")) {
      const values = value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

      matchStage[key] = {
        $in: values.map((v) => (isNaN(v) ? v : Number(v))),
      };
    } else {
      matchStage[key] = isNaN(value) ? value : Number(value);
    }
  });

  const pipeline = [{ $match: matchStage }];

  // ✅ Populate createdBy (Aggregation way)
  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "createdBy",
        foreignField: "_id",
        as: "createdBy",
      },
    },
    {
      $unwind: {
        path: "$createdBy",
        preserveNullAndEmptyArrays: true,
      },
    }
  );

  // ✅ Project only safe fields
  pipeline.push({
    $project: {
      title: 1,
      slug: 1,
      description: 1,
      type: 1,
      price: 1,
      address: 1,
      city: 1,
      state: 1,
      country: 1,
      zipCode: 1,
      status: 1,
      catagory: 1,
      isBosted: 1,
      createdAt: 1,
      // Exposed so the website's sitemap can advertise a truthful <lastmod>.
      // Without it every entry would claim "just modified" and search engines
      // learn to ignore the field.
      updatedAt: 1,
      location: 1,
      images: 1,
      mapLink: 1,
      areaSqFt: 1,
      lotSize: 1,
      lotSizeUnit: 1,
      bedrooms: 1,
      bathrooms: 1,
      parkingSpaces: 1,
      amenities: 1,
      videos: 1,
      features: 1,
      favorites: 1,
      inquiries: 1,
      isFeatures: 1,
      isBosted: 1,
      bostedRank: 1,
      commission: 1,
      // costeExpiry: 1,

      createdBy: {
        _id: "$createdBy._id",
        fullName: "$createdBy.fullName",
        profileImage: "$createdBy.profileImage",
        // Lets a listing card label the lister correctly rather than assuming
        // every property was posted by an agent.
        role: "$createdBy.role",
        subscription: "$createdBy.subscription"
      },
    },
  });

  // 🔃 Sorting
  if (options.sortBy) {
    const sortStage = {};
    options.sortBy.split(",").forEach((field) => {
      sortStage[field.startsWith("-") ? field.slice(1) : field] =
        field.startsWith("-") ? -1 : 1;
    });
    pipeline.push({ $sort: sortStage });
  } else {
    pipeline.push({ $sort: { createdAt: -1 } });
  }

  // 📄 Pagination
  const page = parseInt(options.page, 10) || 1;
  const limit = parseInt(options.limit, 10) || 10;
  const skip = (page - 1) * limit;

  pipeline.push({
    $facet: {
      results: [{ $skip: skip }, { $limit: limit }],
      totalCount: [{ $count: "count" }],
    },
  });

  const [result] = await Property.aggregate(pipeline);

  const totalResults = result?.totalCount?.[0]?.count || 0;
  const totalPages = Math.ceil(totalResults / limit);

  return {
    results: result.results,
    page,
    limit,
    totalPages,
    totalResults,
  };
};


const queryPropertiesForAgent = async (filter, options, userId) => {
  const matchStage = {
    createdBy: new mongoose.Types.ObjectId(userId),
    isDeleted: false,
  };

  // Handle isBosted filter
  if (filter.isBosted !== undefined) {
    matchStage.isBosted =
      filter.isBosted === "true" || filter.isBosted === true;
  }

  Object.keys(filter).forEach((key) => {
    const value = filter[key];
    if (!value || value === "") return;

    // Skip isBosted only
    if (key === "isBosted") return;

    if (
      [
        "title",
        "type",
        "address",
        "city",
        "state",
        "country",
        "zipCode",
        "status",
        "catagory",
      ].includes(key)
    ) {
      if (Array.isArray(value)) {
        matchStage[key] = {
          $in: value.map((v) => new RegExp(v, "i")),
        };
      } else if (typeof value === "string" && value.includes(",")) {
        const values = value
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);

        matchStage[key] = {
          $in: values.map((v) => new RegExp(v, "i")),
        };
      } else {
        matchStage[key] = { $regex: value, $options: "i" };
      }
    } else if (
      typeof value === "object" &&
      (value.min !== undefined || value.max !== undefined)
    ) {
      matchStage[key] = {};
      if (value.min !== undefined) matchStage[key].$gte = Number(value.min);
      if (value.max !== undefined) matchStage[key].$lte = Number(value.max);
    } else if (Array.isArray(value)) {
      matchStage[key] = {
        $in: value.map((v) => (isNaN(v) ? v : Number(v))),
      };
    } else if (typeof value === "string" && value.includes(",")) {
      const values = value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

      matchStage[key] = {
        $in: values.map((v) => (isNaN(v) ? v : Number(v))),
      };
    } else {
      matchStage[key] = isNaN(value) ? value : Number(value);
    }
  });

  const pipeline = [{ $match: matchStage }];

  // SORTING LOGIC (default / sortBy only)
  if (options.sortBy) {
    const sortFields = options.sortBy.split(",");
    const sortStage = {};

    sortFields.forEach((field) => {
      if (field.startsWith("-")) {
        sortStage[field.substring(1)] = -1;
      } else {
        sortStage[field] = 1;
      }
    });

    pipeline.push({ $sort: sortStage });
  } else {
    pipeline.push({ $sort: { createdAt: -1 } });
  }

  const page = parseInt(options.page, 10) || 1;
  const limit = parseInt(options.limit, 10) || 10;
  const skip = (page - 1) * limit;

  pipeline.push({
    $facet: {
      results: [{ $skip: skip }, { $limit: limit }],
      totalCount: [{ $count: "count" }],
    },
  });

  const [result] = await Property.aggregate(pipeline);

  const totalResults = result?.totalCount?.[0]?.count || 0;
  const totalPages = Math.ceil(totalResults / limit);

  return {
    results: result.results,
    page,
    limit,
    totalPages,
    totalResults,
  };
};

// Fields exposed for the agent who listed a property. The detail page is
// public, so contact details are deliberately excluded — an enquiry goes
// through POST /contact/for-property rather than handing out an address for
// scrapers to harvest. role is included so the page can label the person
// correctly instead of assuming "Agent", and the name fields are all included
// because fullName is nullable on older accounts.
const AGENT_PUBLIC_FIELDS = "fullName firstName lastName profileImage role";

/**
 * Look up a property by either its slug or its Mongo id.
 *
 * Slug URLs are canonical, but ids stay resolvable so links shared before the
 * slug migration keep working. A 24-character hex string is treated as an id;
 * anything else can only be a slug. Slugs are matched first because that is the
 * common case, and a real slug can never look like an ObjectId.
 */
const getPropertyByIdOrSlug = async (idOrSlug) => {
  const or = [{ slug: idOrSlug }];
  if (mongoose.Types.ObjectId.isValid(idOrSlug) && /^[a-f\d]{24}$/i.test(idOrSlug)) {
    or.push({ _id: idOrSlug });
  }

  return Property.findOne({ $or: or, isDeleted: false }).populate(
    "createdBy",
    AGENT_PUBLIC_FIELDS
  );
};

const getPropertyById = async (id) => {
  return Property.findOne({ _id: id, isDeleted: false }).populate(
    "createdBy",
    AGENT_PUBLIC_FIELDS
  );
};

const updatePropertyById = async (propertyId, updateBody) => {
  const property = await getPropertyById(propertyId);
  if (!property) {
    throw new ApiError(httpStatus.NOT_FOUND, "Property not found");
  }

  normalizeAdministrativeArea(updateBody);
  normalizeOptionalNumbers(updateBody);

  // The slug is the property's public URL and is frozen after creation, so it is
  // dropped here even when the title changes. Changing it would break every
  // link already pointing at this property.
  const { slug: _ignoredSlug, ...safeUpdate } = updateBody;

  Object.assign(property, safeUpdate);
  await property.save();
  return property;
};

const uploadPropertyImage = async (propertyId, imagePath) => {
  const property = await Property.findById(propertyId);
  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  property.images.push(imagePath);
  await property.save();
  return property;
};

const deletePropertyImage = async (propertyId, imagePath) => {
  const property = await Property.findById(propertyId);
  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  property.images = property.images.filter((img) => img !== imagePath);
  await property.save();
  return property;
};

const deletePropertyById = async (propertyId) => {
  const property = await getPropertyById(propertyId);
  if (!property) {
    throw new ApiError(httpStatus.NOT_FOUND, "Property not found");
  }

  property.isDeleted = true;
  await property.save();
  return property;
};

const bostProperty = async (propertyId, bostData) => {
  const property = await getPropertyById(propertyId);
  if (!property) {
    throw new ApiError(httpStatus.NOT_FOUND, "Property not found");
  }

  property.isBosted = bostData.isBosted;
  property.bostedRank = bostData.bostedRank;
  property.bosteExpiry = bostData.bosteExpiry;

  await property.save();
  return property;
};

module.exports = {
  createProperty,
  queryProperties,
  getPropertyById,
  getPropertyByIdOrSlug,
  updatePropertyById,
  uploadPropertyImage,
  deletePropertyImage,
  deletePropertyById,
  queryPropertiesForAgent,

  bostProperty,
};
