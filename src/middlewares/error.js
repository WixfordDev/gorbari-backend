const mongoose = require('mongoose');
const httpStatus = require('http-status');
const config = require('../config/config');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

const errorConverter = (err, req, res, next) => {
  let error = err;
  if (!(error instanceof ApiError)) {
    // The original read `error.statusCode || error instanceof mongoose.Error`,
    // which parses as `(error.statusCode) || (error instanceof mongoose.Error)`
    // — a boolean — so the ternary always chose 400 whenever statusCode was set,
    // turning genuine 500s into 400s. Each condition is now checked separately.
    let statusCode;
    if (error.statusCode) {
      statusCode = error.statusCode;
    } else if (error instanceof mongoose.Error) {
      statusCode = httpStatus.BAD_REQUEST;
    } else {
      statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    }
    const message = error.message || httpStatus[statusCode];
    error = new ApiError(statusCode, message, false, err.stack);
  }
  next(error);
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;
  if (config.env === 'production' && !err.isOperational) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = httpStatus[httpStatus.INTERNAL_SERVER_ERROR];
  }

  res.locals.errorMessage = err.message;

  const response = {
    code: statusCode,
    message,
    ...(config.env === 'development' && { stack: err.stack }),
  };

  // 4xx responses are the API working as designed — an expired token, a
  // validation failure, a missing record. Logging a full stack trace for those
  // buries genuine faults in noise, and an unauthenticated visitor hitting a
  // guarded endpoint is routine traffic rather than an incident. Morgan already
  // records every 4xx with its message, so nothing is logged here; only 5xx,
  // which means the server itself misbehaved, gets a trace.
  if (statusCode >= httpStatus.INTERNAL_SERVER_ERROR) {
    logger.error(err);
  }

  res.status(statusCode).send(response);
};

module.exports = {
  errorConverter,
  errorHandler,
};
