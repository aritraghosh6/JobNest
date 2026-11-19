const multer = require('multer');
const AppError = require('../utils/AppError');

const notFound = (req, res, next) => {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

/**
 * Converts every error into the same JSON shape:
 *   { "error": "Readable message", "details": { field: "problem" } }
 * Stack traces and internal paths are never sent to the client.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message;
  let details = err.details;

  if (err.name === 'ValidationError' && err.errors) {
    status = 400;
    message = 'Please correct the highlighted fields.';
    details = {};
    for (const [field, e] of Object.entries(err.errors)) details[field] = e.message;
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid value for ${err.path}.`;
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = field === 'email' ? 'An account with this email already exists.' : 'This record already exists.';
  } else if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'The file is too large.' : 'File upload failed. Please check the file and try again.';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid request body';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body is too large.';
  }

  if (status >= 500) {
    console.error(err);
    message = 'Something went wrong on the server. Please try again.';
    details = undefined;
  }

  const body = { error: message };
  if (details) body.details = details;
  res.status(status).json(body);
};

module.exports = { notFound, errorHandler };
