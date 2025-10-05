const Joi = require('joi');

const validateRequest = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().min(1).max(100).optional(),
    metadata: Joi.object().optional(),
    documents: Joi.array().items(
      Joi.object({
        id: Joi.string().optional(),
        text: Joi.string().min(1).max(100000).optional(),
        content: Joi.string().min(1).max(100000).optional(),
        metadata: Joi.object().optional()
      })
    ).optional(),
    embeddings: Joi.array().items(Joi.array().items(Joi.number())).optional(),
    query: Joi.string().min(1).max(1000).optional(),
    queryEmbeddings: Joi.array().items(Joi.number()).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    filter: Joi.object().optional(),
    includeMetadata: Joi.boolean().optional(),
    document: Joi.string().min(1).max(100000).optional(),
    metadata: Joi.object().optional()
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

const validateCollectionRequest = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().min(1).max(100).required(),
    metadata: Joi.object().optional()
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

const validateDocumentRequest = (req, res, next) => {
  const schema = Joi.object({
    documents: Joi.array().items(
      Joi.object({
        id: Joi.string().optional(),
        text: Joi.string().min(1).max(100000).optional(),
        content: Joi.string().min(1).max(100000).optional(),
        metadata: Joi.object().optional()
      })
    ).min(1).required(),
    embeddings: Joi.array().items(Joi.array().items(Joi.number())).optional()
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

const validateSearchRequest = (req, res, next) => {
  const schema = Joi.object({
    query: Joi.string().min(1).max(1000).optional(),
    queryEmbeddings: Joi.array().items(Joi.number()).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    filter: Joi.object().optional(),
    includeMetadata: Joi.boolean().optional()
  }).or('query', 'queryEmbeddings');

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details[0].message
    });
  }

  next();
};

const validateUpdateRequest = (req, res, next) => {
  const schema = Joi.object({
    document: Joi.string().min(1).max(100000).optional(),
    embeddings: Joi.array().items(Joi.number()).optional(),
    metadata: Joi.object().optional()
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
  validateCollectionRequest,
  validateDocumentRequest,
  validateSearchRequest,
  validateUpdateRequest
};


