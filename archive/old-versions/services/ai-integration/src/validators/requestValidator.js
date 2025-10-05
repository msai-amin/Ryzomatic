const Joi = require('joi');

const validateRequest = (req, res, next) => {
  const schema = Joi.object({
    prompt: Joi.string().min(1).max(50000).optional(),
    text: Joi.string().min(1).max(100000).optional(),
    model: Joi.string().optional(),
    maxTokens: Joi.number().integer().min(1).max(4000).optional(),
    temperature: Joi.number().min(0).max(2).optional(),
    systemPrompt: Joi.string().max(10000).optional(),
    question: Joi.string().min(1).max(1000).optional(),
    context: Joi.string().max(5000).optional(),
    maxLength: Joi.number().integer().min(10).max(2000).optional(),
    style: Joi.string().valid('concise', 'detailed', 'bullet', 'executive').optional(),
    type: Joi.string().valid('general', 'business', 'technical', 'research').optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details[0].message
    });
  }

  next();
};

const validateCompletionRequest = (req, res, next) => {
  const schema = Joi.object({
    prompt: Joi.string().min(1).max(50000).required(),
    model: Joi.string().optional(),
    maxTokens: Joi.number().integer().min(1).max(4000).optional(),
    temperature: Joi.number().min(0).max(2).optional(),
    systemPrompt: Joi.string().max(10000).optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details[0].message
    });
  }

  next();
};

const validateEmbeddingsRequest = (req, res, next) => {
  const schema = Joi.object({
    text: Joi.string().min(1).max(100000).required(),
    model: Joi.string().optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details[0].message
    });
  }

  next();
};

const validateSummarizeRequest = (req, res, next) => {
  const schema = Joi.object({
    text: Joi.string().min(1).max(100000).required(),
    maxLength: Joi.number().integer().min(10).max(2000).optional(),
    style: Joi.string().valid('concise', 'detailed', 'bullet', 'executive').optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details[0].message
    });
  }

  next();
};

const validateQARequest = (req, res, next) => {
  const schema = Joi.object({
    text: Joi.string().min(1).max(100000).required(),
    question: Joi.string().min(1).max(1000).required(),
    context: Joi.string().max(5000).optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details[0].message
    });
  }

  next();
};

const validateInsightsRequest = (req, res, next) => {
  const schema = Joi.object({
    text: Joi.string().min(1).max(100000).required(),
    type: Joi.string().valid('general', 'business', 'technical', 'research').optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details[0].message
    });
  }

  next();
};

module.exports = {
  validateRequest,
  validateCompletionRequest,
  validateEmbeddingsRequest,
  validateSummarizeRequest,
  validateQARequest,
  validateInsightsRequest
};


