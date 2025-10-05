const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const redis = require('redis');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const logger = require('./utils/logger');
const documentProcessor = require('./processors/documentProcessor');
const { validateFileUpload } = require('./middleware/validation');
const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.DOCUMENT_PROCESSING_PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
app.use(rateLimiter);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
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
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, and TXT files are allowed.'), false);
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
app.post('/process', upload.single('document'), validateFileUpload, async (req, res) => {
  try {
    const { file } = req;
    const { userId, metadata } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    logger.info(`Processing document: ${file.originalname} for user: ${userId}`);

    // Process the document
    const result = await documentProcessor.processDocument(file, {
      userId,
      metadata: metadata ? JSON.parse(metadata) : {}
    });

    // Clean up uploaded file
    await fs.unlink(file.path);

    res.json({
      success: true,
      documentId: result.documentId,
      content: result.content,
      metadata: result.metadata,
      processingTime: result.processingTime
    });

  } catch (error) {
    logger.error('Document processing error:', error);
    
    // Clean up file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        logger.error('Error cleaning up file:', cleanupError);
      }
    }

    res.status(500).json({
      error: 'Document processing failed',
      message: error.message
    });
  }
});

// Get processing status
app.get('/status/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const status = await documentProcessor.getProcessingStatus(documentId);
    res.json(status);
  } catch (error) {
    logger.error('Error getting processing status:', error);
    res.status(500).json({ error: 'Failed to get processing status' });
  }
});

// Batch process documents
app.post('/batch-process', upload.array('documents', 10), async (req, res) => {
  try {
    const { files } = req;
    const { userId } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    logger.info(`Batch processing ${files.length} documents for user: ${userId}`);

    const results = await Promise.allSettled(
      files.map(file => documentProcessor.processDocument(file, { userId }))
    );

    const processedResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return {
          success: true,
          filename: files[index].originalname,
          documentId: result.value.documentId,
          content: result.value.content,
          metadata: result.value.metadata
        };
      } else {
        return {
          success: false,
          filename: files[index].originalname,
          error: result.reason.message
        };
      }
    });

    // Clean up uploaded files
    await Promise.all(
      files.map(file => fs.unlink(file.path))
    );

    res.json({
      success: true,
      results: processedResults,
      totalFiles: files.length,
      successfulProcesses: processedResults.filter(r => r.success).length
    });

  } catch (error) {
    logger.error('Batch processing error:', error);
    res.status(500).json({ error: 'Batch processing failed' });
  }
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Database and Redis connection
async function connectToDatabases() {
  try {
    // MongoDB connection
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-reader');
    logger.info('Connected to MongoDB');

    // Redis connection
    const redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    redisClient.on('error', (err) => logger.error('Redis Client Error:', err));
    await redisClient.connect();
    logger.info('Connected to Redis');

    // Make Redis client available globally
    app.locals.redis = redisClient;

  } catch (error) {
    logger.error('Database connection error:', error);
    process.exit(1);
  }
}

// Start server
async function startServer() {
  await connectToDatabases();
  
  app.listen(PORT, () => {
    logger.info(`Document Processing Service running on port ${PORT}`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (app.locals.redis) {
    await app.locals.redis.quit();
  }
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (app.locals.redis) {
    await app.locals.redis.quit();
  }
  await mongoose.connection.close();
  process.exit(0);
});

startServer().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

module.exports = app;
