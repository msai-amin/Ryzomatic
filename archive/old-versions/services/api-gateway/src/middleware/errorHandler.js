const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    user: req.user ? req.user.id : 'anonymous'
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

  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'The requested service is currently unavailable'
    });
  }

  if (err.code === 'ETIMEDOUT') {
    return res.status(504).json({
      error: 'Gateway Timeout',
      message: 'The request timed out while waiting for a response'
    });
  }

  if (err.code === 'ENOTFOUND') {
    return res.status(502).json({
      error: 'Bad Gateway',
      message: 'Unable to connect to the requested service'
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

  if (err.message.includes('Rate limit exceeded')) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded, please try again later'
    });
  }

  if (err.message.includes('Service unavailable')) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'The requested service is temporarily unavailable'
    });
  }

  if (err.message.includes('Authentication required')) {
    return res.status(401).json({
      error: 'Authentication Required',
      message: 'Valid authentication token is required'
    });
  }

  if (err.message.includes('Insufficient permissions')) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have permission to access this resource'
    });
  }

  // Handle proxy errors
  if (err.code === 'ECONNRESET') {
    return res.status(502).json({
      error: 'Bad Gateway',
      message: 'Connection was reset by the target service'
    });
  }

  if (err.code === 'ECONNABORTED') {
    return res.status(504).json({
      error: 'Gateway Timeout',
      message: 'Request was aborted due to timeout'
    });
  }

  // Handle validation errors from services
  if (err.response && err.response.status === 400) {
    return res.status(400).json({
      error: 'Bad Request',
      message: err.response.data.message || 'Invalid request data',
      details: err.response.data.details
    });
  }

  // Handle service errors
  if (err.response && err.response.status >= 500) {
    return res.status(502).json({
      error: 'Bad Gateway',
      message: 'The target service returned an error',
      serviceError: err.response.data
    });
  }

  // Handle service not found
  if (err.response && err.response.status === 404) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'The requested resource was not found'
    });
  }

  // Handle service unauthorized
  if (err.response && err.response.status === 401) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed'
    });
  }

  // Handle service forbidden
  if (err.response && err.response.status === 403) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied'
    });
  }

  // Default error response
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : message,
    requestId: req.headers['x-request-id'] || 'unknown',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV !== 'production' && { 
      stack: err.stack,
      service: getServiceFromPath(req.path)
    })
  });
};

const getServiceFromPath = (path) => {
  if (path.startsWith('/api/documents')) return 'document-processing';
  if (path.startsWith('/api/chat')) return 'chat-api';
  if (path.startsWith('/api/files')) return 'file-storage';
  if (path.startsWith('/api/ai')) return 'ai-integration';
  if (path.startsWith('/api/vectors')) return 'vector-db';
  return 'api-gateway';
};

module.exports = { errorHandler };
