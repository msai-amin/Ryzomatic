const sharp = require('sharp');
const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');

const logger = require('../utils/logger');

class CDNService {
  constructor() {
    this.cacheDir = process.env.CACHE_DIR || './cache';
    this.maxCacheSize = parseInt(process.env.MAX_CACHE_SIZE) || 1024 * 1024 * 1024; // 1GB
  }

  async resizeImage(imagePath, options = {}) {
    try {
      const { width, height, quality = 80, format = 'jpeg' } = options;

      // Generate cache key
      const cacheKey = this.generateCacheKey(imagePath, options);
      const cachePath = path.join(this.cacheDir, 'images', `${cacheKey}.${format}`);

      // Check if cached version exists
      if (await fs.pathExists(cachePath)) {
        return await fs.readFile(cachePath);
      }

      // Ensure cache directory exists
      await fs.ensureDir(path.dirname(cachePath));

      // Resize image
      let sharpInstance = sharp(imagePath);

      if (width || height) {
        sharpInstance = sharpInstance.resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Apply format-specific options
      if (format === 'jpeg') {
        sharpInstance = sharpInstance.jpeg({ quality });
      } else if (format === 'png') {
        sharpInstance = sharpInstance.png({ quality });
      } else if (format === 'webp') {
        sharpInstance = sharpInstance.webp({ quality });
      }

      const resizedBuffer = await sharpInstance.toBuffer();

      // Cache the result
      await fs.writeFile(cachePath, resizedBuffer);

      logger.info(`Image resized and cached: ${cacheKey}`);
      return resizedBuffer;

    } catch (error) {
      logger.error('Error resizing image:', error);
      throw error;
    }
  }

  async generateThumbnail(imagePath, size = 150) {
    try {
      const thumbnail = await this.resizeImage(imagePath, {
        width: size,
        height: size,
        quality: 80,
        format: 'jpeg'
      });

      return thumbnail;

    } catch (error) {
      logger.error('Error generating thumbnail:', error);
      throw error;
    }
  }

  async optimizeImage(imagePath, options = {}) {
    try {
      const { quality = 80, format = 'jpeg', maxWidth = 1920 } = options;

      const optimized = await this.resizeImage(imagePath, {
        width: maxWidth,
        quality,
        format
      });

      return optimized;

    } catch (error) {
      logger.error('Error optimizing image:', error);
      throw error;
    }
  }

  async convertImage(imagePath, targetFormat, options = {}) {
    try {
      const { quality = 80 } = options;

      const converted = await this.resizeImage(imagePath, {
        quality,
        format: targetFormat
      });

      return converted;

    } catch (error) {
      logger.error('Error converting image:', error);
      throw error;
    }
  }

  async getImageMetadata(imagePath) {
    try {
      const metadata = await sharp(imagePath).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: metadata.size,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        channels: metadata.channels,
        space: metadata.space
      };

    } catch (error) {
      logger.error('Error getting image metadata:', error);
      throw error;
    }
  }

  async createImageVariants(imagePath, variants) {
    try {
      const results = {};

      for (const [name, options] of Object.entries(variants)) {
        try {
          const variant = await this.resizeImage(imagePath, options);
          results[name] = variant;
        } catch (error) {
          logger.error(`Error creating variant ${name}:`, error);
          results[name] = null;
        }
      }

      return results;

    } catch (error) {
      logger.error('Error creating image variants:', error);
      throw error;
    }
  }

  generateCacheKey(imagePath, options) {
    const optionsString = JSON.stringify(options, Object.keys(options).sort());
    const hash = crypto.createHash('md5').update(imagePath + optionsString).digest('hex');
    return hash;
  }

  async clearCache() {
    try {
      if (await fs.pathExists(this.cacheDir)) {
        await fs.remove(this.cacheDir);
        await fs.ensureDir(this.cacheDir);
      }

      logger.info('Cache cleared successfully');

    } catch (error) {
      logger.error('Error clearing cache:', error);
      throw error;
    }
  }

  async getCacheStats() {
    try {
      if (!await fs.pathExists(this.cacheDir)) {
        return {
          totalSize: 0,
          fileCount: 0,
          directories: []
        };
      }

      const stats = await this.getDirectoryStats(this.cacheDir);
      return stats;

    } catch (error) {
      logger.error('Error getting cache stats:', error);
      throw error;
    }
  }

  async getDirectoryStats(dirPath) {
    try {
      let totalSize = 0;
      let fileCount = 0;
      const directories = [];

      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);

        if (item.isDirectory()) {
          const subStats = await this.getDirectoryStats(itemPath);
          totalSize += subStats.totalSize;
          fileCount += subStats.fileCount;
          directories.push({
            name: item.name,
            path: itemPath,
            ...subStats
          });
        } else {
          const stats = await fs.stat(itemPath);
          totalSize += stats.size;
          fileCount++;
        }
      }

      return {
        totalSize,
        fileCount,
        directories
      };

    } catch (error) {
      logger.error('Error getting directory stats:', error);
      throw error;
    }
  }

  async cleanupCache() {
    try {
      const stats = await this.getCacheStats();

      if (stats.totalSize > this.maxCacheSize) {
        // Remove oldest files first (simplified implementation)
        await this.removeOldestCacheFiles();
      }

      logger.info('Cache cleanup completed');

    } catch (error) {
      logger.error('Error cleaning up cache:', error);
      throw error;
    }
  }

  async removeOldestCacheFiles() {
    try {
      // This is a simplified implementation
      // In production, you'd want to track file access times
      const cacheDir = path.join(this.cacheDir, 'images');
      
      if (await fs.pathExists(cacheDir)) {
        const files = await fs.readdir(cacheDir);
        const filesWithStats = await Promise.all(
          files.map(async (file) => {
            const filePath = path.join(cacheDir, file);
            const stats = await fs.stat(filePath);
            return { file, path: filePath, mtime: stats.mtime };
          })
        );

        // Sort by modification time (oldest first)
        filesWithStats.sort((a, b) => a.mtime - b.mtime);

        // Remove oldest 25% of files
        const filesToRemove = filesWithStats.slice(0, Math.ceil(filesWithStats.length * 0.25));
        
        for (const file of filesToRemove) {
          await fs.remove(file.path);
        }

        logger.info(`Removed ${filesToRemove.length} old cache files`);
      }

    } catch (error) {
      logger.error('Error removing oldest cache files:', error);
      throw error;
    }
  }
}

module.exports = CDNService;
