const Joi = require('joi');

const messageSchema = Joi.object({
  content: Joi.string().required().min(1).max(10000),
  type: Joi.string().valid('text', 'image', 'file', 'system').default('text'),
  metadata: Joi.object().default({})
});

const chatSchema = Joi.object({
  title: Joi.string().max(200),
  metadata: Joi.object().default({})
});

const userSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  name: Joi.string().max(100).required(),
  metadata: Joi.object().default({})
});

const validateMessage = (data) => {
  const { error, value } = messageSchema.validate(data);
  return {
    isValid: !error,
    errors: error ? error.details.map(detail => detail.message) : [],
    data: value
  };
};

const validateChat = (data) => {
  const { error, value } = chatSchema.validate(data);
  return {
    isValid: !error,
    errors: error ? error.details.map(detail => detail.message) : [],
    data: value
  };
};

const validateUser = (data) => {
  const { error, value } = userSchema.validate(data);
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
    q: Joi.string().min(1).max(100).required(),
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
  validateMessage,
  validateChat,
  validateUser,
  validatePagination,
  validateSearch
};
