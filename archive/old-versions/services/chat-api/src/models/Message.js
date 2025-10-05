const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  chatId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 10000
  },
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'failed'],
    default: 'sent',
    index: true
  },
  readAt: {
    type: Date
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
  collection: 'messages'
});

// Indexes for better query performance
messageSchema.index({ chatId: 1, createdAt: 1 });
messageSchema.index({ userId: 1, createdAt: -1 });
messageSchema.index({ status: 1, createdAt: -1 });

// Pre-save middleware to update the updatedAt field
messageSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to mark as read
messageSchema.methods.markAsRead = function() {
  this.status = 'read';
  this.readAt = new Date();
  this.updatedAt = new Date();
  return this.save();
};

// Method to check if message is from AI
messageSchema.methods.isFromAI = function() {
  return this.userId === 'ai' || this.metadata.isAI === true;
};

// Method to check if message is from user
messageSchema.methods.isFromUser = function() {
  return this.userId !== 'ai' && this.metadata.isAI !== true;
};

// Method to get formatted content
messageSchema.methods.getFormattedContent = function() {
  if (this.type === 'text') {
    return this.content;
  } else if (this.type === 'image') {
    return `[Image: ${this.metadata.filename || 'image'}]`;
  } else if (this.type === 'file') {
    return `[File: ${this.metadata.filename || 'file'}]`;
  } else if (this.type === 'system') {
    return `[System: ${this.content}]`;
  }
  return this.content;
};

// Static method to find messages by chat
messageSchema.statics.findByChat = function(chatId, options = {}) {
  const query = { chatId };
  
  if (options.userId) {
    query.userId = options.userId;
  }
  
  if (options.type) {
    query.type = options.type;
  }
  
  if (options.status) {
    query.status = options.status;
  }
  
  return this.find(query).sort({ createdAt: 1 });
};

// Static method to search messages
messageSchema.statics.searchMessages = function(chatIds, searchQuery) {
  return this.find({
    chatId: { $in: chatIds },
    content: { $regex: searchQuery, $options: 'i' }
  }).sort({ createdAt: -1 });
};

// Static method to get message statistics
messageSchema.statics.getMessageStats = function(chatId) {
  return this.aggregate([
    { $match: { chatId } },
    {
      $group: {
        _id: null,
        totalMessages: { $sum: 1 },
        userMessages: {
          $sum: { $cond: [{ $ne: ['$userId', 'ai'] }, 1, 0] }
        },
        aiMessages: {
          $sum: { $cond: [{ $eq: ['$userId', 'ai'] }, 1, 0] }
        },
        avgMessageLength: { $avg: { $strLenCP: '$content' } }
      }
    }
  ]);
};

// Static method to get unread message count
messageSchema.statics.getUnreadCount = function(chatId, userId) {
  return this.countDocuments({
    chatId,
    userId: { $ne: userId },
    status: { $ne: 'read' }
  });
};

module.exports = mongoose.model('Message', messageSchema);
