const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  documentId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing'
  },
  extractedText: {
    type: String,
    default: ''
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  summary: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  processingTime: {
    type: Number,
    default: 0
  },
  error: {
    type: String,
    default: null
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for better query performance
documentSchema.index({ status: 1, uploadedAt: -1 });
documentSchema.index({ originalName: 'text' });
documentSchema.index({ mimeType: 1 });

// Virtual for file extension
documentSchema.virtual('fileExtension').get(function() {
  return this.originalName.split('.').pop().toLowerCase();
});

// Method to get document stats
documentSchema.methods.getStats = function() {
  return {
    documentId: this.documentId,
    originalName: this.originalName,
    fileExtension: this.fileExtension,
    size: this.size,
    status: this.status,
    processingTime: this.processingTime,
    uploadedAt: this.uploadedAt,
    completedAt: this.completedAt,
    hasText: !!this.extractedText,
    textLength: this.extractedText ? this.extractedText.length : 0,
    hasSummary: !!this.summary && Object.keys(this.summary).length > 0
  };
};

// Static method to get processing statistics
documentSchema.statics.getProcessingStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgProcessingTime: { $avg: '$processingTime' }
      }
    }
  ]);

  const total = await this.countDocuments();
  const totalSize = await this.aggregate([
    { $group: { _id: null, totalSize: { $sum: '$size' } } }
  ]);

  return {
    total,
    totalSize: totalSize[0]?.totalSize || 0,
    byStatus: stats.reduce((acc, stat) => {
      acc[stat._id] = {
        count: stat.count,
        avgProcessingTime: stat.avgProcessingTime
      };
      return acc;
    }, {})
  };
};

module.exports = mongoose.model('Document', documentSchema);