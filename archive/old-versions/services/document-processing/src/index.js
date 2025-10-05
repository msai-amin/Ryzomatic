const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const documentProcessor = require('./processors/documentProcessor');
const { validateDocument } = require('./validators/documentValidator');
const { logger } = require('./utils/logger');
const { connectDB } = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3003;

// Connect to MongoDB
connectDB();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
app.use(rateLimiter);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, TXT, and MD files are allowed.'), false);
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'document-processing',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Process document endpoint
app.post('/process', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No document file provided' });
    }

    logger.info(`Processing document: ${req.file.originalname}`);

    // Validate document
    const validation = await validateDocument(req.file);
    if (!validation.isValid) {
      await fs.unlink(req.file.path); // Clean up uploaded file
      return res.status(400).json({ error: validation.error });
    }

    // Process the document
    const result = await documentProcessor.processDocument(req.file);

    // Clean up uploaded file after processing
    await fs.unlink(req.file.path);

    logger.info(`Document processed successfully: ${result.documentId}`);

    res.status(200).json({
      success: true,
      documentId: result.documentId,
      metadata: result.metadata,
      extractedText: result.extractedText,
      summary: result.summary,
      processingTime: result.processingTime
    });

  } catch (error) {
    logger.error('Error processing document:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        logger.error('Error cleaning up file:', cleanupError);
      }
    }

    res.status(500).json({
      error: 'Failed to process document',
      message: error.message
    });
  }
});

// Get document status endpoint
app.get('/status/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const status = await documentProcessor.getDocumentStatus(documentId);
    
    if (!status) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.status(200).json(status);
  } catch (error) {
    logger.error('Error getting document status:', error);
    res.status(500).json({ error: 'Failed to get document status' });
  }
});

// Get processed documents endpoint
app.get('/documents', async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const documents = await documentProcessor.getDocuments({
      page: parseInt(page),
      limit: parseInt(limit),
      status
    });

    res.status(200).json(documents);
  } catch (error) {
    logger.error('Error getting documents:', error);
    res.status(500).json({ error: 'Failed to get documents' });
  }
});

// Delete document endpoint
app.delete('/documents/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const result = await documentProcessor.deleteDocument(documentId);
    
    if (!result) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.status(200).json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    logger.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Document Processing Service running on port ${PORT}`);
});

module.exports = app;


