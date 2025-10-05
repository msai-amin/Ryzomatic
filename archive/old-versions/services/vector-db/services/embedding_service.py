import openai
import os
import logging
from typing import List, Dict, Any
from sentence_transformers import SentenceTransformer
import numpy as np

logger = logging.getLogger(__name__)

class EmbeddingService:
    def __init__(self):
        self.openai_client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        
        # Initialize local embedding models
        self.local_models = {
            'all-MiniLM-L6-v2': SentenceTransformer('all-MiniLM-L6-v2'),
            'all-mpnet-base-v2': SentenceTransformer('all-mpnet-base-v2')
        }
    
    async def generate_embedding(
        self,
        text: str,
        model: str = 'text-embedding-ada-002'
    ) -> List[float]:
        """Generate embedding for text using specified model"""
        try:
            if model.startswith('text-embedding'):
                # Use OpenAI embedding
                return await self._generate_openai_embedding(text, model)
            elif model in self.local_models:
                # Use local model
                return await self._generate_local_embedding(text, model)
            else:
                # Default to OpenAI
                return await self._generate_openai_embedding(text, 'text-embedding-ada-002')
                
        except Exception as e:
            logger.error(f"Error generating embedding: {str(e)}")
            raise e
    
    async def _generate_openai_embedding(
        self,
        text: str,
        model: str
    ) -> List[float]:
        """Generate embedding using OpenAI API"""
        try:
            response = self.openai_client.embeddings.create(
                model=model,
                input=text
            )
            return response.data[0].embedding
            
        except Exception as e:
            logger.error(f"OpenAI embedding error: {str(e)}")
            raise e
    
    async def _generate_local_embedding(
        self,
        text: str,
        model: str
    ) -> List[float]:
        """Generate embedding using local model"""
        try:
            model_instance = self.local_models[model]
            embedding = model_instance.encode(text)
            return embedding.tolist()
            
        except Exception as e:
            logger.error(f"Local embedding error: {str(e)}")
            raise e
    
    async def generate_batch_embeddings(
        self,
        texts: List[str],
        model: str = 'text-embedding-ada-002'
    ) -> List[List[float]]:
        """Generate embeddings for multiple texts"""
        try:
            if model.startswith('text-embedding'):
                # Use OpenAI batch API
                return await self._generate_openai_batch_embeddings(texts, model)
            elif model in self.local_models:
                # Use local model batch processing
                return await self._generate_local_batch_embeddings(texts, model)
            else:
                # Default to OpenAI
                return await self._generate_openai_batch_embeddings(texts, 'text-embedding-ada-002')
                
        except Exception as e:
            logger.error(f"Error generating batch embeddings: {str(e)}")
            raise e
    
    async def _generate_openai_batch_embeddings(
        self,
        texts: List[str],
        model: str
    ) -> List[List[float]]:
        """Generate batch embeddings using OpenAI API"""
        try:
            # OpenAI has a limit on batch size, so we'll process in chunks
            batch_size = 100
            all_embeddings = []
            
            for i in range(0, len(texts), batch_size):
                batch_texts = texts[i:i + batch_size]
                
                response = self.openai_client.embeddings.create(
                    model=model,
                    input=batch_texts
                )
                
                batch_embeddings = [item.embedding for item in response.data]
                all_embeddings.extend(batch_embeddings)
            
            return all_embeddings
            
        except Exception as e:
            logger.error(f"OpenAI batch embedding error: {str(e)}")
            raise e
    
    async def _generate_local_batch_embeddings(
        self,
        texts: List[str],
        model: str
    ) -> List[List[float]]:
        """Generate batch embeddings using local model"""
        try:
            model_instance = self.local_models[model]
            embeddings = model_instance.encode(texts)
            return [emb.tolist() for emb in embeddings]
            
        except Exception as e:
            logger.error(f"Local batch embedding error: {str(e)}")
            raise e
    
    async def get_embedding_dimension(self, model: str) -> int:
        """Get the dimension of embeddings for a model"""
        try:
            if model.startswith('text-embedding'):
                # OpenAI embedding dimensions
                if model == 'text-embedding-ada-002':
                    return 1536
                elif model == 'text-embedding-3-small':
                    return 1536
                elif model == 'text-embedding-3-large':
                    return 3072
                else:
                    return 1536  # Default
            elif model in self.local_models:
                # Get dimension from local model
                model_instance = self.local_models[model]
                return model_instance.get_sentence_embedding_dimension()
            else:
                return 1536  # Default
                
        except Exception as e:
            logger.error(f"Error getting embedding dimension: {str(e)}")
            return 1536  # Default fallback
    
    async def get_available_models(self) -> List[Dict[str, Any]]:
        """Get list of available embedding models"""
        try:
            models = [
                {
                    'name': 'text-embedding-ada-002',
                    'type': 'openai',
                    'dimension': 1536,
                    'description': 'OpenAI Ada 002 embedding model'
                },
                {
                    'name': 'text-embedding-3-small',
                    'type': 'openai',
                    'dimension': 1536,
                    'description': 'OpenAI 3 Small embedding model'
                },
                {
                    'name': 'text-embedding-3-large',
                    'type': 'openai',
                    'dimension': 3072,
                    'description': 'OpenAI 3 Large embedding model'
                },
                {
                    'name': 'all-MiniLM-L6-v2',
                    'type': 'local',
                    'dimension': 384,
                    'description': 'Sentence Transformers MiniLM model'
                },
                {
                    'name': 'all-mpnet-base-v2',
                    'type': 'local',
                    'dimension': 768,
                    'description': 'Sentence Transformers MPNet model'
                }
            ]
            
            return models
            
        except Exception as e:
            logger.error(f"Error getting available models: {str(e)}")
            return []
