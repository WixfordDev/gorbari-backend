const httpStatus = require("http-status");
const { Property } = require("../models");
const ApiError = require("../utils/ApiError");
const { default: mongoose } = require("mongoose");
const { buildUniqueSlug } = require("../utils/slug");

// Number of times a create is retried when the unique slug index rejects the
// insert. A retry only happens when a concurrent request claimed the same slug
// between our uniqueness check and the insert, so the window is tiny and a
// couple of attempts is ample.
const SLUG_RETRY_LIMIT = 3;

const slugExists = async (slug) => Boolean(await Property.exists({ slug }));

const createProperty = async (propertyBody) => {
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
  for (let attempt = 1; ; attempt += 1) {
    try {
      const slug = await buildUniqueSlug(body.title, slugExists);
      return await Property.create({ ...body, slug });
    } catch (err) {
      const isDuplicateSlug = err.code === 11000 && err.keyPattern && err.keyPattern.slug;
      if (!isDuplicateSlug || attempt >= SLUG_RETRY_LIMIT) {
        throw err;
      }
    }
  }
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
