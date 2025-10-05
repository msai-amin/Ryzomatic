const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const redis = require('redis');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');

const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimiter');
const { authenticateToken } = require('./middleware/auth');
const { validateFileUpload } = require('./middleware/validation');

const FileService = require('./services/fileService');
const CDNService = require('./services/cdnService');
const MetadataService = require('./services/metadataService');

const app = express();
const PORT = process.env.FILE_STORAGE_PORT || 3003;

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
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for now, but you can add restrictions
    cb(null, true);
  }
});

// Initialize services
const fileService = new FileService();
const cdnService = new CDNService();
const metadataService = new MetadataService();

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'file-storage',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Upload single file
app.post('/upload', authenticateToken, upload.single('file'), validateFileUpload, async (req, res) => {
  try {
    const { file } = req;
    const { metadata, folder } = req.body;
    const userId = req.user.id;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    logger.info(`Uploading file: ${file.originalname} for user: ${userId}`);

    // Process the file
    const result = await fileService.uploadFile(file, {
      userId,
      metadata: metadata ? JSON.parse(metadata) : {},
      folder: folder || 'default'
    });

    res.json({
      success: true,
      file: result,
      message: 'File uploaded successfully'
    });

  } catch (error) {
    logger.error('File upload error:', error);
    res.status(500).json({ error: 'File upload failed', message: error.message });
  }
});

// Upload multiple files
app.post('/upload/batch', authenticateToken, upload.array('files', 10), async (req, res) => {
  try {
    const { files } = req;
    const { metadata, folder } = req.body;
    const userId = req.user.id;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    logger.info(`Batch uploading ${files.length} files for user: ${userId}`);

    const results = await Promise.allSettled(
      files.map(file => fileService.uploadFile(file, {
        userId,
        metadata: metadata ? JSON.parse(metadata) : {},
        folder: folder || 'default'
      }))
    );

    const uploadedFiles = results
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);

    const failedFiles = results
      .filter(result => result.status === 'rejected')
      .map((result, index) => ({
        filename: files[index].originalname,
        error: result.reason.message
      }));

    res.json({
      success: true,
      uploadedFiles,
      failedFiles,
      totalFiles: files.length,
      successfulUploads: uploadedFiles.length,
      failedUploads: failedFiles.length
    });

  } catch (error) {
    logger.error('Batch upload error:', error);
    res.status(500).json({ error: 'Batch upload failed', message: error.message });
  }
});

// Get file by ID
app.get('/files/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;

    const file = await fileService.getFile(fileId, userId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({
      success: true,
      file
    });

  } catch (error) {
    logger.error('Error getting file:', error);
    res.status(500).json({ error: 'Failed to get file' });
  }
});

// Download file
app.get('/files/:fileId/download', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;

    const file = await fileService.getFile(fileId, userId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(fileService.getUploadDir(), file.path);
    
    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.download(filePath, file.originalName);

  } catch (error) {
    logger.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Get file content (for images, text files, etc.)
app.get('/files/:fileId/content', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;
    const { width, height, quality } = req.query;

    const file = await fileService.getFile(fileId, userId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(fileService.getUploadDir(), file.path);
    
    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // If it's an image and dimensions are specified, resize it
    if (file.mimeType.startsWith('image/') && (width || height)) {
      const resizedImage = await cdnService.resizeImage(filePath, {
        width: width ? parseInt(width) : undefined,
        height: height ? parseInt(height) : undefined,
        quality: quality ? parseInt(quality) : 80
      });

      res.setHeader('Content-Type', file.mimeType);
      res.send(resizedImage);
    } else {
      // Serve file as-is
      res.sendFile(path.resolve(filePath));
    }

  } catch (error) {
    logger.error('Error serving file content:', error);
    res.status(500).json({ error: 'Failed to serve file content' });
  }
});

// Get user's files
app.get('/files', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, folder, type, search } = req.query;

    const files = await fileService.getUserFiles(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      folder,
      type,
      search
    });

    res.json({
      success: true,
      files: files.files,
      pagination: files.pagination
    });

  } catch (error) {
    logger.error('Error getting user files:', error);
    res.status(500).json({ error: 'Failed to get files' });
  }
});

// Update file metadata
app.put('/files/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    const file = await fileService.updateFile(fileId, userId, updates);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({
      success: true,
      file,
      message: 'File updated successfully'
    });

  } catch (error) {
    logger.error('Error updating file:', error);
    res.status(500).json({ error: 'Failed to update file' });
  }
});

// Delete file
app.delete('/files/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;

    const result = await fileService.deleteFile(fileId, userId);

    if (!result) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Create folder
app.post('/folders', authenticateToken, async (req, res) => {
  try {
    const { name, parentFolder } = req.body;
    const userId = req.user.id;

    const folder = await fileService.createFolder(name, userId, parentFolder);

    res.status(201).json({
      success: true,
      folder,
      message: 'Folder created successfully'
    });

  } catch (error) {
    logger.error('Error creating folder:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// Get folders
app.get('/folders', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { parentFolder } = req.query;

    const folders = await fileService.getFolders(userId, parentFolder);

    res.json({
      success: true,
      folders
    });

  } catch (error) {
    logger.error('Error getting folders:', error);
    res.status(500).json({ error: 'Failed to get folders' });
  }
});

// Get storage statistics
app.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await fileService.getStorageStats(userId);

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    logger.error('Error getting storage stats:', error);
    res.status(500).json({ error: 'Failed to get storage stats' });
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
    logger.info(`File Storage Service running on port ${PORT}`);
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
