const httpStatus = require("http-status");
const pick = require("../utils/pick");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const { paymentGatewayService } = require("../services");

const createGateway = catchAsync(async (req, res) => {
  req.body.createdBy = req.user.id;

  if (req.file) {
    req.body.logo = req.file.url;
  }

  const gateway = await paymentGatewayService.createGateway(req.body);

  res.status(httpStatus.CREATED).json(
    response({
      message: "Payment Gateway Created",
      status: "OK",
      statusCode: httpStatus.CREATED,
      data: gateway,
    })
  );
});

const getGatewayById = catchAsync(async (req, res) => {
  const gateway = await paymentGatewayService.getGatewayById(req.params.id);
  res.status(httpStatus.OK).json(
    response({
      message: "Payment Gateway Retrieved",
      status: "OK",
      statusCode: httpStatus.OK,
      data: gateway,
    })
  );
});

const updateGatewayById = catchAsync(async (req, res) => {
  if (req.file) {
    req.body.logo = req.file.url;
  }

  const gateway = await paymentGatewayService.updateGatewayById(
    req.params.id,
    req.body
  );
  res.status(httpStatus.OK).json(
    response({
      message: "Payment Gateway Updated",
      status: "OK",
      statusCode: httpStatus.OK,
      data: gateway,
    })
  );
});

const deleteGatewayById = catchAsync(async (req, res) => {
  const gateway = await paymentGatewayService.deleteGatewayById(req.params.id);
  res.status(httpStatus.OK).json(
    response({
      message: "Payment Gateway Deleted",
      status: "OK",
      statusCode: httpStatus.OK,
      data: gateway,
    })
  );
});

const listGateways = catchAsync(async (req, res) => {
  const filter = pick(req.query, ["name"]);
  const options = pick(req.query, ["sortBy", "limit", "page"]);
  const result = await paymentGatewayService.queryGateways(filter, options);

  res.status(httpStatus.OK).json(
    response({
      message: "Payment Gateways Retrieved",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});

module.exports = {
  createGateway,
  getGatewayById,
  updateGatewayById,
  deleteGatewayById,
  listGateways,
};
