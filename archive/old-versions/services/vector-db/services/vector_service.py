import chromadb
from chromadb.config import Settings
import os
import logging
import uuid
from typing import List, Dict, Any, Optional
import numpy as np

logger = logging.getLogger(__name__)

class VectorService:
    def __init__(self):
        self.client = chromadb.PersistentClient(
            path=os.getenv('CHROMA_PERSIST_DIRECTORY', './data/chroma'),
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        self.collections = {}
    
    def _get_collection(self, user_id: str):
        """Get or create collection for user"""
        collection_name = f"user_{user_id}"
        
        if collection_name not in self.collections:
            try:
                self.collections[collection_name] = self.client.get_collection(collection_name)
            except:
                self.collections[collection_name] = self.client.create_collection(
                    name=collection_name,
                    metadata={"user_id": user_id}
                )
        
        return self.collections[collection_name]
    
    async def store_embedding(
        self,
        text: str,
        embedding: List[float],
        document_id: str,
        user_id: str,
        metadata: Dict[str, Any] = None
    ) -> str:
        """Store embedding in vector database"""
        try:
            collection = self._get_collection(user_id)
            
            # Generate unique ID for this embedding
            vector_id = str(uuid.uuid4())
            
            # Prepare metadata
            embedding_metadata = {
                'document_id': document_id,
                'user_id': user_id,
                'text_length': len(text),
                **(metadata or {})
            }
            
            # Add to collection
            collection.add(
                ids=[vector_id],
                embeddings=[embedding],
                documents=[text],
                metadatas=[embedding_metadata]
            )
            
            logger.info(f"Stored embedding {vector_id} for document {document_id}")
            return vector_id
            
        except Exception as e:
            logger.error(f"Error storing embedding: {str(e)}")
            raise e
    
    async def search_similar(
        self,
        query_embedding: List[float],
        user_id: str,
        limit: int = 10,
        threshold: float = 0.7
    ) -> List[Dict[str, Any]]:
        """Search for similar embeddings"""
        try:
            collection = self._get_collection(user_id)
            
            # Search in collection
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=limit,
                include=['documents', 'metadatas', 'distances']
            )
            
            # Format results
            formatted_results = []
            for i, (doc, metadata, distance) in enumerate(zip(
                results['documents'][0],
                results['metadatas'][0],
                results['distances'][0]
            )):
                # Convert distance to similarity score
                similarity = 1 - distance
                
                if similarity >= threshold:
                    formatted_results.append({
                        'id': results['ids'][0][i],
                        'document': doc,
                        'metadata': metadata,
                        'similarity': similarity,
                        'distance': distance
                    })
            
            logger.info(f"Found {len(formatted_results)} similar documents")
            return formatted_results
            
        except Exception as e:
            logger.error(f"Error searching similar embeddings: {str(e)}")
            raise e
    
    async def delete_document_embeddings(self, document_id: str, user_id: str):
        """Delete all embeddings for a document"""
        try:
            collection = self._get_collection(user_id)
            
            # Get all embeddings for this document
            results = collection.get(
                where={"document_id": document_id},
                include=['metadatas']
            )
            
            if results['ids']:
                # Delete embeddings
                collection.delete(ids=results['ids'])
                logger.info(f"Deleted {len(results['ids'])} embeddings for document {document_id}")
            
        except Exception as e:
            logger.error(f"Error deleting document embeddings: {str(e)}")
            raise e
    
    async def calculate_similarity(
        self,
        embedding1: List[float],
        embedding2: List[float]
    ) -> float:
        """Calculate cosine similarity between two embeddings"""
        try:
            # Convert to numpy arrays
            vec1 = np.array(embedding1)
            vec2 = np.array(embedding2)
            
            # Calculate cosine similarity
            dot_product = np.dot(vec1, vec2)
            norm1 = np.linalg.norm(vec1)
            norm2 = np.linalg.norm(vec2)
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
            
            similarity = dot_product / (norm1 * norm2)
            return float(similarity)
            
        except Exception as e:
            logger.error(f"Error calculating similarity: {str(e)}")
            raise e
    
    async def list_collections(self) -> List[Dict[str, Any]]:
        """List all collections"""
        try:
            collections = self.client.list_collections()
            
            return [
                {
                    'name': col.name,
                    'id': col.id,
                    'metadata': col.metadata
                }
                for col in collections
            ]
            
        except Exception as e:
            logger.error(f"Error listing collections: {str(e)}")
            raise e
    
    async def delete_collection(self, collection_name: str, user_id: str):
        """Delete a collection"""
        try:
            # Verify the collection belongs to the user
            if not collection_name.startswith(f"user_{user_id}"):
                raise ValueError("Collection does not belong to user")
            
            self.client.delete_collection(collection_name)
            
            # Remove from cache
            if collection_name in self.collections:
                del self.collections[collection_name]
            
            logger.info(f"Deleted collection: {collection_name}")
            
        except Exception as e:
            logger.error(f"Error deleting collection: {str(e)}")
            raise e
    
    async def get_collection_stats(self, user_id: str) -> Dict[str, Any]:
        """Get statistics for a user's collection"""
        try:
            collection = self._get_collection(user_id)
            
            # Get collection info
            count = collection.count()
            
            # Get sample of metadata to analyze
            sample = collection.get(limit=100, include=['metadatas'])
            
            # Analyze document distribution
            document_counts = {}
            for metadata in sample['metadatas']:
                doc_id = metadata.get('document_id', 'unknown')
                document_counts[doc_id] = document_counts.get(doc_id, 0) + 1
            
            return {
                'total_embeddings': count,
                'unique_documents': len(document_counts),
                'document_distribution': document_counts,
                'collection_name': f"user_{user_id}"
            }
            
        except Exception as e:
            logger.error(f"Error getting collection stats: {str(e)}")
            raise e
