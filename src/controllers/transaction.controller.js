const httpStatus = require("http-status");
const pick = require("../utils/pick");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const { transactionService } = require("../services");

const transactionCreate = catchAsync(async (req, res) => {
  req.body.user = req.user.id;

  if (req.file) {
    req.body.screenshot = req.file.url;
  }

  const transaction = await transactionService.createTransaction(req.body);

  res.status(httpStatus.CREATED).json(
    response({
      message: "Transaction Created",
      status: "OK",
      statusCode: httpStatus.CREATED,
      data: transaction,
    })
  );
});

const transactionGetById = catchAsync(async (req, res) => {
  const transaction = await transactionService.getTransactionById(req.params.id);
  res.status(httpStatus.OK).json(
    response({
      message: "Transaction Retrieved",
      status: "OK",
      statusCode: httpStatus.OK,
      data: transaction,
    })
  );
});

const transactionUpdateById = catchAsync(async (req, res) => {
  const transaction = await transactionService.updateTransactionById(
    req.params.id,
    req.body
  );
  res.status(httpStatus.OK).json(
    response({
      message: "Transaction Updated",
      status: "OK",
      statusCode: httpStatus.OK,
      data: transaction,
    })
  );
});

const transactionDeleteById = catchAsync(async (req, res) => {
  const transaction = await transactionService.deleteTransactionById(
    req.params.id
  );
  res.status(httpStatus.OK).json(
    response({
      message: "Transaction Deleted",
      status: "OK",
      statusCode: httpStatus.OK,
      data: transaction,
    })
  );
});

const transactionList = catchAsync(async (req, res) => {
  const filter = pick(req.query, ["type", "status", "user", "transactionId", "email"]);
  const options = pick(req.query, ["sortBy", "limit", "page"]);
  const result = await transactionService.queryTransactions(filter, options);
  res.status(httpStatus.OK).json(
    response({
      message: "Transactions Retrieved",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});

/**
 * A buyer's own purchase history.
 *
 * Separate from transactionList because that endpoint is an admin tool: it
 * accepts a `user` filter and returns every account's payments. Here the owner
 * is taken from the verified token and passed as a scope the query cannot
 * widen, so no permission check is needed — the caller is by construction only
 * ever reading their own records.
 */
const myTransactionList = catchAsync(async (req, res) => {
  const filter = pick(req.query, ["type", "status", "transactionId"]);
  const options = pick(req.query, ["sortBy", "limit", "page"]);

  // Newest first: a history page is read to check the most recent purchase.
  if (!options.sortBy) options.sortBy = "createdAt:desc";

  const result = await transactionService.queryTransactions(
    filter,
    options,
    req.user.id
  );

  res.status(httpStatus.OK).json(
    response({
      message: "Transactions Retrieved",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});

module.exports = {
  transactionCreate,
  transactionGetById,
  transactionUpdateById,
  transactionDeleteById,
  transactionList,
  myTransactionList,
};