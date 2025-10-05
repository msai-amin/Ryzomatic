const logger = require('../utils/logger');

const cacheMiddleware = (ttl = 300) => { // 5 minutes default TTL
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching for authenticated requests with user-specific data
    if (req.user) {
      return next();
    }

    try {
      const redis = req.app.locals.redis;
      if (!redis) {
        return next();
      }

      const cacheKey = generateCacheKey(req);
      const cachedResponse = await redis.get(cacheKey);

      if (cachedResponse) {
        logger.info(`Cache hit for key: ${cacheKey}`);
        return res.json(JSON.parse(cachedResponse));
      }

      // Store original res.json
      const originalJson = res.json.bind(res);
      
      res.json = function(data) {
        // Cache the response
        redis.setex(cacheKey, ttl, JSON.stringify(data))
          .catch(err => logger.error('Cache set error:', err));
        
        // Call original res.json
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
};

const generateCacheKey = (req) => {
  const { method, url, query } = req;
  const queryString = Object.keys(query).length ? `?${new URLSearchParams(query)}` : '';
  return `cache:${method}:${url}${queryString}`;
};

const invalidateCache = async (redis, pattern) => {
  try {
    if (!redis) return;

    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(keys);
      logger.info(`Invalidated ${keys.length} cache entries for pattern: ${pattern}`);
    }
  } catch (error) {
    logger.error('Cache invalidation error:', error);
  }
};

const cacheUserData = (ttl = 600) => { // 10 minutes for user data
  return async (req, res, next) => {
    if (req.method !== 'GET' || !req.user) {
      return next();
    }

    try {
      const redis = req.app.locals.redis;
      if (!redis) {
        return next();
      }

      const cacheKey = `user:${req.user.id}:${req.method}:${req.url}`;
      const cachedResponse = await redis.get(cacheKey);

      if (cachedResponse) {
        logger.info(`User cache hit for key: ${cacheKey}`);
        return res.json(JSON.parse(cachedResponse));
      }

      // Store original res.json
      const originalJson = res.json.bind(res);
      
      res.json = function(data) {
        // Cache the response
        redis.setex(cacheKey, ttl, JSON.stringify(data))
          .catch(err => logger.error('User cache set error:', err));
        
        // Call original res.json
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('User cache middleware error:', error);
      next();
    }
  };
};

const clearUserCache = async (redis, userId) => {
  try {
    if (!redis) return;

    const pattern = `user:${userId}:*`;
    const keys = await redis.keys(pattern);
    
    if (keys.length > 0) {
      await redis.del(keys);
      logger.info(`Cleared ${keys.length} cache entries for user: ${userId}`);
    }
  } catch (error) {
    logger.error('Clear user cache error:', error);
  }
};

const cacheServiceHealth = (ttl = 60) => { // 1 minute for health checks
  return async (req, res, next) => {
    if (req.url !== '/health/services') {
      return next();
    }

    try {
      const redis = req.app.locals.redis;
      if (!redis) {
        return next();
      }

      const cacheKey = 'health:services';
      const cachedResponse = await redis.get(cacheKey);

      if (cachedResponse) {
        logger.info(`Health cache hit for key: ${cacheKey}`);
        return res.json(JSON.parse(cachedResponse));
      }

      // Store original res.json
      const originalJson = res.json.bind(res);
      
      res.json = function(data) {
        // Cache the response
        redis.setex(cacheKey, ttl, JSON.stringify(data))
          .catch(err => logger.error('Health cache set error:', err));
        
        // Call original res.json
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('Health cache middleware error:', error);
      next();
    }
  };
};

module.exports = {
  cacheMiddleware,
  cacheUserData,
  cacheServiceHealth,
  invalidateCache,
  clearUserCache
};
