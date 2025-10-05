const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    maxlength: 100
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  parentFolder: {
    type: String,
    default: null,
    index: true
  },
  path: {
    type: String,
    required: true,
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
  collection: 'folders'
});

// Indexes for better query performance
folderSchema.index({ userId: 1, parentFolder: 1 });
folderSchema.index({ userId: 1, path: 1 });
folderSchema.index({ status: 1, createdAt: -1 });

// Pre-save middleware to update the updatedAt field
folderSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for folder URL
folderSchema.virtual('url').get(function() {
  return `/folders/${this._id}`;
});

// Method to get full path
folderSchema.methods.getFullPath = function() {
  return this.path;
};

// Method to check if folder is root
folderSchema.methods.isRoot = function() {
  return !this.parentFolder;
};

// Method to check if folder is active
folderSchema.methods.isActive = function() {
  return this.status === 'active';
};

// Method to get folder depth
folderSchema.methods.getDepth = function() {
  return this.path.split('/').length - 1;
};

// Method to get parent folder name
folderSchema.methods.getParentName = function() {
  if (!this.parentFolder) return null;
  const parts = this.path.split('/');
  return parts[parts.length - 2] || null;
};

// Static method to find folders by user
folderSchema.statics.findByUser = function(userId, parentFolder = null) {
  const query = { userId, status: 'active' };
  
  if (parentFolder) {
    query.parentFolder = parentFolder;
  } else {
    query.parentFolder = { $exists: false };
  }
  
  return this.find(query).sort({ name: 1 });
};

// Static method to find folder by path
folderSchema.statics.findByPath = function(userId, path) {
  return this.findOne({ userId, path, status: 'active' });
};

// Static method to get folder tree
folderSchema.statics.getFolderTree = function(userId) {
  return this.aggregate([
    { $match: { userId, status: 'active' } },
    {
      $graphLookup: {
        from: 'folders',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'parentFolder',
        as: 'children'
      }
    },
    { $match: { parentFolder: { $exists: false } } }
  ]);
};

// Static method to get folder statistics
folderSchema.statics.getFolderStats = function(userId) {
  return this.aggregate([
    { $match: { userId, status: 'active' } },
    {
      $group: {
        _id: null,
        totalFolders: { $sum: 1 },
        rootFolders: {
          $sum: { $cond: [{ $eq: ['$parentFolder', null] }, 1, 0] }
        },
        subFolders: {
          $sum: { $cond: [{ $ne: ['$parentFolder', null] }, 1, 0] }
        }
      }
    }
  ]);
};

// Static method to find folders by name
folderSchema.statics.findByName = function(userId, name, parentFolder = null) {
  const query = { userId, name: { $regex: name, $options: 'i' }, status: 'active' };
  
  if (parentFolder) {
    query.parentFolder = parentFolder;
  }
  
  return this.find(query).sort({ name: 1 });
};

// Static method to get folder hierarchy
folderSchema.statics.getHierarchy = function(userId, folderId) {
  return this.aggregate([
    { $match: { _id: mongoose.Types.ObjectId(folderId), userId, status: 'active' } },
    {
      $graphLookup: {
        from: 'folders',
        startWith: '$parentFolder',
        connectFromField: 'parentFolder',
        connectToField: '_id',
        as: 'ancestors'
      }
    }
  ]);
};

module.exports = mongoose.model('Folder', folderSchema);
