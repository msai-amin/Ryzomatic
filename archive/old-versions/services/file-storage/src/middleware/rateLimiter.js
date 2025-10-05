const rateLimit = require('express-rate-limit');

const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Too Many Requests',
      message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too Many Requests',
        message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// General rate limiter for all requests
const generalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per window
  'Too many requests from this IP, please try again later'
);

// Strict rate limiter for file uploads
const uploadLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  20, // 20 uploads per hour
  'Too many file uploads, please try again later'
);

// Batch upload rate limiter
const batchUploadLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  5, // 5 batch operations per hour
  'Too many batch uploads, please try again later'
);

// Download rate limiter
const downloadLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  30, // 30 downloads per minute
  'Too many downloads, please slow down'
);

const rateLimiter = (req, res, next) => {
  // Apply different rate limits based on the endpoint
  if (req.path === '/upload' && req.method === 'POST') {
    return uploadLimiter(req, res, next);
  }
  
  if (req.path === '/upload/batch' && req.method === 'POST') {
    return batchUploadLimiter(req, res, next);
  }
  
  if (req.path.includes('/download') && req.method === 'GET') {
    return downloadLimiter(req, res, next);
  }
  
  // Apply general rate limiter for other endpoints
  return generalLimiter(req, res, next);
};

module.exports = { rateLimiter };
