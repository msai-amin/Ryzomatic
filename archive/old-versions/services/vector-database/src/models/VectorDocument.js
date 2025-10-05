const mongoose = require('mongoose');

const vectorDocumentSchema = new mongoose.Schema({
  collectionName: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  documentCount: {
    type: Number,
    default: 0,
    min: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
vectorDocumentSchema.index({ collectionName: 1 });
vectorDocumentSchema.index({ createdAt: -1 });
vectorDocumentSchema.index({ documentCount: -1 });

// Update the updatedAt field before saving
vectorDocumentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get collection statistics
vectorDocumentSchema.statics.getCollectionStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalCollections: { $sum: 1 },
        totalDocuments: { $sum: '$documentCount' },
        avgDocumentsPerCollection: { $avg: '$documentCount' }
      }
    }
  ]);

  return stats[0] || {
    totalCollections: 0,
    totalDocuments: 0,
    avgDocumentsPerCollection: 0
  };
};

// Static method to get collections by size range
vectorDocumentSchema.statics.getCollectionsBySize = async function(minSize = 0, maxSize = null) {
  const query = { documentCount: { $gte: minSize } };
  if (maxSize !== null) {
    query.documentCount.$lte = maxSize;
  }

  return this.find(query).sort({ documentCount: -1 });
};

// Static method to get recent collections
vectorDocumentSchema.statics.getRecentCollections = async function(limit = 10) {
  return this.find().sort({ createdAt: -1 }).limit(limit);
};

module.exports = mongoose.model('VectorDocument', vectorDocumentSchema);


