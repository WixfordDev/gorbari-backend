const httpStatus = require("http-status");
const { Favorite, Property, Transaction, User, AboutUs, TermsAndCondition, PrivacyPolicy, HomepageSettings } = require("../models");
const ApiError = require("../utils/ApiError");
const propertyService = require("./property.service");
const he = require("he");

const createFavorite = async (favoriteBody) => {
  if (favoriteBody.property) {
    const isAlreadyFavorite = await Favorite.findOne({
      property: favoriteBody.property,
      user: favoriteBody.user,
      isDeleted: false,
    });
    if (isAlreadyFavorite) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Property is already in favorites"
      );
    }
  }

  const property = await propertyService.getPropertyById(favoriteBody.property);
  if (!property || property.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, "Property not found");
  }

  property.favorites += 1;
  await property.save();

  return Favorite.create(favoriteBody);
};

const queryFavorites = async (filter, options, userId) => {
  const { sortBy, limit, page } = options;

  let sort = {};
  if (sortBy) {
    const parts = sortBy.split(":");
    sort[parts[0]] = parts[1] === "desc" ? -1 : 1;
  } else {
    sort = { createdAt: -1 }; // default sort
  }

  const pageNum = page && parseInt(page, 10) > 0 ? parseInt(page, 10) : 1;
  const limitNum = limit && parseInt(limit, 10) > 0 ? parseInt(limit, 10) : 10;
  const skip = (pageNum - 1) * limitNum;

  const favorites = await Favorite.find({
    ...filter,
    user: userId,
    isDeleted: false,
  })
    .sort(sort)
    .skip(skip)
    .limit(limitNum)
    .populate("user", "fullName email profileImage")
    .populate("property", "title slug type price location images status");

  const totalResults = await Favorite.countDocuments({
    ...filter,
    user: userId,
    isDeleted: false,
  });

  return {
    results: favorites,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(totalResults / limitNum),
    totalResults,
  };
};

const getFavoriteById = async (id) => {
  return Favorite.findOne({ _id: id, isDeleted: false })
    .populate("user", "fullName email profileImage")
    .populate("property");
};

const getFavoriteByProperty = async (id) => {
  return Favorite.findOne({ property: id, isDeleted: false })
    .populate("user", "fullName email profileImage")
    .populate("property");
};

const updateFavoriteById = async (favoriteId, updateBody) => {
  const favorite = await getFavoriteById(favoriteId);
  if (!favorite) {
    throw new ApiError(httpStatus.NOT_FOUND, "Favorite not found");
  }

  Object.assign(favorite, updateBody);
  await favorite.save();
  return favorite;
};

const deleteFavoriteByProperty = async (propertyId) => {
  const favorite = await getFavoriteByProperty(propertyId);
  if (!favorite) {
    throw new ApiError(httpStatus.NOT_FOUND, "Favorite not found");
  }

  favorite.isDeleted = true;
  await favorite.save();

  const property = await propertyService.getPropertyById(propertyId);
  if (property && property.favorites > 0) {
    property.favorites -= 1;
    await property.save();
  }

  return favorite;
};

const deleteFavoriteById = async (favoriteId) => {
  const favorite = await getFavoriteById(favoriteId);
  if (!favorite) {
    throw new ApiError(httpStatus.NOT_FOUND, "Favorite not found");
  }

  favorite.isDeleted = true;
  await favorite.save();
  return favorite;
};

const getAllStatus = async (year, user) => {
  const propertyQuery = { isDeleted: false };
  const transactionQuery = { isDeleted: false, status: "completed" };

  // Agent: only own data
  if (user.role === "agent") {
    propertyQuery.createdBy = user._id;
  }

  // ---- PROPERTY STATS ----
  const totalProperty = await Property.countDocuments(propertyQuery);

  const viewsResult = await Property.aggregate([
    { $match: propertyQuery },
    {
      $group: {
        _id: null,
        totalViews: { $sum: "$views" },
      },
    },
  ]);

  const totalViews = viewsResult[0]?.totalViews || 0;

  // ---- ADMIN ONLY ----
  if (user.role === "admin") {
    const revenueResult = await Transaction.aggregate([
      { $match: transactionQuery },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
        },
      },
    ]);

    const totalRevenue = revenueResult[0]?.totalRevenue || 0;

    const totalUsers = await User.countDocuments({
      isDeleted: false,
      role: "user",
    });

    const totalAgents = await User.countDocuments({
      isDeleted: false,
      role: "agent",
    });

    // ✅ NEW COUNTS
    const unVerifiedUser = await User.countDocuments({
      isDeleted: false,
      isEmailVerified: false,
    });

    const verifiedUser = await User.countDocuments({
      isDeleted: false,
      isEmailVerified: true,
    });

    const subscripedAgents = await User.countDocuments({
      isDeleted: false,
      role: "agent",
      "subscription.isSubscriptionTaken": true,
    });

    // ✅ ADMIN RESPONSE
    return {
      totalProperty,
      totalViews,
      totalRevenue,
      totalUsers,
      totalAgents,
      unVerifiedUser,
      verifiedUser,
      subscripedAgents,
    };
  }

  // ✅ AGENT / USER RESPONSE
  return {
    totalProperty,
    totalViews,
  };
};

const createPrivacy = async (privacyBody) => {
  if (privacyBody.content) {
    privacyBody.content = he.decode(privacyBody.content);
  }

  const existingPrivacy = await PrivacyPolicy.findOne();
  if (existingPrivacy) {
    existingPrivacy.set(privacyBody);
    await existingPrivacy.save();
    return existingPrivacy;
  } else {
    const newPrivacy = await PrivacyPolicy.create(privacyBody);
    return newPrivacy;
  }
};

const queryPrivacy = async () => {
  const privacy = await PrivacyPolicy.find();
  return privacy;
};

const createTerms = async (termsBody) => {
  if (termsBody.content) {
    termsBody.content = he.decode(termsBody.content);
  }

  const existingTerms = await TermsAndCondition.findOne();
  if (existingTerms) {
    existingTerms.set(termsBody);
    await existingTerms.save();
    return existingTerms;
  } else {
    const newTerms = await TermsAndCondition.create(termsBody);
    return newTerms;
  }
};

const queryTerms = async () => {
  const terms = await TermsAndCondition.find();
  return terms;
};

const createAboutUs = async (body) => {
  if (body.content) {
    body.content = he.decode(body.content);
  }

  const existingAboutUs = await AboutUs.findOne();
  if (existingAboutUs) {
    existingAboutUs.set(body);
    await existingAboutUs.save();
    return existingAboutUs;
  } else {
    const newAboutUs = await AboutUs.create(body);
    return newAboutUs;
  }
};

const queryAboutUs = async () => {
  const newAboutUs = await AboutUs.find();
  return newAboutUs;
};

// Admin-curated properties for the homepage's hero and "Dream Home" sections,
// plus the free-form content that goes with the latter. Same upsert/singleton
// pattern as AboutUs/Privacy/Terms.
const PROPERTY_SHOWCASE_FIELDS = "title slug images price status type";

const getHomepageSettings = async () => {
  const settings = await HomepageSettings.findOne()
    .populate("heroProperties", PROPERTY_SHOWCASE_FIELDS)
    .populate("dreamHomeProperties", PROPERTY_SHOWCASE_FIELDS);

  if (settings) return settings;

  // Never configured yet - default to the newest listings rather than an
  // empty homepage, until the admin picks their own. Property.find() simply
  // returns [] with no properties yet, so this never errors on an empty site.
  const [heroDefaults, dreamHomeDefaults] = await Promise.all([
    Property.find({ isDeleted: false }).sort({ createdAt: -1 }).limit(3).select(PROPERTY_SHOWCASE_FIELDS),
    Property.find({ isDeleted: false }).sort({ createdAt: -1 }).limit(2).select(PROPERTY_SHOWCASE_FIELDS),
  ]);

  return {
    heroProperties: heroDefaults,
    dreamHomeProperties: dreamHomeDefaults,
    dreamHomeHeading: HomepageSettings.schema.path("dreamHomeHeading").defaultValue,
    dreamHomeSubheading: HomepageSettings.schema.path("dreamHomeSubheading").defaultValue,
    dreamHomeContent: HomepageSettings.schema.path("dreamHomeContent").defaultValue,
  };
};

const updateHomepageSettings = async (body) => {
  if (body.dreamHomeContent) {
    body.dreamHomeContent = he.decode(body.dreamHomeContent);
  }

  const existing = await HomepageSettings.findOne();
  const saved = existing
    ? await Object.assign(existing, body).save()
    : await HomepageSettings.create(body);

  return HomepageSettings.findById(saved._id)
    .populate("heroProperties", PROPERTY_SHOWCASE_FIELDS)
    .populate("dreamHomeProperties", PROPERTY_SHOWCASE_FIELDS);
};

const getPublicStatus = async () => {
  const totalProperty = await Property.countDocuments({
    isDeleted: false,
  });

  const totalUsers = await User.countDocuments({
    isDeleted: false,
    role: "user",
  });

  const totalClient = Math.floor((totalUsers * 60) / 100);
  const happyClient = Math.floor((totalUsers * 10) / 100);

  return {
    totalProperty,
    totalClient,
    happyClient,
  };
};



module.exports = {
  createFavorite,
  queryFavorites,
  getFavoriteById,
  updateFavoriteById,
  deleteFavoriteById,
  getFavoriteByProperty,
  deleteFavoriteByProperty,

  getAllStatus,
  getPublicStatus,

  createPrivacy,
  queryPrivacy,
  createTerms,
  queryTerms,
  createAboutUs,
  queryAboutUs,

  getHomepageSettings,
  updateHomepageSettings,
};
