const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
require('dotenv').config();

const aiService = require('./services/aiService');
const { validateRequest } = require('./validators/requestValidator');
const { logger } = require('./utils/logger');
const { connectDB } = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3004;

// Connect to MongoDB
connectDB();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use(rateLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'ai-integration',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    availableModels: aiService.getAvailableModels()
  });
});

// Generate text completion
app.post('/completion', validateRequest, async (req, res) => {
  try {
    const { prompt, model, maxTokens, temperature, systemPrompt } = req.body;
    
    logger.info(`Generating completion with model: ${model || 'default'}`);

    const result = await aiService.generateCompletion({
      prompt,
      model: model || process.env.DEFAULT_AI_MODEL || 'gpt-3.5-turbo',
      maxTokens: maxTokens || parseInt(process.env.MAX_TOKENS) || 1000,
      temperature: temperature || parseFloat(process.env.TEMPERATURE) || 0.7,
      systemPrompt
    });

    logger.info('Completion generated successfully');

    res.status(200).json({
      success: true,
      result: {
        text: result.text,
        model: result.model,
        usage: result.usage,
        finishReason: result.finishReason
      }
    });

  } catch (error) {
    logger.error('Error generating completion:', error);
    res.status(500).json({
      error: 'Failed to generate completion',
      message: error.message
    });
  }
});

// Generate embeddings
app.post('/embeddings', validateRequest, async (req, res) => {
  try {
    const { text, model } = req.body;
    
    logger.info(`Generating embeddings for text of length: ${text.length}`);

    const result = await aiService.generateEmbeddings({
      text,
      model: model || 'text-embedding-ada-002'
    });

    logger.info('Embeddings generated successfully');

    res.status(200).json({
      success: true,
      result: {
        embeddings: result.embeddings,
        model: result.model,
        usage: result.usage
      }
    });

  } catch (error) {
    logger.error('Error generating embeddings:', error);
    res.status(500).json({
      error: 'Failed to generate embeddings',
      message: error.message
    });
  }
});

// Summarize text
app.post('/summarize', validateRequest, async (req, res) => {
  try {
    const { text, maxLength, style } = req.body;
    
    logger.info(`Summarizing text of length: ${text.length}`);

    const result = await aiService.summarizeText({
      text,
      maxLength: maxLength || 150,
      style: style || 'concise'
    });

    logger.info('Text summarized successfully');

    res.status(200).json({
      success: true,
      result: {
        summary: result.summary,
        originalLength: result.originalLength,
        summaryLength: result.summaryLength,
        compressionRatio: result.compressionRatio
      }
    });

  } catch (error) {
    logger.error('Error summarizing text:', error);
    res.status(500).json({
      error: 'Failed to summarize text',
      message: error.message
    });
  }
});

// Answer questions about text
app.post('/qa', validateRequest, async (req, res) => {
  try {
    const { text, question, context } = req.body;
    
    logger.info(`Answering question: ${question.substring(0, 100)}...`);

    const result = await aiService.answerQuestion({
      text,
      question,
      context
    });

    logger.info('Question answered successfully');

    res.status(200).json({
      success: true,
      result: {
        answer: result.answer,
        confidence: result.confidence,
        sources: result.sources,
        reasoning: result.reasoning
      }
    });

  } catch (error) {
    logger.error('Error answering question:', error);
    res.status(500).json({
      error: 'Failed to answer question',
      message: error.message
    });
  }
});

// Extract key insights
app.post('/insights', validateRequest, async (req, res) => {
  try {
    const { text, type } = req.body;
    
    logger.info(`Extracting insights of type: ${type}`);

    const result = await aiService.extractInsights({
      text,
      type: type || 'general'
    });

    logger.info('Insights extracted successfully');

    res.status(200).json({
      success: true,
      result: {
        insights: result.insights,
        categories: result.categories,
        keyPoints: result.keyPoints
      }
    });

  } catch (error) {
    logger.error('Error extracting insights:', error);
    res.status(500).json({
      error: 'Failed to extract insights',
      message: error.message
    });
  }
});

// Get available models
app.get('/models', (req, res) => {
  try {
    const models = aiService.getAvailableModels();
    res.status(200).json({
      success: true,
      models
    });
  } catch (error) {
    logger.error('Error getting models:', error);
    res.status(500).json({
      error: 'Failed to get available models',
      message: error.message
    });
  }
});

// Get usage statistics
app.get('/usage', async (req, res) => {
  try {
    const stats = await aiService.getUsageStats();
    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error getting usage stats:', error);
    res.status(500).json({
      error: 'Failed to get usage statistics',
      message: error.message
    });
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
  logger.info(`AI Integration Service running on port ${PORT}`);
});

module.exports = app;


