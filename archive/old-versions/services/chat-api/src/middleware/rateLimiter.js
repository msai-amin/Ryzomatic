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

// Strict rate limiter for message sending
const messageLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  30, // 30 messages per minute
  'Too many messages sent, please slow down'
);

// Rate limiter for chat creation
const chatCreationLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  10, // 10 chats per hour
  'Too many chats created, please try again later'
);

// Rate limiter for authentication
const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 auth attempts per window
  'Too many authentication attempts, please try again later'
);

const rateLimiter = (req, res, next) => {
  // Apply different rate limits based on the endpoint
  if (req.path.includes('/chats') && req.method === 'POST') {
    return chatCreationLimiter(req, res, next);
  }
  
  if (req.path.includes('/auth')) {
    return authLimiter(req, res, next);
  }
  
  // Apply general rate limiter for other endpoints
  return generalLimiter(req, res, next);
};

// WebSocket rate limiter (simplified)
const wsRateLimiter = (socket, next) => {
  // This is a simplified implementation
  // In production, you'd want to use Redis or similar for distributed rate limiting
  const clientId = socket.handshake.address;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxMessages = 30;

  // This would need to be implemented with proper storage
  // For now, we'll just pass through
  next();
};

module.exports = { 
  rateLimiter, 
  messageLimiter, 
  chatCreationLimiter, 
  authLimiter,
  wsRateLimiter
};
