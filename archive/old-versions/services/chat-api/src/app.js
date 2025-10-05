const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const redis = require('redis');
const jwt = require('jsonwebtoken');

const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimiter');
const { authenticateToken } = require('./middleware/auth');
const { validateMessage } = require('./middleware/validation');

const ChatService = require('./services/chatService');
const MessageService = require('./services/messageService');
const UserService = require('./services/userService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ["http://localhost:3000"],
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.CHAT_API_PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use(rateLimiter);

// Initialize services
const chatService = new ChatService();
const messageService = new MessageService();
const userService = new UserService();

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'chat-api',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// REST API Routes

// Get chat history
app.get('/chats/:chatId/messages', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user.id;

    const messages = await messageService.getChatMessages(chatId, userId, page, limit);

    res.json({
      success: true,
      messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    logger.error('Error getting chat messages:', error);
    res.status(500).json({ error: 'Failed to get chat messages' });
  }
});

// Get user's chats
app.get('/chats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const chats = await chatService.getUserChats(userId, page, limit);

    res.json({
      success: true,
      chats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    logger.error('Error getting user chats:', error);
    res.status(500).json({ error: 'Failed to get chats' });
  }
});

// Create new chat
app.post('/chats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, metadata } = req.body;

    const chat = await chatService.createChat(userId, title, metadata);

    res.status(201).json({
      success: true,
      chat
    });

  } catch (error) {
    logger.error('Error creating chat:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

// Delete chat
app.delete('/chats/:chatId', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    await chatService.deleteChat(chatId, userId);

    res.json({
      success: true,
      message: 'Chat deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting chat:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

// Get chat details
app.get('/chats/:chatId', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const chat = await chatService.getChat(chatId, userId);

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json({
      success: true,
      chat
    });

  } catch (error) {
    logger.error('Error getting chat:', error);
    res.status(500).json({ error: 'Failed to get chat' });
  }
});

// Update chat
app.put('/chats/:chatId', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    const chat = await chatService.updateChat(chatId, userId, updates);

    res.json({
      success: true,
      chat
    });

  } catch (error) {
    logger.error('Error updating chat:', error);
    res.status(500).json({ error: 'Failed to update chat' });
  }
});

// WebSocket connection handling
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await userService.getUserById(decoded.id);
    
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.userId = user.id;
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Invalid authentication token'));
  }
});

io.on('connection', (socket) => {
  logger.info(`User ${socket.userId} connected`);

  // Join user to their personal room
  socket.join(`user_${socket.userId}`);

  // Handle joining a chat room
  socket.on('join_chat', async (data) => {
    try {
      const { chatId } = data;
      
      // Verify user has access to this chat
      const chat = await chatService.getChat(chatId, socket.userId);
      if (!chat) {
        socket.emit('error', { message: 'Chat not found or access denied' });
        return;
      }

      socket.join(`chat_${chatId}`);
      socket.emit('joined_chat', { chatId });
      
      logger.info(`User ${socket.userId} joined chat ${chatId}`);

    } catch (error) {
      logger.error('Error joining chat:', error);
      socket.emit('error', { message: 'Failed to join chat' });
    }
  });

  // Handle leaving a chat room
  socket.on('leave_chat', (data) => {
    const { chatId } = data;
    socket.leave(`chat_${chatId}`);
    socket.emit('left_chat', { chatId });
    
    logger.info(`User ${socket.userId} left chat ${chatId}`);
  });

  // Handle new message
  socket.on('send_message', async (data) => {
    try {
      const { chatId, content, type = 'text', metadata = {} } = data;

      // Validate message
      const validation = validateMessage({ content, type });
      if (!validation.isValid) {
        socket.emit('message_error', { 
          error: 'Invalid message', 
          details: validation.errors 
        });
        return;
      }

      // Verify user has access to this chat
      const chat = await chatService.getChat(chatId, socket.userId);
      if (!chat) {
        socket.emit('message_error', { error: 'Chat not found or access denied' });
        return;
      }

      // Create message
      const message = await messageService.createMessage({
        chatId,
        userId: socket.userId,
        content,
        type,
        metadata
      });

      // Broadcast message to all users in the chat
      io.to(`chat_${chatId}`).emit('new_message', message);

      // Send AI response if this is a user message
      if (type === 'text' && content.trim()) {
        try {
          // Get AI response from AI integration service
          const aiResponse = await chatService.getAIResponse(chatId, content, socket.userId);
          
          if (aiResponse) {
            const aiMessage = await messageService.createMessage({
              chatId,
              userId: 'ai',
              content: aiResponse,
              type: 'text',
              metadata: { isAI: true }
            });

            // Broadcast AI response
            io.to(`chat_${chatId}`).emit('new_message', aiMessage);
          }
        } catch (aiError) {
          logger.error('Error getting AI response:', aiError);
          // Don't emit error to user, just log it
        }
      }

    } catch (error) {
      logger.error('Error handling message:', error);
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });

  // Handle typing indicator
  socket.on('typing_start', (data) => {
    const { chatId } = data;
    socket.to(`chat_${chatId}`).emit('user_typing', {
      userId: socket.userId,
      chatId,
      isTyping: true
    });
  });

  socket.on('typing_stop', (data) => {
    const { chatId } = data;
    socket.to(`chat_${chatId}`).emit('user_typing', {
      userId: socket.userId,
      chatId,
      isTyping: false
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    logger.info(`User ${socket.userId} disconnected`);
  });
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
  
  server.listen(PORT, () => {
    logger.info(`Chat API Service running on port ${PORT}`);
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
