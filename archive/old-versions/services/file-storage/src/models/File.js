const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true,
    index: true
  },
  size: {
    type: Number,
    required: true
  },
  hash: {
    type: String,
    required: true,
    index: true
  },
  folder: {
    type: String,
    default: 'default',
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active',
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'files'
});

// Indexes for better query performance
fileSchema.index({ userId: 1, createdAt: -1 });
fileSchema.index({ userId: 1, folder: 1 });
fileSchema.index({ mimeType: 1, createdAt: -1 });
fileSchema.index({ hash: 1 });

// Pre-save middleware to update the updatedAt field
fileSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for file URL
fileSchema.virtual('url').get(function() {
  return `/files/${this.id}`;
});

// Virtual for download URL
fileSchema.virtual('downloadUrl').get(function() {
  return `/files/${this.id}/download`;
});

// Virtual for content URL
fileSchema.virtual('contentUrl').get(function() {
  return `/files/${this.id}/content`;
});

// Method to get file size in human readable format
fileSchema.methods.getHumanReadableSize = function() {
  const bytes = this.size;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  if (bytes === 0) return '0 Bytes';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

// Method to check if file is image
fileSchema.methods.isImage = function() {
  return this.mimeType.startsWith('image/');
};

// Method to check if file is document
fileSchema.methods.isDocument = function() {
  const documentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
  ];
  return documentTypes.includes(this.mimeType);
};

// Method to get thumbnail URL
fileSchema.methods.getThumbnailUrl = function(size = 'small') {
  if (!this.isImage()) return null;
  
  const thumbnails = this.metadata.thumbnails;
  if (!thumbnails || !thumbnails[size]) return null;
  
  return `/files/${this.id}/content?thumbnail=${size}`;
};

// Method to get file extension
fileSchema.methods.getExtension = function() {
  return this.originalName.split('.').pop().toLowerCase();
};

// Method to check if file is active
fileSchema.methods.isActive = function() {
  return this.status === 'active';
};

// Static method to find files by user
fileSchema.statics.findByUser = function(userId, options = {}) {
  const query = { userId, status: 'active' };
  
  if (options.folder) {
    query.folder = options.folder;
  }
  
  if (options.mimeType) {
    query.mimeType = options.mimeType;
  }
  
  if (options.search) {
    query.$or = [
      { originalName: { $regex: options.search, $options: 'i' } },
      { 'metadata.tags': { $regex: options.search, $options: 'i' } }
    ];
  }
  
  return this.find(query).sort({ createdAt: -1 });
};

// Static method to find duplicate files
fileSchema.statics.findDuplicates = function(userId) {
  return this.aggregate([
    { $match: { userId, status: 'active' } },
    {
      $group: {
        _id: '$hash',
        count: { $sum: 1 },
        files: { $push: '$$ROOT' }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]);
};

// Static method to get storage statistics
fileSchema.statics.getStorageStats = function(userId) {
  return this.aggregate([
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
};

// Static method to find files by type
fileSchema.statics.findByType = function(userId, mimeType) {
  return this.find({ userId, mimeType, status: 'active' }).sort({ createdAt: -1 });
};

// Static method to find large files
fileSchema.statics.findLargeFiles = function(userId, minSize = 10 * 1024 * 1024) { // 10MB
  return this.find({ 
    userId, 
    size: { $gte: minSize }, 
    status: 'active' 
  }).sort({ size: -1 });
};

module.exports = mongoose.model('File', fileSchema);
