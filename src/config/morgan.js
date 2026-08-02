const morgan = require('morgan');
const config = require('./config');
const logger = require('./logger');

morgan.token('message', (req, res) => res.locals.errorMessage || '');

const getIpFormat = () => (config.env === 'production' ? ':remote-addr - ' : '');
const successResponseFormat = `${getIpFormat()}:method :url :status - :response-time ms`;
const errorResponseFormat = `${getIpFormat()}:method :url :status - :response-time ms - message: :message`;

const successHandler = morgan(successResponseFormat, {
  skip: (req, res) => res.statusCode >= 400,
  stream: { write: (message) => logger.info(message.trim()) },
});

// 4xx and 5xx are separated because they mean different things. A 4xx is the
// client being told no — an expired token, a failed validation — which is
// expected traffic and belongs at warn. Only 5xx indicates the server itself
// failed, so reserving error for those keeps genuine faults findable by
// severity.
const clientErrorHandler = morgan(errorResponseFormat, {
  skip: (req, res) => res.statusCode < 400 || res.statusCode >= 500,
  stream: { write: (message) => logger.warn(message.trim()) },
});

const errorHandler = morgan(errorResponseFormat, {
  skip: (req, res) => res.statusCode < 500,
  stream: { write: (message) => logger.error(message.trim()) },
});

module.exports = {
  successHandler,
  clientErrorHandler,
  errorHandler,
};
