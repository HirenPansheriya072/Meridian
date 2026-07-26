const env = require('../config/env');

function notFound(req, res) {
  res.status(404).json({ error: { message: `No route for ${req.method} ${req.originalUrl}` } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let details = err.details;

  if (err.name === 'CastError') {
    status = 400;
    message = 'That id is not valid';
  }
  if (err.code === 11000) {
    status = 409;
    message = 'That already exists';
  }
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Check the highlighted fields';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  }

  if (status >= 500) console.error(err);

  res.status(status).json({
    error: {
      message,
      ...(details ? { details } : {}),
      ...(env.isProd ? {} : { stack: err.stack }),
    },
  });
}

module.exports = { notFound, errorHandler };
