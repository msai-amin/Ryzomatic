const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

class UserService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    this.jwtExpiry = process.env.JWT_EXPIRY || '7d';
  }

  async createUser(userData) {
    try {
      const { email, password, name, metadata = {} } = userData;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new Error('User already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const user = new User({
        email,
        password: hashedPassword,
        name,
        metadata,
        status: 'active'
      });

      await user.save();
      logger.info(`Created user ${user.id} with email ${email}`);

      return user.toObject();
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  async getUserById(userId) {
    try {
      const user = await User.findById(userId).select('-password');
      return user ? user.toObject() : null;
    } catch (error) {
      logger.error('Error getting user by ID:', error);
      throw error;
    }
  }

  async getUserByEmail(email) {
    try {
      const user = await User.findOne({ email });
      return user ? user.toObject() : null;
    } catch (error) {
      logger.error('Error getting user by email:', error);
      throw error;
    }
  }

  async authenticateUser(email, password) {
    try {
      const user = await User.findOne({ email });
      if (!user) {
        throw new Error('Invalid credentials');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      if (user.status !== 'active') {
        throw new Error('Account is not active');
      }

      logger.info(`User ${user.id} authenticated successfully`);
      return user.toObject();
    } catch (error) {
      logger.error('Error authenticating user:', error);
      throw error;
    }
  }

  async generateToken(user) {
    try {
      const payload = {
        id: user.id,
        email: user.email,
        name: user.name
      };

      const token = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.jwtExpiry
      });

      return token;
    } catch (error) {
      logger.error('Error generating token:', error);
      throw error;
    }
  }

  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      return decoded;
    } catch (error) {
      logger.error('Error verifying token:', error);
      throw error;
    }
  }

  async updateUser(userId, updates) {
    try {
      const allowedUpdates = ['name', 'metadata', 'status'];
      const filteredUpdates = {};

      Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });

      filteredUpdates.updatedAt = new Date();

      const user = await User.findByIdAndUpdate(
        userId,
        filteredUpdates,
        { new: true, runValidators: true }
      ).select('-password');

      if (!user) {
        throw new Error('User not found');
      }

      logger.info(`Updated user ${userId}`);
      return user.toObject();
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      await User.findByIdAndUpdate(userId, {
        password: hashedNewPassword,
        updatedAt: new Date()
      });

      logger.info(`Changed password for user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error changing password:', error);
      throw error;
    }
  }

  async deleteUser(userId) {
    try {
      const result = await User.findByIdAndDelete(userId);
      
      if (!result) {
        throw new Error('User not found');
      }

      logger.info(`Deleted user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }

  async getUserStats(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get chat count
      const Chat = require('../models/Chat');
      const chatCount = await Chat.countDocuments({ userId });

      // Get message count
      const Message = require('../models/Message');
      const messageCount = await Message.countDocuments({ userId });

      return {
        userId,
        email: user.email,
        name: user.name,
        status: user.status,
        createdAt: user.createdAt,
        chatCount,
        messageCount,
        lastActive: user.updatedAt
      };
    } catch (error) {
      logger.error('Error getting user stats:', error);
      throw error;
    }
  }

  async searchUsers(query, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      
      const users = await User.find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } }
        ]
      })
        .select('-password')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit);

      const total = await User.countDocuments({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } }
        ]
      });

      return {
        users: users.map(user => user.toObject()),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error searching users:', error);
      throw error;
    }
  }
}

module.exports = UserService;
