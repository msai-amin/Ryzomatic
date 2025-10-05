const { v4: uuidv4 } = require('uuid');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const logger = require('../utils/logger');

class MessageService {
  constructor() {
    this.maxMessageLength = 10000; // 10KB max per message
  }

  async createMessage({ chatId, userId, content, type = 'text', metadata = {} }) {
    try {
      // Validate message content
      if (!content || content.trim().length === 0) {
        throw new Error('Message content cannot be empty');
      }

      if (content.length > this.maxMessageLength) {
        throw new Error('Message too long');
      }

      const message = new Message({
        id: uuidv4(),
        chatId,
        userId,
        content: content.trim(),
        type,
        metadata,
        status: 'sent'
      });

      // Save message to database
      await message.save();

      // Add message to chat
      await Chat.findOneAndUpdate(
        { id: chatId },
        {
          $push: { messages: message.toObject() },
          $set: { updatedAt: new Date() }
        }
      );

      logger.info(`Created message ${message.id} in chat ${chatId}`);
      return message.toObject();
    } catch (error) {
      logger.error('Error creating message:', error);
      throw error;
    }
  }

  async getChatMessages(chatId, userId, page = 1, limit = 50) {
    try {
      // Verify user has access to this chat
      const chat = await Chat.findOne({ id: chatId, userId });
      if (!chat) {
        throw new Error('Chat not found or access denied');
      }

      const skip = (page - 1) * limit;
      
      const messages = await Message.find({ chatId })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit);

      const total = await Message.countDocuments({ chatId });

      return {
        messages: messages.map(msg => msg.toObject()),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting chat messages:', error);
      throw error;
    }
  }

  async getMessage(messageId, userId) {
    try {
      const message = await Message.findOne({ id: messageId });
      
      if (!message) {
        throw new Error('Message not found');
      }

      // Verify user has access to this message's chat
      const chat = await Chat.findOne({ id: message.chatId, userId });
      if (!chat) {
        throw new Error('Access denied');
      }

      return message.toObject();
    } catch (error) {
      logger.error('Error getting message:', error);
      throw error;
    }
  }

  async updateMessage(messageId, userId, updates) {
    try {
      const message = await Message.findOne({ id: messageId });
      
      if (!message) {
        throw new Error('Message not found');
      }

      // Verify user has access to this message's chat
      const chat = await Chat.findOne({ id: message.chatId, userId });
      if (!chat) {
        throw new Error('Access denied');
      }

      // Only allow updating certain fields
      const allowedUpdates = ['content', 'metadata', 'status'];
      const filteredUpdates = {};

      Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });

      filteredUpdates.updatedAt = new Date();

      const updatedMessage = await Message.findOneAndUpdate(
        { id: messageId },
        filteredUpdates,
        { new: true, runValidators: true }
      );

      // Update message in chat as well
      await Chat.findOneAndUpdate(
        { id: message.chatId, 'messages.id': messageId },
        {
          $set: {
            'messages.$.content': updatedMessage.content,
            'messages.$.metadata': updatedMessage.metadata,
            'messages.$.status': updatedMessage.status,
            'messages.$.updatedAt': updatedMessage.updatedAt
          }
        }
      );

      logger.info(`Updated message ${messageId}`);
      return updatedMessage.toObject();
    } catch (error) {
      logger.error('Error updating message:', error);
      throw error;
    }
  }

  async deleteMessage(messageId, userId) {
    try {
      const message = await Message.findOne({ id: messageId });
      
      if (!message) {
        throw new Error('Message not found');
      }

      // Verify user has access to this message's chat
      const chat = await Chat.findOne({ id: message.chatId, userId });
      if (!chat) {
        throw new Error('Access denied');
      }

      // Delete from messages collection
      await Message.deleteOne({ id: messageId });

      // Remove from chat
      await Chat.findOneAndUpdate(
        { id: message.chatId },
        {
          $pull: { messages: { id: messageId } },
          $set: { updatedAt: new Date() }
        }
      );

      logger.info(`Deleted message ${messageId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting message:', error);
      throw error;
    }
  }

  async searchMessages(userId, query, page = 1, limit = 50) {
    try {
      const skip = (page - 1) * limit;

      // First, get chats that belong to the user
      const userChats = await Chat.find({ userId }).select('id');
      const chatIds = userChats.map(chat => chat.id);

      const messages = await Message.find({
        chatId: { $in: chatIds },
        content: { $regex: query, $options: 'i' }
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('chatId', 'title');

      const total = await Message.countDocuments({
        chatId: { $in: chatIds },
        content: { $regex: query, $options: 'i' }
      });

      return {
        messages: messages.map(msg => msg.toObject()),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error searching messages:', error);
      throw error;
    }
  }

  async getMessageStats(chatId, userId) {
    try {
      // Verify user has access to this chat
      const chat = await Chat.findOne({ id: chatId, userId });
      if (!chat) {
        throw new Error('Chat not found or access denied');
      }

      const stats = await Message.aggregate([
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

      return stats[0] || {
        totalMessages: 0,
        userMessages: 0,
        aiMessages: 0,
        avgMessageLength: 0
      };
    } catch (error) {
      logger.error('Error getting message stats:', error);
      throw error;
    }
  }

  async markAsRead(messageId, userId) {
    try {
      const message = await Message.findOne({ id: messageId });
      
      if (!message) {
        throw new Error('Message not found');
      }

      // Verify user has access to this message's chat
      const chat = await Chat.findOne({ id: message.chatId, userId });
      if (!chat) {
        throw new Error('Access denied');
      }

      await Message.findOneAndUpdate(
        { id: messageId },
        { 
          $set: { 
            status: 'read',
            readAt: new Date(),
            updatedAt: new Date()
          }
        }
      );

      logger.info(`Marked message ${messageId} as read`);
      return true;
    } catch (error) {
      logger.error('Error marking message as read:', error);
      throw error;
    }
  }
}

module.exports = MessageService;
