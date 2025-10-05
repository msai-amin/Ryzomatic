const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const mime = require('mime-types');

const logger = require('../utils/logger');

class MetadataService {
  constructor() {
    this.supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff'];
    this.supportedDocumentTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  }

  async extractMetadata(filePath, mimeType) {
    try {
      const stats = await fs.stat(filePath);
      const baseMetadata = {
        size: stats.size,
        mtime: stats.mtime,
        ctime: stats.ctime,
        mimeType
      };

      if (this.supportedImageTypes.includes(mimeType)) {
        const imageMetadata = await this.extractImageMetadata(filePath);
        return { ...baseMetadata, ...imageMetadata };
      }

      if (this.supportedDocumentTypes.includes(mimeType)) {
        const documentMetadata = await this.extractDocumentMetadata(filePath, mimeType);
        return { ...baseMetadata, ...documentMetadata };
      }

      return baseMetadata;

    } catch (error) {
      logger.error('Error extracting metadata:', error);
      return { size: 0, mimeType };
    }
  }

  async extractImageMetadata(imagePath) {
    try {
      const metadata = await sharp(imagePath).metadata();
      
      return {
        type: 'image',
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        channels: metadata.channels,
        space: metadata.space,
        orientation: metadata.orientation,
        exif: metadata.exif ? this.parseExif(metadata.exif) : null
      };

    } catch (error) {
      logger.error('Error extracting image metadata:', error);
      return { type: 'image' };
    }
  }

  async extractDocumentMetadata(filePath, mimeType) {
    try {
      // This is a simplified implementation
      // In production, you'd use libraries like pdf-parse, mammoth, etc.
      
      const stats = await fs.stat(filePath);
      
      return {
        type: 'document',
        mimeType,
        size: stats.size,
        // Add more document-specific metadata here
        pages: null, // Would be extracted by document processing service
        title: null,
        author: null,
        created: null,
        modified: null
      };

    } catch (error) {
      logger.error('Error extracting document metadata:', error);
      return { type: 'document', mimeType };
    }
  }

  parseExif(exif) {
    try {
      // This is a simplified EXIF parser
      // In production, you'd use a proper EXIF library
      return {
        // Add EXIF data parsing here
        camera: null,
        lens: null,
        settings: null,
        gps: null
      };

    } catch (error) {
      logger.error('Error parsing EXIF:', error);
      return null;
    }
  }

  async generateFileHash(filePath, algorithm = 'sha256') {
    try {
      const crypto = require('crypto');
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filePath);

      return new Promise((resolve, reject) => {
        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
      });

    } catch (error) {
      logger.error('Error generating file hash:', error);
      throw error;
    }
  }

  async detectFileType(filePath) {
    try {
      const mimeType = mime.lookup(filePath);
      const ext = path.extname(filePath).toLowerCase();

      return {
        mimeType: mimeType || 'application/octet-stream',
        extension: ext,
        category: this.categorizeFileType(mimeType, ext)
      };

    } catch (error) {
      logger.error('Error detecting file type:', error);
      return {
        mimeType: 'application/octet-stream',
        extension: path.extname(filePath).toLowerCase(),
        category: 'unknown'
      };
    }
  }

  categorizeFileType(mimeType, extension) {
    if (mimeType?.startsWith('image/')) return 'image';
    if (mimeType?.startsWith('video/')) return 'video';
    if (mimeType?.startsWith('audio/')) return 'audio';
    if (mimeType?.startsWith('text/')) return 'text';
    if (mimeType?.includes('pdf')) return 'document';
    if (mimeType?.includes('word') || mimeType?.includes('document')) return 'document';
    if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) return 'spreadsheet';
    if (mimeType?.includes('presentation') || mimeType?.includes('powerpoint')) return 'presentation';
    if (mimeType?.includes('archive') || mimeType?.includes('zip')) return 'archive';
    if (mimeType?.includes('code') || this.isCodeFile(extension)) return 'code';
    
    return 'unknown';
  }

  isCodeFile(extension) {
    const codeExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
      '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.sh',
      '.bash', '.ps1', '.sql', '.html', '.css', '.scss', '.sass',
      '.less', '.xml', '.json', '.yaml', '.yml', '.toml', '.ini',
      '.conf', '.config', '.env', '.gitignore', '.dockerfile'
    ];
    
    return codeExtensions.includes(extension);
  }

  async analyzeFileContent(filePath, mimeType) {
    try {
      if (mimeType?.startsWith('text/')) {
        return await this.analyzeTextFile(filePath);
      }

      if (this.supportedImageTypes.includes(mimeType)) {
        return await this.analyzeImageFile(filePath);
      }

      return null;

    } catch (error) {
      logger.error('Error analyzing file content:', error);
      return null;
    }
  }

  async analyzeTextFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      
      return {
        type: 'text',
        lineCount: lines.length,
        wordCount: content.split(/\s+/).length,
        charCount: content.length,
        encoding: 'utf8',
        hasBOM: content.charCodeAt(0) === 0xFEFF
      };

    } catch (error) {
      logger.error('Error analyzing text file:', error);
      return null;
    }
  }

  async analyzeImageFile(imagePath) {
    try {
      const metadata = await sharp(imagePath).metadata();
      
      return {
        type: 'image',
        dimensions: `${metadata.width}x${metadata.height}`,
        aspectRatio: (metadata.width / metadata.height).toFixed(2),
        colorSpace: metadata.space,
        hasAlpha: metadata.hasAlpha,
        isAnimated: false // Would need additional analysis for GIFs
      };

    } catch (error) {
      logger.error('Error analyzing image file:', error);
      return null;
    }
  }

  async generateThumbnailMetadata(filePath, thumbnailPath) {
    try {
      const originalMetadata = await this.extractImageMetadata(filePath);
      const thumbnailMetadata = await this.extractImageMetadata(thumbnailPath);

      return {
        original: originalMetadata,
        thumbnail: thumbnailMetadata,
        ratio: {
          width: thumbnailMetadata.width / originalMetadata.width,
          height: thumbnailMetadata.height / originalMetadata.height
        }
      };

    } catch (error) {
      logger.error('Error generating thumbnail metadata:', error);
      return null;
    }
  }

  async validateFileIntegrity(filePath, expectedHash) {
    try {
      const actualHash = await this.generateFileHash(filePath);
      return actualHash === expectedHash;

    } catch (error) {
      logger.error('Error validating file integrity:', error);
      return false;
    }
  }
}

module.exports = MetadataService;
