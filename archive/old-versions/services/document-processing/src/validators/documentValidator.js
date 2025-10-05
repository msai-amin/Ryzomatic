const Joi = require('joi');
const fs = require('fs').promises;
const path = require('path');

const validateDocument = async (file) => {
  try {
    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return {
        isValid: false,
        error: 'File size exceeds maximum limit of 50MB'
      };
    }

    // Check file type
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown'
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return {
        isValid: false,
        error: 'Unsupported file type. Only PDF, DOCX, TXT, and MD files are allowed.'
      };
    }

    // Check file extension matches MIME type
    const extension = path.extname(file.originalname).toLowerCase();
    const mimeTypeMap = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.md': 'text/markdown'
    };

    if (mimeTypeMap[extension] !== file.mimetype) {
      return {
        isValid: false,
        error: 'File extension does not match file type'
      };
    }

    // Check if file exists and is readable
    try {
      await fs.access(file.path, fs.constants.R_OK);
    } catch (error) {
      return {
        isValid: false,
        error: 'File is not readable or does not exist'
      };
    }

    // Additional validation for specific file types
    if (file.mimetype === 'application/pdf') {
      const pdfValidation = await validatePDF(file.path);
      if (!pdfValidation.isValid) {
        return pdfValidation;
      }
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: `Validation error: ${error.message}`
    };
  }
};

const validatePDF = async (filePath) => {
  try {
    // Basic PDF validation - check if file starts with PDF header
    const buffer = await fs.readFile(filePath, { start: 0, end: 4 });
    const header = buffer.toString('ascii');
    
    if (header !== '%PDF') {
      return {
        isValid: false,
        error: 'Invalid PDF file format'
      };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: `PDF validation error: ${error.message}`
    };
  }
};

const validateDocumentRequest = (req, res, next) => {
  const schema = Joi.object({
    document: Joi.object().required()
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

const validateDocumentId = (req, res, next) => {
  const schema = Joi.object({
    documentId: Joi.string().uuid().required()
  });

  const { error } = schema.validate(req.params);
  if (error) {
    return res.status(400).json({
      error: 'Invalid document ID format',
      details: error.details[0].message
    });
  }

  next();
};

const validateQueryParams = (req, res, next) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    status: Joi.string().valid('processing', 'completed', 'failed').optional()
  });

  const { error, value } = schema.validate(req.query);
  if (error) {
    return res.status(400).json({
      error: 'Invalid query parameters',
      details: error.details[0].message
    });
  }

  req.query = value;
  next();
};

module.exports = {
  validateDocument,
  validateDocumentRequest,
  validateDocumentId,
  validateQueryParams
};


