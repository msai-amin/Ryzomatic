from datetime import datetime
from typing import List, Dict, Any, Optional
import uuid
from pymongo import MongoClient
import os

class DocumentEmbedding:
    def __init__(
        self,
        document_id: str,
        user_id: str,
        text: str,
        embedding: List[float],
        model: str = 'text-embedding-ada-002',
        metadata: Dict[str, Any] = None
    ):
        self.id = str(uuid.uuid4())
        self.document_id = document_id
        self.user_id = user_id
        self.text = text
        self.embedding = embedding
        self.model = model
        self.metadata = metadata or {}
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'id': self.id,
            'document_id': self.document_id,
            'user_id': self.user_id,
            'text': self.text,
            'embedding': self.embedding,
            'model': self.model,
            'metadata': self.metadata,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
    
    def save(self):
        """Save to database"""
        try:
            db = self._get_database()
            collection = db['document_embeddings']
            
            embedding_data = {
                'id': self.id,
                'document_id': self.document_id,
                'user_id': self.user_id,
                'text': self.text,
                'embedding': self.embedding,
                'model': self.model,
                'metadata': self.metadata,
                'created_at': self.created_at,
                'updated_at': self.updated_at
            }
            
            # Update or insert
            collection.replace_one(
                {'id': self.id},
                embedding_data,
                upsert=True
            )
            
        except Exception as e:
            print(f"Error saving document embedding: {str(e)}")
            raise e
    
    @classmethod
    def get_by_id(cls, embedding_id: str) -> Optional['DocumentEmbedding']:
        """Get embedding by ID"""
        try:
            db = cls._get_database()
            collection = db['document_embeddings']
            
            data = collection.find_one({'id': embedding_id})
            if not data:
                return None
            
            embedding = cls(
                document_id=data['document_id'],
                user_id=data['user_id'],
                text=data['text'],
                embedding=data['embedding'],
                model=data['model'],
                metadata=data.get('metadata', {})
            )
            embedding.id = data['id']
            embedding.created_at = data.get('created_at', datetime.utcnow())
            embedding.updated_at = data.get('updated_at', datetime.utcnow())
            
            return embedding
            
        except Exception as e:
            print(f"Error getting embedding by ID: {str(e)}")
            return None
    
    @classmethod
    def get_by_document(cls, document_id: str, user_id: str) -> List['DocumentEmbedding']:
        """Get all embeddings for a document"""
        try:
            db = cls._get_database()
            collection = db['document_embeddings']
            
            cursor = collection.find({
                'document_id': document_id,
                'user_id': user_id
            }).sort('created_at', 1)
            
            embeddings = []
            for data in cursor:
                embedding = cls(
                    document_id=data['document_id'],
                    user_id=data['user_id'],
                    text=data['text'],
                    embedding=data['embedding'],
                    model=data['model'],
                    metadata=data.get('metadata', {})
                )
                embedding.id = data['id']
                embedding.created_at = data.get('created_at', datetime.utcnow())
                embedding.updated_at = data.get('updated_at', datetime.utcnow())
                embeddings.append(embedding)
            
            return embeddings
            
        except Exception as e:
            print(f"Error getting document embeddings: {str(e)}")
            return []
    
    @classmethod
    def get_by_user(cls, user_id: str, page: int = 1, limit: int = 20) -> tuple[List['DocumentEmbedding'], int]:
        """Get embeddings for a user with pagination"""
        try:
            db = cls._get_database()
            collection = db['document_embeddings']
            
            skip = (page - 1) * limit
            
            # Get total count
            total = collection.count_documents({'user_id': user_id})
            
            # Get paginated results
            cursor = collection.find(
                {'user_id': user_id}
            ).sort('created_at', -1).skip(skip).limit(limit)
            
            embeddings = []
            for data in cursor:
                embedding = cls(
                    document_id=data['document_id'],
                    user_id=data['user_id'],
                    text=data['text'],
                    embedding=data['embedding'],
                    model=data['model'],
                    metadata=data.get('metadata', {})
                )
                embedding.id = data['id']
                embedding.created_at = data.get('created_at', datetime.utcnow())
                embedding.updated_at = data.get('updated_at', datetime.utcnow())
                embeddings.append(embedding)
            
            return embeddings, total
            
        except Exception as e:
            print(f"Error getting user embeddings: {str(e)}")
            return [], 0
    
    @classmethod
    def delete_by_document(cls, document_id: str, user_id: str):
        """Delete all embeddings for a document"""
        try:
            db = cls._get_database()
            collection = db['document_embeddings']
            
            result = collection.delete_many({
                'document_id': document_id,
                'user_id': user_id
            })
            
            print(f"Deleted {result.deleted_count} embeddings for document {document_id}")
            
        except Exception as e:
            print(f"Error deleting document embeddings: {str(e)}")
            raise e
    
    @classmethod
    def delete_by_id(cls, embedding_id: str):
        """Delete embedding by ID"""
        try:
            db = cls._get_database()
            collection = db['document_embeddings']
            
            result = collection.delete_one({'id': embedding_id})
            return result.deleted_count > 0
            
        except Exception as e:
            print(f"Error deleting embedding: {str(e)}")
            raise e
    
    @classmethod
    def get_stats_by_user(cls, user_id: str) -> Dict[str, Any]:
        """Get embedding statistics for a user"""
        try:
            db = cls._get_database()
            collection = db['document_embeddings']
            
            # Get total count
            total_embeddings = collection.count_documents({'user_id': user_id})
            
            # Get unique documents
            unique_documents = len(collection.distinct('document_id', {'user_id': user_id}))
            
            # Get model distribution
            model_pipeline = [
                {'$match': {'user_id': user_id}},
                {'$group': {'_id': '$model', 'count': {'$sum': 1}}}
            ]
            model_distribution = list(collection.aggregate(model_pipeline))
            
            # Get recent activity
            recent_embeddings = collection.count_documents({
                'user_id': user_id,
                'created_at': {'$gte': datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)}
            })
            
            return {
                'total_embeddings': total_embeddings,
                'unique_documents': unique_documents,
                'model_distribution': model_distribution,
                'recent_embeddings_today': recent_embeddings
            }
            
        except Exception as e:
            print(f"Error getting user stats: {str(e)}")
            return {}
    
    @staticmethod
    def _get_database():
        """Get database connection"""
        client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017/'))
        return client['smart-reader']
