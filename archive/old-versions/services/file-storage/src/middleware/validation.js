const Joi = require('joi');

const fileUploadSchema = Joi.object({
  metadata: Joi.string().optional(),
  folder: Joi.string().max(100).optional()
});

const validateFileUpload = (req, res, next) => {
  const { error } = file.details.map(detail => detail.message) : [],
    data: value
  };
};

const validateFolder = (data) => {
  const { error, value } = folderSchema.validate(data);
  return {
    isValid: !error,
    errors: error ? error.details.map(detail => detail.message) : [],
    data: value
  };
};

const validateFileUpdate = (data) => {
  const schema = Joi.object({
    originalName: Joi.string().max(255).optional(),
    metadata: Joi.object().optional(),
    folder: Joi.string().max(100).optional()
  });

  const { error, value } = schema.validate(data);
  return {
    isValid: !error,
    errors: error ? error.details.map(detail => detail.message) : [],
    data: value
  };
};

const validatePagination = (query) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  });

  const { error, value } = schema.validate(query);
  return {
    isValid: !error,
    errors: error ? error.details.map(detail => detail.message) : [],
    data: value
  };
};

const validateSearch = (query) => {
  const schema = Joi.object({
    q: Joi.string().min(1).max(100).optional(),
    folder: Joi.string().max(100).optional(),
    type: Joi.string().max(50).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  });

  const { error, value } = schema.validate(query);
  return {
    isValid: !error,
    errors: error ? error.details.map(detail => detail.message) : [],
    data: value
  };
};

module.exports = {
  validateFileUpload,
  validateFolder,
  validateFileUpdate,
  validatePagination,
  validateSearch
};
