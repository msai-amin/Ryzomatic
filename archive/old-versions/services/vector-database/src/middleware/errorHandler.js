const { logger } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error(err);

  // ChromaDB errors
  if (err.message && err.message.includes('Collection not found')) {
    const message = 'Collection not found';
    error = { message, statusCode: 404 };
  }

  if (err.message && err.message.includes('Document not found')) {
    const message = 'Document not found';
    error = { message, statusCode: 404 };
  }

  if (err.message && err.message.includes('already exists')) {
    const message = 'Resource already exists';
    error = { message, statusCode: 409 };
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


