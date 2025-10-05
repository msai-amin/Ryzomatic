const Joi = require('joi');

const fileUploadSchema = Joi.object({
  userId: Joi.string().required(),
  metadata: Joi.string().optional()
});

const validateFileUpload = (req, res, next) => {
  const { error } = fileUploadSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details.map(detail => detail.message)
    });
  }
  
  next();
};

const documentIdSchema = Joi.object({
  documentId: Joi.string().uuid().required()
});

const validateDocumentId = (req, res, next) => {
  const { error } = documentIdSchema.validate(req.params);
  
  if (error) {
    return res.status(400).json({
      error: 'Invalid document ID',
      details: error.details.map(detail => detail.message)
    });
  }
  
  next();
};

const batchProcessSchema = Joi.object({
  userId: Joi.string().required(),
  enableOCR: Joi.boolean().optional().default(false)
});

const validateBatchProcess = (req, res, next) => {
  const { error } = batchProcessSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details.map(detail => detail.message)
    });
  }
  
  next();
};

module.exports = {
  validateFileUpload,
  validateDocumentId,
  validateBatchProcess
};
