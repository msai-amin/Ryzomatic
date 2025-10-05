const { logger } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error(err);

  // OpenAI API errors
  if (err.type === 'insufficient_quota') {
    const message = 'API quota exceeded. Please check your OpenAI account.';
    error = { message, statusCode: 429 };
  }

  if (err.type === 'invalid_request_error') {
    const message = 'Invalid request to AI service';
    error = { message, statusCode: 400 };
  }

  if (err.type === 'rate_limit_exceeded') {
    const message = 'Rate limit exceeded. Please try again later.';
    error = { message, statusCode: 429 };
  }

  // Anthropic API errors
  if (err.status === 429) {
    const message = 'Rate limit exceeded. Please try again later.';
    error = { message, statusCode: 429 };
  }

  if (err.status === 400) {
    const message = 'Invalid request to AI service';
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = { errorHandler };


