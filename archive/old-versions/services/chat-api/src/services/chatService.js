const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const Chat = require('../models/Chat');
const logger = require('../utils/logger');

class ChatService {
  constructor() {
    this.aiIntegrationUrl = process.env.AI_INTEGRATION_URL || 'http://localhost:3004';
  }

  async createChat(userId, title = null, metadata = {}) {
    try {
      const chat = new Chat({
        id: uuidv4(),
        userId,
        title: title || `Chat ${new Date().toLocaleDateString()}`,
        metadata,
        status: 'active'
      });

      await chat.save();
      logger.info(`Created chat ${chat.id} for user ${userId}`);

      return chat.toObject();
    } catch (error) {
      logger.error('Error creating chat:', error);
      throw error;
    }
  }

  async getChat(chatId, userId) {
    try {
      const chat = await Chat.findOne({ id: chatId, userId });
      return chat ? chat.toObject() : null;
    } catch (error) {
      logger.error('Error getting chat:', error);
      throw error;
    }
  }

  async getUserChats(userId, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      
      const chats = await Chat.find({ userId })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-messages'); // Exclude messages for list view

      const total = await Chat.countDocuments({ userId });

      return {
        chats: chats.map(chat => chat.toObject()),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting user chats:', error);
      throw error;
    }
  }

  async updateChat(chatId, userId, updates) {
    try {
      const allowedUpdates = ['title', 'metadata', 'status'];
      const filteredUpdates = {};

      Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });

      filteredUpdates.updatedAt = new Date();

      const chat = await Chat.findOneAndUpdate(
        { id: chatId, userId },
        filteredUpdates,
        { new: true, runValidators: true }
      );

      if (!chat) {
        throw new Error('Chat not found');
      }

      logger.info(`Updated chat ${chatId} for user ${userId}`);
      return chat.toObject();
    } catch (error) {
      logger.error('Error updating chat:', error);
      throw error;
    }
  }

  async deleteChat(chatId, userId) {
    try {
      const result = await Chat.deleteOne({ id: chatId, userId });
      
      if (result.deletedCount === 0) {
        throw new Error('Chat not found');
      }

      logger.info(`Deleted chat ${chatId} for user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting chat:', error);
      throw error;
    }
  }

  async getAIResponse(chatId, userMessage, userId) {
    try {
      // Get recent chat history for context
      const chat = await Chat.findOne({ id: chatId, userId });
      if (!chat) {
        throw new Error('Chat not found');
      }

      // Get recent messages for context
      const recentMessages = chat.messages.slice(-10); // Last 10 messages

      // Prepare context for AI
      const context = {
        chatId,
        userId,
        recentMessages: recentMessages.map(msg => ({
          role: msg.userId === 'ai' ? 'assistant' : 'user',
          content: msg.content
        }))
      };

      // Call AI integration service
      const response = await axios.post(`${this.aiIntegrationUrl}/chat`, {
        userId,
        message: userMessage,
        conversationId: chatId,
        context
      });

      if (response.data.success) {
        return response.data.response;
      } else {
        throw new Error('AI service returned error');
      }

    } catch (error) {
      logger.error('Error getting AI response:', error);
      
      // Return a fallback response
      return "I'm sorry, I'm having trouble processing your request right now. Please try again later.";
    }
  }

  async searchChats(userId, query, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      
      const chats = await Chat.find({
        userId,
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { 'messages.content': { $regex: query, $options: 'i' } }
        ]
      })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-messages');

      const total = await Chat.countDocuments({
        userId,
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { 'messages.content': { $regex: query, $options: 'i' } }
        ]
      });

      return {
        chats: chats.map(chat => chat.toObject()),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error searching chats:', error);
      throw error;
    }
  }

  async getChatStats(userId) {
    try {
      const stats = await Chat.aggregate([
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

      return stats[0] || {
        totalChats: 0,
        activeChats: 0,
        totalMessages: 0,
        avgMessagesPerChat: 0
      };
    } catch (error) {
      logger.error('Error getting chat stats:', error);
      throw error;
    }
  }
}

module.exports = ChatService;
