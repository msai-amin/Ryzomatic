const jwt = require('jsonwebtoken');
const axios = require('axios');
const logger = require('../utils/logger');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Verify user with user service (if available)
    try {
      const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:3002';
      const response = await axios.get(`${userServiceUrl}/users/${decoded.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 5000
      });
      
      if (response.data.success) {
        req.user = response.data.user;
      } else {
        return res.status(401).json({ error: 'User not found' });
      }
    } catch (userError) {
      // If user service is not available, continue with decoded token
      logger.warn('User service unavailable, using token only:', userError.message);
      req.user = { id: decoded.id, email: decoded.email, name: decoded.name };
    }

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = { id: decoded.id, email: decoded.email, name: decoded.name };
    next();
  } catch (error) {
    // For optional auth, we don't fail on token errors
    req.user = null;
    next();
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.metadata?.role || 'user';
    
    if (!roles.includes(userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

const requireService = (serviceName) => {
  return (req, res, next) => {
    const serviceUrl = process.env[`${serviceName.toUpperCase()}_URL`];
    
    if (!serviceUrl) {
      return res.status(503).json({ 
        error: 'Service unavailable',
        message: `${serviceName} service is not configured`
      });
    }

    req.serviceUrl = serviceUrl;
    next();
  };
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
  requireService
};
