from datetime import datetime
from typing import List, Dict, Any, Optional
import uuid
from pymongo import MongoClient
import os

class Conversation:
    def __init__(self, user_id: str, conversation_id: str = None):
        self.id = conversation_id or str(uuid.uuid4())
        self.user_id = user_id
        self.messages = []
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self.metadata = {}
    
    def add_message(self, role: str, content: str, metadata: Dict[str, Any] = None):
        """Add a message to the conversation"""
        message = {
            'role': role,
            'content': content,
            'timestamp': datetime.utcnow(),
            'metadata': metadata or {}
        }
        self.messages.append(message)
        self.updated_at = datetime.utcnow()
    
    def get_recent_messages(self, count: int = 10) -> List[Dict[str, str]]:
        """Get recent messages from the conversation"""
        recent = self.messages[-count:] if self.messages else []
        return [
            {
                'role': msg['role'],
                'content': msg['content']
            }
            for msg in recent
        ]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert conversation to dictionary"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'messages': self.messages,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'metadata': self.metadata,
            'message_count': len(self.messages)
        }
    
    def save(self):
        """Save conversation to database"""
        try:
            db = self._get_database()
            collection = db['conversations']
            
            conversation_data = {
                'id': self.id,
                'user_id': self.user_id,
                'messages': self.messages,
                'created_at': self.created_at,
                'updated_at': self.updated_at,
                'metadata': self.metadata
            }
            
            # Update or insert
            collection.replace_one(
                {'id': self.id},
                conversation_data,
                upsert=True
            )
            
        except Exception as e:
            print(f"Error saving conversation: {str(e)}")
            raise e
    
    @classmethod
    def get_by_id(cls, conversation_id: str) -> Optional['Conversation']:
        """Get conversation by ID"""
        try:
            db = cls._get_database()
            collection = db['conversations']
            
            data = collection.find_one({'id': conversation_id})
            if not data:
                return None
            
            conversation = cls(data['user_id'], data['id'])
            conversation.messages = data.get('messages', [])
            conversation.created_at = data.get('created_at', datetime.utcnow())
            conversation.updated_at = data.get('updated_at', datetime.utcnow())
            conversation.metadata = data.get('metadata', {})
            
            return conversation
            
        except Exception as e:
            print(f"Error getting conversation: {str(e)}")
            return None
    
    @classmethod
    def get_by_user(cls, user_id: str, page: int = 1, limit: int = 10) -> List['Conversation']:
        """Get conversations for a user with pagination"""
        try:
            db = cls._get_database()
            collection = db['conversations']
            
            skip = (page - 1) * limit
            cursor = collection.find(
                {'user_id': user_id}
            ).sort('updated_at', -1).skip(skip).limit(limit)
            
            conversations = []
            for data in cursor:
                conversation = cls(data['user_id'], data['id'])
                conversation.messages = data.get('messages', [])
                conversation.created_at = data.get('created_at', datetime.utcnow())
                conversation.updated_at = data.get('updated_at', datetime.utcnow())
                conversation.metadata = data.get('metadata', {})
                conversations.append(conversation)
            
            return conversations
            
        except Exception as e:
            print(f"Error getting user conversations: {str(e)}")
            return []
    
    @classmethod
    def create(cls, user_id: str) -> 'Conversation':
        """Create a new conversation"""
        return cls(user_id)
    
    def delete(self):
        """Delete conversation from database"""
        try:
            db = self._get_database()
            collection = db['conversations']
            collection.delete_one({'id': self.id})
            
        except Exception as e:
            print(f"Error deleting conversation: {str(e)}")
            raise e
    
    @staticmethod
    def _get_database():
        """Get database connection"""
        client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017/'))
        return client['smart-reader']
