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
      message: 'A record with this information already exists'
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid Token',
      message: 'The provided token is invalid'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token Expired',
      message: 'The provided token has expired'
    });
  }

  if (err.message === 'User not found') {
    return res.status(404).json({
      error: 'User Not Found',
      message: 'The requested user does not exist'
    });
  }

  if (err.message === 'Chat not found') {
    return res.status(404).json({
      error: 'Chat Not Found',
      message: 'The requested chat does not exist'
    });
  }

  if (err.message === 'Message not found') {
    return res.status(404).json({
      error: 'Message Not Found',
      message: 'The requested message does not exist'
    });
  }

  if (err.message === 'Access denied') {
    return res.status(403).json({
      error: 'Access Denied',
      message: 'You do not have permission to access this resource'
    });
  }

  if (err.message === 'Invalid credentials') {
    return res.status(401).json({
      error: 'Invalid Credentials',
      message: 'The provided credentials are incorrect'
    });
  }

  if (err.message === 'User already exists') {
    return res.status(409).json({
      error: 'User Already Exists',
      message: 'A user with this email already exists'
    });
  }

  if (err.message === 'Account is not active') {
    return res.status(401).json({
      error: 'Account Inactive',
      message: 'Your account is not active'
    });
  }

  if (err.message === 'Message content cannot be empty') {
    return res.status(400).json({
      error: 'Invalid Message',
      message: 'Message content cannot be empty'
    });
  }

  if (err.message === 'Message too long') {
    return res.status(400).json({
      error: 'Message Too Long',
      message: 'Message exceeds maximum length'
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
