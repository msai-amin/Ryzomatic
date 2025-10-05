const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const { logger } = require('../utils/logger');
const Document = require('../models/Document');

class DocumentProcessor {
  constructor() {
    this.supportedTypes = {
      'application/pdf': this.processPDF.bind(this),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': this.processDOCX.bind(this),
      'text/plain': this.processTXT.bind(this),
      'text/markdown': this.processMarkdown.bind(this)
    };
  }

  async processDocument(file) {
    const startTime = Date.now();
    const documentId = uuidv4();
    
    try {
      logger.info(`Starting document processing for: ${file.originalname}`);

      // Create document record
      const document = new Document({
        documentId,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        status: 'processing',
        uploadedAt: new Date()
      });

      await document.save();

      // Process based on file type
      const processor = this.supportedTypes[file.mimetype];
      if (!processor) {
        throw new Error(`Unsupported file type: ${file.mimetype}`);
      }

      const result = await processor(file.path);
      
      // Update document with results
      document.status = 'completed';
      document.extractedText = result.text;
      document.metadata = result.metadata;
      document.summary = result.summary;
      document.processingTime = Date.now() - startTime;
      document.completedAt = new Date();

      await document.save();

      logger.info(`Document processing completed: ${documentId}`);

      return {
        documentId,
        metadata: result.metadata,
        extractedText: result.text,
        summary: result.summary,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error(`Error processing document ${documentId}:`, error);
      
      // Update document status to failed
      try {
        await Document.findOneAndUpdate(
          { documentId },
          { 
            status: 'failed',
            error: error.message,
            completedAt: new Date()
          }
        );
      } catch (updateError) {
        logger.error('Error updating document status:', updateError);
      }

      throw error;
    }
  }

  async processPDF(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer);
      
      const metadata = {
        pages: pdfData.numpages,
        info: pdfData.info,
        version: pdfData.version,
        textLength: pdfData.text.length
      };

      // Generate summary (basic implementation)
      const summary = this.generateSummary(pdfData.text);

      return {
        text: pdfData.text,
        metadata,
        summary
      };
    } catch (error) {
      logger.error('Error processing PDF:', error);
      throw new Error(`Failed to process PDF: ${error.message}`);
    }
  }

  async processDOCX(filePath) {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      
      const metadata = {
        textLength: result.value.length,
        messages: result.messages
      };

      const summary = this.generateSummary(result.value);

      return {
        text: result.value,
        metadata,
        summary
      };
    } catch (error) {
      logger.error('Error processing DOCX:', error);
      throw new Error(`Failed to process DOCX: ${error.message}`);
    }
  }

  async processTXT(filePath) {
    try {
      const text = await fs.readFile(filePath, 'utf8');
      
      const metadata = {
        textLength: text.length,
        encoding: 'utf8'
      };

      const summary = this.generateSummary(text);

      return {
        text,
        metadata,
        summary
      };
    } catch (error) {
      logger.error('Error processing TXT:', error);
      throw new Error(`Failed to process TXT: ${error.message}`);
    }
  }

  async processMarkdown(filePath) {
    try {
      const text = await fs.readFile(filePath, 'utf8');
      
      const metadata = {
        textLength: text.length,
        encoding: 'utf8',
        type: 'markdown'
      };

      const summary = this.generateSummary(text);

      return {
        text,
        metadata,
        summary
      };
    } catch (error) {
      logger.error('Error processing Markdown:', error);
      throw new Error(`Failed to process Markdown: ${error.message}`);
    }
  }

  async processImageWithOCR(filePath) {
    try {
      logger.info('Processing image with OCR...');
      
      const { data: { text } } = await Tesseract.recognize(filePath, 'eng', {
        logger: m => logger.debug('OCR Progress:', m)
      });

      const metadata = {
        textLength: text.length,
        type: 'ocr',
        confidence: 'medium' // Tesseract doesn't provide confidence in this version
      };

      const summary = this.generateSummary(text);

      return {
        text,
        metadata,
        summary
      };
    } catch (error) {
      logger.error('Error processing image with OCR:', error);
      throw new Error(`Failed to process image with OCR: ${error.message}`);
    }
  }

  generateSummary(text) {
    // Basic summary generation - in a real implementation, this would use AI
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    
    // Take first 3 sentences as summary
    const summary = sentences.slice(0, 3).join('. ').trim();
    
    return {
      text: summary,
      wordCount: words.length,
      sentenceCount: sentences.length,
      readingTime: Math.ceil(words.length / 200) // Assuming 200 words per minute
    };
  }

  async getDocumentStatus(documentId) {
    try {
      const document = await Document.findOne({ documentId });
      return document;
    } catch (error) {
      logger.error('Error getting document status:', error);
      throw error;
    }
  }

  async getDocuments(options = {}) {
    try {
      const { page = 1, limit = 10, status } = options;
      const query = status ? { status } : {};
      
      const documents = await Document.find(query)
        .sort({ uploadedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-extractedText'); // Exclude full text for performance

      const total = await Document.countDocuments(query);

      return {
        documents,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting documents:', error);
      throw error;
    }
  }

  async deleteDocument(documentId) {
    try {
      const result = await Document.findOneAndDelete({ documentId });
      return result;
    } catch (error) {
      logger.error('Error deleting document:', error);
      throw error;
    }
  }
}

module.exports = new DocumentProcessor();