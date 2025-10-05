const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const mime = require('mime-types');

const File = require('../models/File');
const Folder = require('../models/Folder');
const logger = require('../utils/logger');

class FileService {
  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024; // 100MB
    this.allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'pdf,docx,txt,md,jpg,jpeg,png,gif').split(',');
  }

  getUploadDir() {
    return this.uploadDir;
  }

  async uploadFile(file, options = {}) {
    try {
      const { userId, metadata = {}, folder = 'default' } = options;

      // Validate file
      await this.validateFile(file);

      // Generate unique file ID
      const fileId = uuidv4();

      // Create file path
      const filePath = path.join(folder, `${fileId}${path.extname(file.originalname)}`);
      const fullPath = path.join(this.uploadDir, filePath);

      // Ensure directory exists
      await fs.ensureDir(path.dirname(fullPath));

      // Move file to final location
      await fs.move(file.path, fullPath);

      // Generate file hash
      const fileBuffer = await fs.readFile(fullPath);
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Get file metadata
      const stats = await fs.stat(fullPath);
      const mimeType = mime.lookup(file.originalname) || 'application/octet-stream';

      // Create file record
      const fileRecord = new File({
        id: fileId,
        userId,
        originalName: file.originalname,
        fileName: path.basename(fullPath),
        path: filePath,
        mimeType,
        size: stats.size,
        hash,
        folder,
        metadata: {
          ...metadata,
          uploadedAt: new Date(),
          uploadedBy: userId
        },
        status: 'active'
      });

      await fileRecord.save();

      // Generate thumbnails for images
      if (mimeType.startsWith('image/')) {
        await this.generateThumbnails(fileRecord);
      }

      logger.info(`File uploaded successfully: ${fileId}`);
      return fileRecord.toObject();

    } catch (error) {
      logger.error('Error uploading file:', error);
      
      // Clean up file if it exists
      if (file.path && await fs.pathExists(file.path)) {
        await fs.remove(file.path);
      }
      
      throw error;
    }
  }

  async validateFile(file) {
    // Check file size
    if (file.size > this.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${this.maxFileSize} bytes`);
    }

    // Check file type
    const mimeType = mime.lookup(file.originalname);
    if (mimeType && !this.allowedTypes.some(type => mimeType.includes(type))) {
      throw new Error(`File type ${mimeType} is not allowed`);
    }

    // Check if file exists
    if (!await fs.pathExists(file.path)) {
      throw new Error('File not found');
    }
  }

  async generateThumbnails(fileRecord) {
    try {
      const fullPath = path.join(this.uploadDir, fileRecord.path);
      const thumbnailDir = path.join(path.dirname(fullPath), 'thumbnails');
      await fs.ensureDir(thumbnailDir);

      // Generate different thumbnail sizes
      const sizes = [
        { name: 'small', width: 150, height: 150 },
        { name: 'medium', width: 300, height: 300 },
        { name: 'large', width: 600, height: 600 }
      ];

      for (const size of sizes) {
        const thumbnailPath = path.join(thumbnailDir, `${size.name}_${fileRecord.fileName}`);
        
        await sharp(fullPath)
          .resize(size.width, size.height, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 80 })
          .toFile(thumbnailPath);

        // Update file record with thumbnail paths
        if (!fileRecord.metadata.thumbnails) {
          fileRecord.metadata.thumbnails = {};
        }
        fileRecord.metadata.thumbnails[size.name] = path.relative(this.uploadDir, thumbnailPath);
      }

      await fileRecord.save();
      logger.info(`Generated thumbnails for file: ${fileRecord.id}`);

    } catch (error) {
      logger.error('Error generating thumbnails:', error);
      // Don't throw error, thumbnails are optional
    }
  }

  async getFile(fileId, userId) {
    try {
      const file = await File.findOne({ id: fileId, userId });
      return file ? file.toObject() : null;
    } catch (error) {
      logger.error('Error getting file:', error);
      throw error;
    }
  }

  async getUserFiles(userId, options = {}) {
    try {
      const { page = 1, limit = 20, folder, type, search } = options;
      const skip = (page - 1) * limit;

      // Build query
      const query = { userId, status: 'active' };

      if (folder) {
        query.folder = folder;
      }

      if (type) {
        query.mimeType = { $regex: type, $options: 'i' };
      }

      if (search) {
        query.$or = [
          { originalName: { $regex: search, $options: 'i' } },
          { 'metadata.tags': { $regex: search, $options: 'i' } }
        ];
      }

      const files = await File.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await File.countDocuments(query);

      return {
        files: files.map(file => file.toObject()),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      logger.error('Error getting user files:', error);
      throw error;
    }
  }

  async updateFile(fileId, userId, updates) {
    try {
      const allowedUpdates = ['originalName', 'metadata', 'folder'];
      const filteredUpdates = {};

      Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });

      filteredUpdates.updatedAt = new Date();

      const file = await File.findOneAndUpdate(
        { id: fileId, userId },
        filteredUpdates,
        { new: true, runValidators: true }
      );

      return file ? file.toObject() : null;

    } catch (error) {
      logger.error('Error updating file:', error);
      throw error;
    }
  }

  async deleteFile(fileId, userId) {
    try {
      const file = await File.findOne({ id: fileId, userId });

      if (!file) {
        return false;
      }

      // Delete physical file
      const fullPath = path.join(this.uploadDir, file.path);
      if (await fs.pathExists(fullPath)) {
        await fs.remove(fullPath);
      }

      // Delete thumbnails
      if (file.metadata.thumbnails) {
        for (const thumbnailPath of Object.values(file.metadata.thumbnails)) {
          const fullThumbnailPath = path.join(this.uploadDir, thumbnailPath);
          if (await fs.pathExists(fullThumbnailPath)) {
            await fs.remove(fullThumbnailPath);
          }
        }
      }

      // Delete file record
      await File.deleteOne({ id: fileId, userId });

      logger.info(`File deleted: ${fileId}`);
      return true;

    } catch (error) {
      logger.error('Error deleting file:', error);
      throw error;
    }
  }

  async createFolder(name, userId, parentFolder = null) {
    try {
      const folder = new Folder({
        name,
        userId,
        parentFolder,
        path: parentFolder ? `${parentFolder}/${name}` : name
      });

      await folder.save();

      // Create physical directory
      const folderPath = path.join(this.uploadDir, folder.path);
      await fs.ensureDir(folderPath);

      logger.info(`Folder created: ${folder.id}`);
      return folder.toObject();

    } catch (error) {
      logger.error('Error creating folder:', error);
      throw error;
    }
  }

  async getFolders(userId, parentFolder = null) {
    try {
      const query = { userId };
      if (parentFolder) {
        query.parentFolder = parentFolder;
      } else {
        query.parentFolder = { $exists: false };
      }

      const folders = await Folder.find(query).sort({ name: 1 });
      return folders.map(folder => folder.toObject());

    } catch (error) {
      logger.error('Error getting folders:', error);
      throw error;
    }
  }

  async getStorageStats(userId) {
    try {
      const stats = await File.aggregate([
        { $match: { userId, status: 'active' } },
        {
          $group: {
            _id: null,
            totalFiles: { $sum: 1 },
            totalSize: { $sum: '$size' },
            avgFileSize: { $avg: '$size' },
            fileTypes: { $addToSet: '$mimeType' }
          }
        }
      ]);

      const folderStats = await Folder.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            totalFolders: { $sum: 1 }
          }
        }
      ]);

      const result = stats[0] || {
        totalFiles: 0,
        totalSize: 0,
        avgFileSize: 0,
        fileTypes: []
      };

      result.totalFolders = folderStats[0]?.totalFolders || 0;

      return result;

    } catch (error) {
      logger.error('Error getting storage stats:', error);
      throw error;
    }
  }

  async searchFiles(userId, query, options = {}) {
    try {
      const { page = 1, limit = 20, folder, type } = options;
      const skip = (page - 1) * limit;

      const searchQuery = {
        userId,
        status: 'active',
        $or: [
          { originalName: { $regex: query, $options: 'i' } },
          { 'metadata.tags': { $regex: query, $options: 'i' } },
          { 'metadata.description': { $regex: query, $options: 'i' } }
        ]
      };

      if (folder) {
        searchQuery.folder = folder;
      }

      if (type) {
        searchQuery.mimeType = { $regex: type, $options: 'i' };
      }

      const files = await File.find(searchQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await File.countDocuments(searchQuery);

      return {
        files: files.map(file => file.toObject()),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      logger.error('Error searching files:', error);
      throw error;
    }
  }
}

module.exports = FileService;
