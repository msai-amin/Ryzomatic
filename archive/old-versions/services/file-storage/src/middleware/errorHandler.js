const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      details: err.details
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID format',
      message: 'The provided ID is not valid'
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      error: 'Duplicate Entry',
      message: 'A file with this information already exists'
    });
  }

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File Too Large',
        message: 'File size exceeds the maximum allowed limit'
      });
    }
    
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too Many Files',
        message: 'Number of files exceeds the maximum allowed limit'
      });
    }

    return res.status(400).json({
      error: 'File Upload Error',
      message: err.message
    });
  }

  // Handle file system errors
  if (err.code === 'ENOENT') {
    return res.status(404).json({
      error: 'File Not Found',
      message: 'The requested file could not be found'
    });
  }

  if (err.code === 'EACCES') {
    return res.status(403).json({
      error: 'Permission Denied',
      message: 'Insufficient permissions to access the file'
    });
  }

  if (err.code === 'EMFILE' || err.code === 'ENFILE') {
    return res.status(503).json({
      error: 'Too Many Open Files',
      message: 'Server is experiencing high load, please try again later'
    });
  }

  // Handle Sharp image processing errors
  if (err.message.includes('Input file is missing')) {
    return res.status(404).json({
      error: 'Image Not Found',
      message: 'The requested image could not be found'
    });
  }

  if (err.message.includes('unsupported image format')) {
    return res.status(400).json({
      error: 'Unsupported Image Format',
      message: 'The image format is not supported'
    });
  }

  // Handle file validation errors
  if (err.message.includes('File size exceeds')) {
    return res.status(413).json({
      error: 'File Too Large',
      message: err.message
    });
  }

  if (err.message.includes('File type') && err.message.includes('not allowed')) {
    return res.status(400).json({
      error: 'Unsupported File Type',
      message: err.message
    });
  }

  if (err.message.includes('File not found')) {
    return res.status(404).json({
      error: 'File Not Found',
      message: err.message
    });
  }

  // Default error response
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

module.exports = { errorHandler };
