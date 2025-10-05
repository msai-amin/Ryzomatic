const Joi = require('joi');

const validateRequest = (req, res, next) => {
  // Basic request validation
  const schema = Joi.object({
    method: Joi.string().valid('GET', 'POST', 'PUT', 'DELETE', 'PATCH').required(),
    url: Joi.string().required(),
    headers: Joi.object().optional(),
    body: Joi.any().optional()
  });

  const { error } = schema.validate({
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body
  });

  if (error) {
    return res.status(400).json({
      error: 'Invalid request',
      details: error.details.map(detail => detail.message)
    });
  }

  next();
};

const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  // In production, validate against database
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
  
  if (!validApiKeys.includes(apiKey)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  next();
};

const validateContentType = (allowedTypes) => {
  return (req, res, next) => {
    const contentType = req.headers['content-type'];
    
    if (!contentType) {
      return res.status(400).json({ error: 'Content-Type header required' });
    }

    if (!allowedTypes.includes(contentType)) {
      return res.status(400).json({ 
        error: 'Invalid content type',
        allowedTypes 
      });
    }

    next();
  };
};

const validateFileUpload = (req, res, next) => {
  const contentType = req.headers['content-type'];
  
  if (!contentType || !contentType.includes('multipart/form-data')) {
    return res.status(400).json({ error: 'File upload requires multipart/form-data' });
  }

  next();
};

const validatePagination = (req, res, next) => {
  const { page, limit } = req.query;
  
  if (page && (isNaN(page) || page < 1)) {
    return res.status(400).json({ error: 'Page must be a positive integer' });
  }
  
  if (limit && (isNaN(limit) || limit < 1 || limit > 100)) {
    return res.status(400).json({ error: 'Limit must be between 1 and 100' });
  }

  next();
};

const validateSearchQuery = (req, res, next) => {
  const { q } = req.query;
  
  if (q && q.length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }
  
  if (q && q.length > 100) {
    return res.status(400).json({ error: 'Search query too long' });
  }

  next();
};

const validateId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!id) {
      return res.status(400).json({ error: `${paramName} parameter required` });
    }
    
    // Basic UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: `Invalid ${paramName} format` });
    }

    next();
  };
};

const validateRequestBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }
    
    req.body = value;
    next();
  };
};

const validateQueryParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query);
    
    if (error) {
      return res.status(400).json({
        error: 'Query validation error',
        details: error.details.map(detail => detail.message)
      });
    }
    
    req.query = value;
    next();
  };
};

module.exports = {
  validateRequest,
  validateApiKey,
  validateContentType,
  validateFileUpload,
  validatePagination,
  validateSearchQuery,
  validateId,
  validateRequestBody,
  validateQueryParams
};
