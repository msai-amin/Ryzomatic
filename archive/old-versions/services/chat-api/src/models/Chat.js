const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true
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
    default: 'sent'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const chatSchema = new mongoose.Schema({
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
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  messages: [messageSchema],
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
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  collection: 'chats'
});

// Indexes for better query performance
chatSchema.index({ userId: 1, updatedAt: -1 });
chatSchema.index({ status: 1, updatedAt: -1 });
chatSchema.index({ 'messages.userId': 1 });

// Pre-save middleware to update the updatedAt field
chatSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to get recent messages
chatSchema.methods.getRecentMessages = function(count = 10) {
  return this.messages.slice(-count);
};

// Method to get message count
chatSchema.methods.getMessageCount = function() {
  return this.messages.length;
};

// Method to get last message
chatSchema.methods.getLastMessage = function() {
  return this.messages.length > 0 ? this.messages[this.messages.length - 1] : null;
};

// Method to check if chat is empty
chatSchema.methods.isEmpty = function() {
  return this.messages.length === 0;
};

// Static method to find chats by user
chatSchema.statics.findByUser = function(userId, options = {}) {
  const query = { userId };
  
  if (options.status) {
    query.status = options.status;
  }
  
  return this.find(query).sort({ updatedAt: -1 });
};

// Static method to search chats
chatSchema.statics.searchChats = function(userId, searchQuery) {
  return this.find({
    userId,
    $or: [
      { title: { $regex: searchQuery, $options: 'i' } },
      { 'messages.content': { $regex: searchQuery, $options: 'i' } }
    ]
  }).sort({ updatedAt: -1 });
};

// Static method to get chat statistics
chatSchema.statics.getChatStats = function(userId) {
  return this.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        totalChats: { $sum: 1 },
        activeChats: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        totalMessages: { $sum: { $size: '$messages' } },
        avgMessagesPerChat: { $avg: { $size: '$messages' } }
      }
    }
  ]);
};

module.exports = mongoose.model('Chat', chatSchema);
