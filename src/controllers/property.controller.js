const httpStatus = require("http-status");
const pick = require("../utils/pick");
const response = require("../config/response");
const { propertyService, subscriptionService } = require("../services");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const { default: mongoose } = require("mongoose");
const cron = require("node-cron");
const { Property } = require("../models");

const createProperty = catchAsync(async (req, res) => {
  req.body.createdBy = req.user.id;

  const imagesCount = req.files?.images?.length || 0;

  if (req.user.role !== "admin") {
    // ❌ No subscription
    if (!req.user.subscription?.isSubscriptionTaken) {
      if (imagesCount > 1) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Maximum 1 image allowed. Please take a subscription plan."
        );
      }
    }

    // ✅ With subscription (credit-based validation)
    if (req.user.subscription?.isSubscriptionTaken) {
      const subscription = await subscriptionService.getSubscriptionById(
        req.user.subscription.subscriptionId
      );

      if (!subscription) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Subscription not found");
      }

      const maxImages = subscription.propertyImageCradit;

      if (imagesCount > maxImages) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Maximum ${maxImages} images allowed for your subscription plan`
        );
      }
    }
  }

  if (req.files?.images) {
    req.body.images = req.files.images.map(
      (file) => `/uploads/propertys/${file.filename}`
    );
  } else if (req.body.images) {
    req.body.images = Array.isArray(req.body.images)
      ? req.body.images.map((img) => `/uploads/propertys/${img}`)
      : [`/uploads/propertys/${req.body.images}`];
  }

  if (typeof req.body.other === "string") {
    req.body.other = JSON.parse(req.body.other);
  }

  if (typeof req.body.features === "string") {
    req.body.features = JSON.parse(req.body.features);
    req.body.isFeatures = req.body.features.length > 0;
  }

  if (typeof req.body.amenities === "string") {
    req.body.amenities = JSON.parse(req.body.amenities);
  }

  const property = await propertyService.createProperty(req.body);

  res.status(httpStatus.CREATED).json(
    response({
      message: "Property created successfully",
      status: "OK",
      statusCode: httpStatus.CREATED,
      data: property,
    })
  );
});

const getProperties = catchAsync(async (req, res) => {
  const filter = pick(req.query, [
    "title",
    "type",
    "address",
    "city",
    "state",
    "country",
    "bedrooms",
    "bathrooms",
    "zipCode",
    "lotSize",
    "maxPrice",
    "minPrice",
    "minAreaSqFt",
    "maxAreaSqFt",
    "status",
    "catagory",
    "isBosted",
  ]);

  if (filter.minPrice || filter.maxPrice) {
    filter.price = {};
    if (filter.minPrice) filter.price.min = Number(filter.minPrice);
    if (filter.maxPrice) filter.price.max = Number(filter.maxPrice);
    delete filter.minPrice;
    delete filter.maxPrice;
  }

  if (filter.minAreaSqFt || filter.maxAreaSqFt) {
    filter.areaSqFt = {};
    if (filter.minAreaSqFt) filter.areaSqFt.min = Number(filter.minAreaSqFt);
    if (filter.maxAreaSqFt) filter.areaSqFt.max = Number(filter.maxAreaSqFt);
    delete filter.minAreaSqFt;
    delete filter.maxAreaSqFt;
  }
  Object.keys(filter).forEach((key) => {
    if (typeof filter[key] === "string" && filter[key].includes(",")) {
      filter[key] = filter[key]
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v);
    }
  });

  const options = pick(req.query, ["sortBy", "limit", "page"]);
  const result = await propertyService.queryProperties(filter, options);

  res.status(httpStatus.OK).json(
    response({
      message: "All Properties",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});

const getPropertiesForAgent = catchAsync(async (req, res) => {
  const filter = pick(req.query, [
    "title",
    "type",
    "address",
    "city",
    "state",
    "country",
    "bedrooms",
    "bathrooms",
    "zipCode",
    "lotSize",
    "maxPrice",
    "minPrice",
    "minAreaSqFt",
    "maxAreaSqFt",
    "status",
    "catagory",
    "isBosted",
    "isTopView",
  ]);

  if (filter.minPrice || filter.maxPrice) {
    filter.price = {};
    if (filter.minPrice) filter.price.min = Number(filter.minPrice);
    if (filter.maxPrice) filter.price.max = Number(filter.maxPrice);
    delete filter.minPrice;
    delete filter.maxPrice;
  }

  if (filter.minAreaSqFt || filter.maxAreaSqFt) {
    filter.areaSqFt = {};
    if (filter.minAreaSqFt) filter.areaSqFt.min = Number(filter.minAreaSqFt);
    if (filter.maxAreaSqFt) filter.areaSqFt.max = Number(filter.maxAreaSqFt);
    delete filter.minAreaSqFt;
    delete filter.maxAreaSqFt;
  }
  Object.keys(filter).forEach((key) => {
    if (typeof filter[key] === "string" && filter[key].includes(",")) {
      filter[key] = filter[key]
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v);
    }
  });

  const options = pick(req.query, ["sortBy", "limit", "page"]);
  const result = await propertyService.queryPropertiesForAgent(
    filter,
    options,
    req.user.id
  );

  res.status(httpStatus.OK).json(
    response({
      message: "All Properties",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});

const getPropertiesAdvanced = catchAsync(async (req, res) => {
  const filter = pick(req.query, [
    "title",
    "type",
    "address",
    "city",
    "state",
    "country",
    "bedrooms",
    "bathrooms",
    "zipCode",
    "lotSize",
    "yearBuilt",
    "garage",
    "kitchen",
    "status",
    "isFeatures",

    // Range filters --->
    "maxPrice",
    "minPrice",
    "minAreaSqFt",
    "maxAreaSqFt",
    "minLotSize",
    "maxLotSize",
    "minBedrooms",
    "maxBedrooms",
    "minBathrooms",
    "maxBathrooms",
    "minYearBuilt",
    "maxYearBuilt",
  ]);

  const createRangeFilter = (minKey, maxKey, targetKey) => {
    if (filter[minKey] || filter[maxKey]) {
      filter[targetKey] = {};
      if (filter[minKey]) filter[targetKey].min = Number(filter[minKey]);
      if (filter[maxKey]) filter[targetKey].max = Number(filter[maxKey]);
      delete filter[minKey];
      delete filter[maxKey];
    }
  };

  createRangeFilter("minPrice", "maxPrice", "price");
  createRangeFilter("minAreaSqFt", "maxAreaSqFt", "areaSqFt");
  createRangeFilter("minLotSize", "maxLotSize", "lotSize");
  createRangeFilter("minBedrooms", "maxBedrooms", "bedrooms");
  createRangeFilter("minBathrooms", "maxBathrooms", "bathrooms");
  createRangeFilter("minYearBuilt", "maxYearBuilt", "yearBuilt");

  Object.keys(filter).forEach((key) => {
    if (typeof filter[key] === "string" && filter[key].includes(",")) {
      filter[key] = filter[key]
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v);
    }
  });

  const options = pick(req.query, ["sortBy", "limit", "page"]);
  const result = await propertyService.queryProperties(filter, options);

  res.status(httpStatus.OK).json(
    response({
      message: "All Properties",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});

const getPropertyById = catchAsync(async (req, res) => {
  const property = await propertyService.getPropertyById(req.params.propertyId);

  property.views += 1;

  await property.save();

  res.status(httpStatus.OK).json(
    response({
      message: "Property Found",
      status: "OK",
      statusCode: httpStatus.OK,
      data: property,
    })
  );
});

const updateProperty = catchAsync(async (req, res) => {
  const imagesCount = req.files?.images?.length || 0;

  // ✅ ADMIN: Skip subscription & image limit checks
  if (req.user.role !== "admin") {
    // ❌ No subscription
    if (!req.user.subscription?.isSubscriptionTaken) {
      if (imagesCount > 1) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Maximum 1 image allowed. Please take a subscription plan."
        );
      }
    }

    // ✅ With subscription (credit-based validation)
    if (req.user.subscription?.isSubscriptionTaken) {
      const subscription = await subscriptionService.getSubscriptionById(
        req.user.subscription.subscriptionId
      );

      if (!subscription) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Subscription not found");
      }

      const maxImages = subscription.propertyImageCradit;

      if (imagesCount > maxImages) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Maximum ${maxImages} images allowed for your subscription plan`
        );
      }
    }
  }

  // Images handling
  if (req.files?.images) {
    req.body.images = req.files.images.map(
      (file) => `/uploads/propertys/${file.filename}`
    );
  } else if (req.body.images) {
    req.body.images = Array.isArray(req.body.images)
      ? req.body.images.map((img) => `/uploads/propertys/${img}`)
      : [`/uploads/propertys/${req.body.images}`];
  }

  // Parse JSON fields
  if (typeof req.body.other === "string") {
    req.body.other = JSON.parse(req.body.other);
  }

  if (typeof req.body.features === "string") {
    req.body.features = JSON.parse(req.body.features);
    req.body.isFeatures = req.body.features.length > 0;
  }

  if (typeof req.body.amenities === "string") {
    req.body.amenities = JSON.parse(req.body.amenities);
  }

  const property = await propertyService.updatePropertyById(
    req.params.propertyId,
    req.body
  );

  res.status(httpStatus.OK).json(
    response({
      message: "Property updated successfully",
      status: "OK",
      statusCode: httpStatus.OK,
      data: property,
    })
  );
});

const uploadPropertyImage = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No image uploaded");
  }

  // Get property first (to count existing images)
  const property = await propertyService.getPropertyById(req.params.propertyId);

  if (!property) {
    throw new ApiError(httpStatus.NOT_FOUND, "Property not found");
  }

  const existingImagesCount = property.images?.length || 0;

  // ✅ ADMIN: Skip subscription & image limit checks
  if (req.user.role !== "admin") {
    // ❌ No subscription
    if (!req.user.subscription?.isSubscriptionTaken) {
      if (existingImagesCount >= 1) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Maximum 1 image allowed. Please take a subscription plan."
        );
      }
    }

    // ✅ With subscription (credit-based validation)
    if (req.user.subscription?.isSubscriptionTaken) {
      const subscription = await subscriptionService.getSubscriptionById(
        req.user.subscription.subscriptionId
      );

      if (!subscription) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Subscription not found");
      }

      const maxImages = subscription.propertyImageCradit;

      if (existingImagesCount + 1 > maxImages) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Maximum ${maxImages} images allowed for your subscription plan`
        );
      }
    }
  }

  const imagePath = `/uploads/propertys/${req.file.filename}`;

  const updatedProperty = await propertyService.uploadPropertyImage(
    req.params.propertyId,
    imagePath
  );

  res.status(httpStatus.OK).json(
    response({
      message: "Image uploaded successfully",
      status: "OK",
      statusCode: httpStatus.OK,
      data: updatedProperty,
    })
  );
});

const deletePropertyImage = catchAsync(async (req, res) => {
  const { imagePath } = req.body;

  const property = await propertyService.deletePropertyImage(
    req.params.propertyId,
    imagePath
  );

  res.status(httpStatus.OK).json(
    response({
      message: "Image deleted successfully",
      status: "OK",
      statusCode: httpStatus.OK,
      data: property,
    })
  );
});

const deleteProperty = catchAsync(async (req, res) => {
  await propertyService.deletePropertyById(req.params.propertyId);
  res.status(httpStatus.OK).json(
    response({
      message: "Property Deleted",
      status: "OK",
      statusCode: httpStatus.OK,
      data: null,
    })
  );
});

const boostProperty = catchAsync(async (req, res) => {
  const user = req.user;
  const { propertyId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(propertyId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid property ID");
  }

  if (!user.subscription || !user.subscription.isSubscriptionTaken) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "You are not subscribed. Please take a subscription first."
    );
  }

  if (new Date(user.subscription.subscriptionExpirationDate) < new Date()) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Your subscription has expired. Please renew your subscription."
    );
  }

  if (!user.subscription.bostProperty || user.subscription.bostProperty <= 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "You have no boost property limit remaining."
    );
  }

  const subscription = await subscriptionService.getSubscriptionById(
    user.subscription.subscriptionId
  );

  if (!subscription) {
    throw new ApiError(httpStatus.NOT_FOUND, "Subscription not found");
  }

  const property = await propertyService.getPropertyById(propertyId);
  if (!property) {
    throw new ApiError(httpStatus.NOT_FOUND, "Property not found");
  }

  if (property.isBosted) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "This property is already boosted"
    );
  }

  const boostData = {
    isBosted: true,
    bostedRank: subscription.days || 1,
    bosteExpiry: user.subscription.subscriptionExpirationDate,
  };

  const boostedProperty = await propertyService.bostProperty(
    propertyId,
    boostData
  );

  user.subscription.bostProperty -= 1;
  await user.save();

  res.status(httpStatus.OK).json(
    response({
      message: "Property boosted successfully",
      status: "OK",
      statusCode: httpStatus.OK,
      data: boostedProperty,
    })
  );
});

const propertCronJob = () => {
  // Runs every day at 12:00 PM
  cron.schedule("0 12 * * *", async () => {
    try {
      console.log("[CRON] Boost rank decay job started");

      const result = await Property.updateMany(
        {
          isBosted: true,
          bostedRank: { $gt: 1 },
        },
        {
          $inc: { bostedRank: -1 },
        }
      );

      console.log(
        `[CRON] Boost rank updated. Modified: ${result.modifiedCount}`
      );
    } catch (error) {
      console.error("[CRON] Boost rank decay failed:", error);
    }
  });
};

propertCronJob();

module.exports = {
  createProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  uploadPropertyImage,
  deletePropertyImage,
  deleteProperty,
  getPropertiesForAgent,

  boostProperty,
};
