const { ChromaClient } = require('chromadb');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const VectorDocument = require('../models/VectorDocument');

class VectorService {
  constructor() {
    this.client = new ChromaClient({
      path: `http://${process.env.CHROMA_HOST || 'localhost'}:${process.env.CHROMA_PORT || 8000}`
    });
    this.collections = new Map();
  }

  async initialize() {
    try {
      // Test connection
      await this.client.heartbeat();
      logger.info('Connected to ChromaDB');
      
      // Load existing collections
      const collections = await this.client.listCollections();
      for (const collection of collections) {
        this.collections.set(collection.name, collection);
      }
      
      logger.info(`Loaded ${collections.length} existing collections`);
    } catch (error) {
      logger.error('Failed to initialize ChromaDB:', error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      await this.client.heartbeat();
      return true;
    } catch (error) {
      logger.error('ChromaDB health check failed:', error);
      return false;
    }
  }

  async createCollection(name, metadata = {}) {
    try {
      if (this.collections.has(name)) {
        throw new Error(`Collection '${name}' already exists`);
      }

      const collection = await this.client.createCollection({
        name,
        metadata
      });

      this.collections.set(name, collection);
      
      // Create MongoDB record
      const vectorDoc = new VectorDocument({
        collectionName: name,
        metadata,
        documentCount: 0,
        createdAt: new Date()
      });
      await vectorDoc.save();

      logger.info(`Collection '${name}' created successfully`);
      return {
        name: collection.name,
        id: collection.id,
        metadata: collection.metadata
      };
    } catch (error) {
      logger.error(`Error creating collection '${name}':`, error);
      throw error;
    }
  }

  async addDocuments(collectionName, documents, embeddings) {
    try {
      const collection = this.collections.get(collectionName);
      if (!collection) {
        throw new Error(`Collection '${collectionName}' not found`);
      }

      // Generate IDs for documents if not provided
      const documentIds = documents.map((doc, index) => doc.id || uuidv4());
      
      // Prepare documents for ChromaDB
      const chromaDocuments = documents.map((doc, index) => ({
        id: documentIds[index],
        document: doc.text || doc.content || doc,
        metadata: doc.metadata || {}
      }));

      // Add to ChromaDB
      await collection.add({
        ids: documentIds,
        documents: chromaDocuments.map(doc => doc.document),
        embeddings: embeddings,
        metadatas: chromaDocuments.map(doc => doc.metadata)
      });

      // Update MongoDB record
      await VectorDocument.findOneAndUpdate(
        { collectionName },
        { 
          $inc: { documentCount: documents.length },
          $set: { updatedAt: new Date() }
        }
      );

      logger.info(`Added ${documents.length} documents to collection '${collectionName}'`);
      return {
        addedCount: documents.length,
        documentIds
      };
    } catch (error) {
      logger.error(`Error adding documents to collection '${collectionName}':`, error);
      throw error;
    }
  }

  async searchDocuments(collectionName, options = {}) {
    try {
      const collection = this.collections.get(collectionName);
      if (!collection) {
        throw new Error(`Collection '${collectionName}' not found`);
      }

      const {
        query,
        queryEmbeddings,
        limit = 10,
        filter,
        includeMetadata = true
      } = options;

      let searchOptions = {
        nResults: limit,
        include: ['documents', 'distances', 'metadatas']
      };

      if (filter) {
        searchOptions.where = filter;
      }

      let results;
      if (queryEmbeddings) {
        // Search by embeddings
        results = await collection.query({
          queryEmbeddings: [queryEmbeddings],
          ...searchOptions
        });
      } else if (query) {
        // Search by text (ChromaDB will generate embeddings)
        results = await collection.query({
          queryTexts: [query],
          ...searchOptions
        });
      } else {
        throw new Error('Either query or queryEmbeddings must be provided');
      }

      const documents = results.documents[0] || [];
      const distances = results.distances[0] || [];
      const metadatas = results.metadatas[0] || [];

      const formattedResults = documents.map((doc, index) => ({
        id: results.ids[0][index],
        document: doc,
        distance: distances[index],
        metadata: includeMetadata ? metadatas[index] : undefined
      }));

      return {
        documents: formattedResults,
        distances,
        totalResults: documents.length
      };
    } catch (error) {
      logger.error(`Error searching collection '${collectionName}':`, error);
      throw error;
    }
  }

  async getDocument(collectionName, documentId) {
    try {
      const collection = this.collections.get(collectionName);
      if (!collection) {
        throw new Error(`Collection '${collectionName}' not found`);
      }

      const results = await collection.get({
        ids: [documentId],
        include: ['documents', 'metadatas']
      });

      if (!results.ids[0] || results.ids[0].length === 0) {
        return null;
      }

      return {
        id: results.ids[0][0],
        document: results.documents[0][0],
        metadata: results.metadatas[0][0]
      };
    } catch (error) {
      logger.error(`Error getting document '${documentId}' from collection '${collectionName}':`, error);
      throw error;
    }
  }

  async updateDocument(collectionName, documentId, updateData) {
    try {
      const collection = this.collections.get(collectionName);
      if (!collection) {
        throw new Error(`Collection '${collectionName}' not found`);
      }

      const { document, embeddings, metadata } = updateData;

      // Check if document exists
      const existingDoc = await this.getDocument(collectionName, documentId);
      if (!existingDoc) {
        return null;
      }

      // Update in ChromaDB
      await collection.update({
        ids: [documentId],
        documents: document ? [document] : undefined,
        embeddings: embeddings ? [embeddings] : undefined,
        metadatas: metadata ? [metadata] : undefined
      });

      logger.info(`Document '${documentId}' updated in collection '${collectionName}'`);
      return {
        id: documentId,
        document: document || existingDoc.document,
        metadata: metadata || existingDoc.metadata
      };
    } catch (error) {
      logger.error(`Error updating document '${documentId}' in collection '${collectionName}':`, error);
      throw error;
    }
  }

  async deleteDocument(collectionName, documentId) {
    try {
      const collection = this.collections.get(collectionName);
      if (!collection) {
        throw new Error(`Collection '${collectionName}' not found`);
      }

      // Check if document exists
      const existingDoc = await this.getDocument(collectionName, documentId);
      if (!existingDoc) {
        return null;
      }

      // Delete from ChromaDB
      await collection.delete({
        ids: [documentId]
      });

      // Update MongoDB record
      await VectorDocument.findOneAndUpdate(
        { collectionName },
        { 
          $inc: { documentCount: -1 },
          $set: { updatedAt: new Date() }
        }
      );

      logger.info(`Document '${documentId}' deleted from collection '${collectionName}'`);
      return true;
    } catch (error) {
      logger.error(`Error deleting document '${documentId}' from collection '${collectionName}':`, error);
      throw error;
    }
  }

  async getCollection(collectionName) {
    try {
      const collection = this.collections.get(collectionName);
      if (!collection) {
        return null;
      }

      const stats = await this.getCollectionStats(collectionName);
      
      return {
        name: collection.name,
        id: collection.id,
        metadata: collection.metadata,
        ...stats
      };
    } catch (error) {
      logger.error(`Error getting collection '${collectionName}':`, error);
      throw error;
    }
  }

  async listCollections() {
    try {
      const collections = Array.from(this.collections.values()).map(collection => ({
        name: collection.name,
        id: collection.id,
        metadata: collection.metadata
      }));

      return collections;
    } catch (error) {
      logger.error('Error listing collections:', error);
      throw error;
    }
  }

  async deleteCollection(collectionName) {
    try {
      const collection = this.collections.get(collectionName);
      if (!collection) {
        return null;
      }

      // Delete from ChromaDB
      await this.client.deleteCollection({ name: collectionName });
      
      // Remove from local cache
      this.collections.delete(collectionName);

      // Delete MongoDB record
      await VectorDocument.findOneAndDelete({ collectionName });

      logger.info(`Collection '${collectionName}' deleted successfully`);
      return true;
    } catch (error) {
      logger.error(`Error deleting collection '${collectionName}':`, error);
      throw error;
    }
  }

  async getCollectionStats(collectionName) {
    try {
      if (collectionName) {
        const collection = this.collections.get(collectionName);
        if (!collection) {
          return null;
        }

        const vectorDoc = await VectorDocument.findOne({ collectionName });
        const count = await collection.count();

        return {
          documentCount: count,
          metadata: collection.metadata,
          createdAt: vectorDoc?.createdAt,
          updatedAt: vectorDoc?.updatedAt
        };
      } else {
        // Get stats for all collections
        const collections = await VectorDocument.find();
        const totalDocuments = collections.reduce((sum, col) => sum + col.documentCount, 0);

        return {
          totalCollections: collections.length,
          totalDocuments,
          collections: collections.map(col => ({
            name: col.collectionName,
            documentCount: col.documentCount,
            createdAt: col.createdAt
          }))
        };
      }
    } catch (error) {
      logger.error(`Error getting collection stats for '${collectionName}':`, error);
      throw error;
    }
  }
}

// Initialize the service
const vectorService = new VectorService();
vectorService.initialize().catch(error => {
  logger.error('Failed to initialize vector service:', error);
});

module.exports = vectorService;


