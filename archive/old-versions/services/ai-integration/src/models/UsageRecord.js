const mongoose = require('mongoose');

const usageRecordSchema = new mongoose.Schema({
  provider: {
    type: String,
    required: true,
    enum: ['openai', 'anthropic']
  },
  model: {
    type: String,
    required: true
  },
  operation: {
    type: String,
    required: true,
    enum: ['completion', 'embeddings', 'summarization', 'qa', 'insights']
  },
  tokens: {
    type: Number,
    required: true,
    min: 0
  },
  processingTime: {
    type: Number,
    required: true,
    min: 0
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
usageRecordSchema.index({ provider: 1, timestamp: -1 });
usageRecordSchema.index({ operation: 1, timestamp: -1 });
usageRecordSchema.index({ timestamp: -1 });

// Static method to get usage by date range
usageRecordSchema.statics.getUsageByDateRange = async function(startDate, endDate) {
  return this.find({
    timestamp: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ timestamp: -1 });
};

// Static method to get usage by provider
usageRecordSchema.statics.getUsageByProvider = async function(provider) {
  return this.find({ provider }).sort({ timestamp: -1 });
};

// Static method to get total cost estimation (simplified)
usageRecordSchema.statics.getCostEstimation = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$provider',
        totalTokens: { $sum: '$tokens' },
        totalRequests: { $sum: 1 }
      }
    }
  ]);

  // Simplified cost calculation (these would be actual API costs)
  const costPerToken = {
    openai: 0.0001, // Example rate
    anthropic: 0.00015 // Example rate
  };

  return stats.map(stat => ({
    provider: stat._id,
    totalTokens: stat.totalTokens,
    totalRequests: stat.totalRequests,
    estimatedCost: stat.totalTokens * (costPerToken[stat._id] || 0)
  }));
};

module.exports = mongoose.model('UsageRecord', usageRecordSchema);


