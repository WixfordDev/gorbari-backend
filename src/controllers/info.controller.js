const httpStatus = require("http-status");
const pick = require("../utils/pick");
const response = require("../config/response");
const { infoService } = require("../services");
const catchAsync = require("../utils/catchAsync");

const createFavorite = catchAsync(async (req, res) => {
  req.body.user = req.user.id;

  const favorite = await infoService.createFavorite(req.body);
  res.status(httpStatus.CREATED).json(
    response({
      message: "Favorite Saved",
      status: "OK",
      statusCode: httpStatus.CREATED,
      data: favorite,
    })
  );
});

const getFavorites = catchAsync(async (req, res) => {
  const filter = pick(req.query, ["user", "property"]);
  const options = pick(req.query, ["sortBy", "limit", "page"]);

  const result = await infoService.queryFavorites(filter, options, req.user.id);

  res.status(httpStatus.OK).json(
    response({
      message: "All Favorites",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});

const getFavoriteById = catchAsync(async (req, res) => {
  const favorite = await infoService.getFavoriteById(req.params.favoriteId);

  res.status(httpStatus.OK).json(
    response({
      message: "Favorite Found",
      status: "OK",
      statusCode: httpStatus.OK,
      data: favorite,
    })
  );
});

const updateFavorite = catchAsync(async (req, res) => {
  const favorite = await infoService.updateFavoriteById(
    req.params.favoriteId,
    req.body
  );

  res.status(httpStatus.OK).json(
    response({
      message: "Favorite Updated",
      status: "OK",
      statusCode: httpStatus.OK,
      data: favorite,
    })
  );
});

const removeFavorite = catchAsync(async (req, res) => {
  await infoService.deleteFavoriteByProperty(req.body.property);

  res.status(httpStatus.OK).json(
    response({
      message: "Property removed from favorite",
      status: "OK",
      statusCode: httpStatus.OK,
      data: null,
    })
  );
});

const deleteFavorite = catchAsync(async (req, res) => {
  await infoService.deleteFavoriteById(req.params.favoriteId);

  res.status(httpStatus.OK).json(
    response({
      message: "Favorite Deleted",
      status: "OK",
      statusCode: httpStatus.OK,
      data: null,
    })
  );
});

const getAllStatus = catchAsync(async (req, res) => {
  const result = await infoService.getAllStatus(req.query.year, req.user);

  res.status(httpStatus.OK).json(
    response({
      message: "All Status",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});

const getPublicStatus = catchAsync(async (req, res) => {
  const result = await infoService.getPublicStatus();

  res.status(httpStatus.OK).json(
    response({
      message: "All Status",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});

const createPrivacy = catchAsync(async (req, res) => {
  const privacy = await infoService.createPrivacy(req.body);
  res
    .status(httpStatus.CREATED)
    .json(
      response({
        message: "Privacy Policy Created",
        status: "OK",
        statusCode: httpStatus.CREATED,
        data: privacy,
      })
    );
});

const queryPrivacy = catchAsync(async (req, res) => {
  const result = await infoService.queryPrivacy();
  res
    .status(httpStatus.OK)
    .json(
      response({
        message: "Privacy Policy",
        status: "OK",
        statusCode: httpStatus.OK,
        data: result,
      })
    );
});

const createTerms = catchAsync(async (req, res) => {
  const terms = await infoService.createTerms(req.body);
  res
    .status(httpStatus.CREATED)
    .json(
      response({
        message: "Terms and Services Created",
        status: "OK",
        statusCode: httpStatus.CREATED,
        data: terms,
      })
    );
});

const queryTerms = catchAsync(async (req, res) => {
  const result = await infoService.queryTerms();
  res
    .status(httpStatus.OK)
    .json(
      response({
        message: "Terms and Services",
        status: "OK",
        statusCode: httpStatus.OK,
        data: result,
      })
    );
});

const createAboutUs = catchAsync(async (req, res) => {
  const trustSafety = await infoService.createAboutUs(req.body);
  res
    .status(httpStatus.CREATED)
    .json(
      response({
        message: "About us Created",
        status: "OK",
        statusCode: httpStatus.CREATED,
        data: trustSafety,
      })
    );
});

const queryAboutUs = catchAsync(async (req, res) => {
  const result = await infoService.queryAboutUs();
  res
    .status(httpStatus.OK)
    .json(
      response({
        message: "About us",
        status: "OK",
        statusCode: httpStatus.OK,
        data: result,
      })
    );
});

const getHomepageSettings = catchAsync(async (req, res) => {
  const result = await infoService.getHomepageSettings();
  res.status(httpStatus.OK).json(
    response({
      message: "Homepage settings",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});

const updateHomepageSettings = catchAsync(async (req, res) => {
  const result = await infoService.updateHomepageSettings(req.body);
  res.status(httpStatus.OK).json(
    response({
      message: "Homepage settings updated",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});

module.exports = {
  createFavorite,
  getFavorites,
  getFavoriteById,
  updateFavorite,
  deleteFavorite,
  removeFavorite,

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
