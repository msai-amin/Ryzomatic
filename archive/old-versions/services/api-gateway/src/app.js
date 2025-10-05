const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const redis = require('redis');

const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { authenticateToken } = require('./middleware/auth');
const { validateRequest } = require('./middleware/validation');
const { cacheMiddleware } = require('./middleware/cache');
const { metricsMiddleware } = require('./middleware/metrics');

const app = express();
const PORT = process.env.API_GATEWAY_PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this IP, please try again later'
  }
});
app.use(limiter);

// Metrics middleware
app.use(metricsMiddleware);

// Service configurations
const services = {
  documentProcessing: {
    target: process.env.DOCUMENT_PROCESSING_URL || 'http://localhost:3001',
    pathRewrite: { '^/api/documents': '' },
    changeOrigin: true,
    onError: (err, req, res) => {
      logger.error('Document processing service error:', err);
      res.status(503).json({ error: 'Document processing service unavailable' });
    }
  },
  chatApi: {
    target: process.env.CHAT_API_URL || 'http://localhost:3002',
    pathRewrite: { '^/api/chat': '' },
    changeOrigin: true,
    onError: (err, req, res) => {
      logger.error('Chat API service error:', err);
      res.status(503).json({ error: 'Chat API service unavailable' });
    }
  },
  fileStorage: {
    target: process.env.FILE_STORAGE_URL || 'http://localhost:3003',
    pathRewrite: { '^/api/files': '' },
    changeOrigin: true,
    onError: (err, req, res) => {
      logger.error('File storage service error:', err);
      res.status(503).json({ error: 'File storage service unavailable' });
    }
  },
  aiIntegration: {
    target: process.env.AI_INTEGRATION_URL || 'http://localhost:3004',
    pathRewrite: { '^/api/ai': '' },
    changeOrigin: true,
    onError: (err, req, res) => {
      logger.error('AI integration service error:', err);
      res.status(503).json({ error: 'AI integration service unavailable' });
    }
  },
  vectorDb: {
    target: process.env.VECTOR_DB_URL || 'http://localhost:3005',
    pathRewrite: { '^/api/vectors': '' },
    changeOrigin: true,
    onError: (err, req, res) => {
      logger.error('Vector database service error:', err);
      res.status(503).json({ error: 'Vector database service unavailable' });
    }
  }
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Service health check endpoint
app.get('/health/services', async (req, res) => {
  try {
    const serviceHealth = await checkServicesHealth();
    res.json({
      status: 'healthy',
      services: serviceHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error checking service health:', error);
    res.status(500).json({ error: 'Failed to check service health' });
  }
});

// API Documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'AI Reader Assistant API',
    version: '1.0.0',
    description: 'Microservices API for AI-powered document processing and chat',
    services: {
      documents: {
        baseUrl: '/api/documents',
        description: 'Document processing and management',
        endpoints: [
          'POST /process - Process a document',
          'GET /status/:id - Get processing status',
          'POST /batch-process - Process multiple documents'
        ]
      },
      chat: {
        baseUrl: '/api/chat',
        description: 'Real-time chat and messaging',
        endpoints: [
          'GET /chats - Get user chats',
          'POST /chats - Create new chat',
          'GET /chats/:id/messages - Get chat messages',
          'DELETE /chats/:id - Delete chat'
        ]
      },
      files: {
        baseUrl: '/api/files',
        description: 'File storage and CDN',
        endpoints: [
          'POST /upload - Upload file',
          'GET /files/:id - Get file info',
          'GET /files/:id/download - Download file',
          'DELETE /files/:id - Delete file'
        ]
      },
      ai: {
        baseUrl: '/api/ai',
        description: 'AI integration and processing',
        endpoints: [
          'POST /chat - AI chat completion',
          'POST /summarize - Summarize text',
          'POST /analyze - Analyze text',
          'POST /generate-questions - Generate questions'
        ]
      },
      vectors: {
        baseUrl: '/api/vectors',
        description: 'Vector database and embeddings',
        endpoints: [
          'POST /embeddings - Create embedding',
          'POST /search - Search similar documents',
          'GET /documents/:id/embeddings - Get document embeddings'
        ]
      }
    }
  });
});

// Document processing routes
app.use('/api/documents', 
  authenticateToken,
  validateRequest,
  createProxyMiddleware(services.documentProcessing)
);

// Chat API routes
app.use('/api/chat',
  authenticateToken,
  validateRequest,
  createProxyMiddleware(services.chatApi)
);

// File storage routes
app.use('/api/files',
  authenticateToken,
  validateRequest,
  createProxyMiddleware(services.fileStorage)
);

// AI integration routes
app.use('/api/ai',
  authenticateToken,
  validateRequest,
  createProxyMiddleware(services.aiIntegration)
);

// Vector database routes
app.use('/api/vectors',
  authenticateToken,
  validateRequest,
  createProxyMiddleware(services.vectorDb)
);

// WebSocket proxy for chat service
app.use('/ws/chat', createProxyMiddleware({
  target: process.env.CHAT_API_URL || 'http://localhost:3002',
  ws: true,
  changeOrigin: true,
  onError: (err, req, res) => {
    logger.error('WebSocket proxy error:', err);
  }
}));

// Public endpoints (no authentication required)
app.get('/api/public/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    message: 'The requested API endpoint does not exist',
    availableEndpoints: [
      '/api/documents',
      '/api/chat',
      '/api/files',
      '/api/ai',
      '/api/vectors',
      '/api/docs'
    ]
  });
});

// Service health check function
async function checkServicesHealth() {
  const axios = require('axios');
  const serviceHealth = {};

  for (const [serviceName, config] of Object.entries(services)) {
    try {
      const response = await axios.get(`${config.target}/health`, { timeout: 5000 });
      serviceHealth[serviceName] = {
        status: 'healthy',
        responseTime: response.headers['x-response-time'] || 'unknown',
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      serviceHealth[serviceName] = {
        status: 'unhealthy',
        error: error.message,
        lastChecked: new Date().toISOString()
      };
    }
  }

  return serviceHealth;
}

// Redis connection
async function connectToRedis() {
  try {
    const redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    redisClient.on('error', (err) => logger.error('Redis Client Error:', err));
    await redisClient.connect();
    logger.info('Connected to Redis');

    // Make Redis client available globally
    app.locals.redis = redisClient;

  } catch (error) {
    logger.error('Redis connection error:', error);
    // Don't exit, Redis is optional for caching
  }
}

// Start server
async function startServer() {
  await connectToRedis();
  
  app.listen(PORT, () => {
    logger.info(`API Gateway running on port ${PORT}`);
    logger.info(`Available endpoints:`);
    logger.info(`  - Health: http://localhost:${PORT}/health`);
    logger.info(`  - API Docs: http://localhost:${PORT}/api/docs`);
    logger.info(`  - Documents: http://localhost:${PORT}/api/documents`);
    logger.info(`  - Chat: http://localhost:${PORT}/api/chat`);
    logger.info(`  - Files: http://localhost:${PORT}/api/files`);
    logger.info(`  - AI: http://localhost:${PORT}/api/ai`);
    logger.info(`  - Vectors: http://localhost:${PORT}/api/vectors`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (app.locals.redis) {
    await app.locals.redis.quit();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (app.locals.redis) {
    await app.locals.redis.quit();
  }
  process.exit(0);
});

startServer().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

module.exports = app;
