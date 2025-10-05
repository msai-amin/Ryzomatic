const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
require('dotenv').config();

const vectorService = require('./services/vectorService');
const { validateRequest } = require('./validators/requestValidator');
const { logger } = require('./utils/logger');
const { connectDB } = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3005;

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
app.get('/health', async (req, res) => {
  try {
    const isHealthy = await vectorService.healthCheck();
    res.status(200).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'vector-database',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      collections: await vectorService.getCollectionStats()
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      service: 'vector-database',
      error: error.message
    });
  }
});

// Create collection
app.post('/collections', validateRequest, async (req, res) => {
  try {
    const { name, metadata } = req.body;
    
    logger.info(`Creating collection: ${name}`);

    const result = await vectorService.createCollection(name, metadata);

    logger.info(`Collection created successfully: ${name}`);

    res.status(201).json({
      success: true,
      collection: result
    });

  } catch (error) {
    logger.error('Error creating collection:', error);
    res.status(500).json({
      error: 'Failed to create collection',
      message: error.message
    });
  }
});

// Add documents to collection
app.post('/collections/:collectionName/documents', validateRequest, async (req, res) => {
  try {
    const { collectionName } = req.params;
    const { documents, embeddings } = req.body;
    
    logger.info(`Adding ${documents.length} documents to collection: ${collectionName}`);

    const result = await vectorService.addDocuments(collectionName, documents, embeddings);

    logger.info(`Documents added successfully to collection: ${collectionName}`);

    res.status(201).json({
      success: true,
      result: {
        addedCount: result.addedCount,
        documentIds: result.documentIds
      }
    });

  } catch (error) {
    logger.error('Error adding documents:', error);
    res.status(500).json({
      error: 'Failed to add documents',
      message: error.message
    });
  }
});

// Search documents
app.post('/collections/:collectionName/search', validateRequest, async (req, res) => {
  try {
    const { collectionName } = req.params;
    const { query, queryEmbeddings, limit, filter, includeMetadata } = req.body;
    
    logger.info(`Searching collection: ${collectionName} with query: ${query?.substring(0, 100)}...`);

    const result = await vectorService.searchDocuments(collectionName, {
      query,
      queryEmbeddings,
      limit: limit || 10,
      filter,
      includeMetadata: includeMetadata !== false
    });

    logger.info(`Search completed for collection: ${collectionName}`);

    res.status(200).json({
      success: true,
      result: {
        documents: result.documents,
        distances: result.distances,
        totalResults: result.totalResults
      }
    });

  } catch (error) {
    logger.error('Error searching documents:', error);
    res.status(500).json({
      error: 'Failed to search documents',
      message: error.message
    });
  }
});

// Get document by ID
app.get('/collections/:collectionName/documents/:documentId', async (req, res) => {
  try {
    const { collectionName, documentId } = req.params;
    
    logger.info(`Getting document: ${documentId} from collection: ${collectionName}`);

    const document = await vectorService.getDocument(collectionName, documentId);

    if (!document) {
      return res.status(404).json({
        error: 'Document not found'
      });
    }

    res.status(200).json({
      success: true,
      document
    });

  } catch (error) {
    logger.error('Error getting document:', error);
    res.status(500).json({
      error: 'Failed to get document',
      message: error.message
    });
  }
});

// Update document
app.put('/collections/:collectionName/documents/:documentId', validateRequest, async (req, res) => {
  try {
    const { collectionName, documentId } = req.params;
    const { document, embeddings, metadata } = req.body;
    
    logger.info(`Updating document: ${documentId} in collection: ${collectionName}`);

    const result = await vectorService.updateDocument(collectionName, documentId, {
      document,
      embeddings,
      metadata
    });

    if (!result) {
      return res.status(404).json({
        error: 'Document not found'
      });
    }

    logger.info(`Document updated successfully: ${documentId}`);

    res.status(200).json({
      success: true,
      document: result
    });

  } catch (error) {
    logger.error('Error updating document:', error);
    res.status(500).json({
      error: 'Failed to update document',
      message: error.message
    });
  }
});

// Delete document
app.delete('/collections/:collectionName/documents/:documentId', async (req, res) => {
  try {
    const { collectionName, documentId } = req.params;
    
    logger.info(`Deleting document: ${documentId} from collection: ${collectionName}`);

    const result = await vectorService.deleteDocument(collectionName, documentId);

    if (!result) {
      return res.status(404).json({
        error: 'Document not found'
      });
    }

    logger.info(`Document deleted successfully: ${documentId}`);

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting document:', error);
    res.status(500).json({
      error: 'Failed to delete document',
      message: error.message
    });
  }
});

// Get collection info
app.get('/collections/:collectionName', async (req, res) => {
  try {
    const { collectionName } = req.params;
    
    logger.info(`Getting collection info: ${collectionName}`);

    const collection = await vectorService.getCollection(collectionName);

    if (!collection) {
      return res.status(404).json({
        error: 'Collection not found'
      });
    }

    res.status(200).json({
      success: true,
      collection
    });

  } catch (error) {
    logger.error('Error getting collection:', error);
    res.status(500).json({
      error: 'Failed to get collection',
      message: error.message
    });
  }
});

// List collections
app.get('/collections', async (req, res) => {
  try {
    logger.info('Listing all collections');

    const collections = await vectorService.listCollections();

    res.status(200).json({
      success: true,
      collections
    });

  } catch (error) {
    logger.error('Error listing collections:', error);
    res.status(500).json({
      error: 'Failed to list collections',
      message: error.message
    });
  }
});

// Delete collection
app.delete('/collections/:collectionName', async (req, res) => {
  try {
    const { collectionName } = req.params;
    
    logger.info(`Deleting collection: ${collectionName}`);

    const result = await vectorService.deleteCollection(collectionName);

    if (!result) {
      return res.status(404).json({
        error: 'Collection not found'
      });
    }

    logger.info(`Collection deleted successfully: ${collectionName}`);

    res.status(200).json({
      success: true,
      message: 'Collection deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting collection:', error);
    res.status(500).json({
      error: 'Failed to delete collection',
      message: error.message
    });
  }
});

// Get collection statistics
app.get('/collections/:collectionName/stats', async (req, res) => {
  try {
    const { collectionName } = req.params;
    
    logger.info(`Getting collection stats: ${collectionName}`);

    const stats = await vectorService.getCollectionStats(collectionName);

    if (!stats) {
      return res.status(404).json({
        error: 'Collection not found'
      });
    }

    res.status(200).json({
      success: true,
      stats
    });

  } catch (error) {
    logger.error('Error getting collection stats:', error);
    res.status(500).json({
      error: 'Failed to get collection statistics',
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
  logger.info(`Vector Database Service running on port ${PORT}`);
});

module.exports = app;


