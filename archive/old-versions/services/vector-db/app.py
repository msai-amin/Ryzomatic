from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import logging
from datetime import datetime
import traceback

from services.vector_service import VectorService
from services.embedding_service import EmbeddingService
from models.document_embedding import DocumentEmbedding
from utils.database import get_database
from utils.logger import setup_logger
from middleware.rate_limiter import rate_limit
from middleware.error_handler import handle_error

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Setup logging
logger = setup_logger()

# Initialize services
vector_service = VectorService()
embedding_service = EmbeddingService()

# Database connection
db = get_database()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'vector-database',
        'timestamp': datetime.utcnow().isoformat(),
        'uptime': 'N/A'
    })

@app.route('/embeddings', methods=['POST'])
@rate_limit(requests_per_minute=30)
def create_embedding():
    """Create embedding for text"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        text = data.get('text')
        document_id = data.get('documentId')
        user_id = data.get('userId')
        metadata = data.get('metadata', {})
        model = data.get('model', 'text-embedding-ada-002')
        
        if not text or not document_id or not user_id:
            return jsonify({'error': 'text, documentId, and userId are required'}), 400
        
        logger.info(f"Creating embedding for document: {document_id}")
        
        # Generate embedding
        embedding = await embedding_service.generate_embedding(text, model)
        
        # Store in vector database
        vector_id = await vector_service.store_embedding(
            text=text,
            embedding=embedding,
            document_id=document_id,
            user_id=user_id,
            metadata=metadata
        )
        
        # Store in MongoDB
        doc_embedding = DocumentEmbedding(
            document_id=document_id,
            user_id=user_id,
            text=text,
            embedding=embedding,
            model=model,
            metadata=metadata
        )
        doc_embedding.save()
        
        return jsonify({
            'success': True,
            'vectorId': vector_id,
            'documentId': document_id,
            'model': model,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error creating embedding: {str(e)}")
        return handle_error(e)

@app.route('/search', methods=['POST'])
@rate_limit(requests_per_minute=60)
def search_similar():
    """Search for similar documents"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        query = data.get('query')
        user_id = data.get('userId')
        limit = data.get('limit', 10)
        threshold = data.get('threshold', 0.7)
        model = data.get('model', 'text-embedding-ada-002')
        
        if not query or not user_id:
            return jsonify({'error': 'query and userId are required'}), 400
        
        logger.info(f"Searching for similar documents for user: {user_id}")
        
        # Generate query embedding
        query_embedding = await embedding_service.generate_embedding(query, model)
        
        # Search in vector database
        results = await vector_service.search_similar(
            query_embedding=query_embedding,
            user_id=user_id,
            limit=limit,
            threshold=threshold
        )
        
        return jsonify({
            'success': True,
            'results': results,
            'query': query,
            'limit': limit,
            'threshold': threshold,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error searching similar documents: {str(e)}")
        return handle_error(e)

@app.route('/documents/<document_id>/embeddings', methods=['GET'])
@rate_limit(requests_per_minute=60)
def get_document_embeddings(document_id):
    """Get embeddings for a specific document"""
    try:
        user_id = request.args.get('userId')
        
        if not user_id:
            return jsonify({'error': 'userId is required'}), 400
        
        logger.info(f"Getting embeddings for document: {document_id}")
        
        # Get embeddings from MongoDB
        embeddings = DocumentEmbedding.get_by_document(document_id, user_id)
        
        return jsonify({
            'success': True,
            'documentId': document_id,
            'embeddings': [emb.to_dict() for emb in embeddings],
            'count': len(embeddings),
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error getting document embeddings: {str(e)}")
        return handle_error(e)

@app.route('/documents/<document_id>/embeddings', methods=['DELETE'])
@rate_limit(requests_per_minute=30)
def delete_document_embeddings(document_id):
    """Delete all embeddings for a document"""
    try:
        user_id = request.args.get('userId')
        
        if not user_id:
            return jsonify({'error': 'userId is required'}), 400
        
        logger.info(f"Deleting embeddings for document: {document_id}")
        
        # Delete from vector database
        await vector_service.delete_document_embeddings(document_id, user_id)
        
        # Delete from MongoDB
        DocumentEmbedding.delete_by_document(document_id, user_id)
        
        return jsonify({
            'success': True,
            'message': 'Document embeddings deleted successfully',
            'documentId': document_id,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error deleting document embeddings: {str(e)}")
        return handle_error(e)

@app.route('/users/<user_id>/embeddings', methods=['GET'])
@rate_limit(requests_per_minute=60)
def get_user_embeddings(user_id):
    """Get all embeddings for a user"""
    try:
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        
        logger.info(f"Getting embeddings for user: {user_id}")
        
        # Get embeddings from MongoDB with pagination
        embeddings, total = DocumentEmbedding.get_by_user(user_id, page, limit)
        
        return jsonify({
            'success': True,
            'embeddings': [emb.to_dict() for emb in embeddings],
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total,
                'pages': (total + limit - 1) // limit
            },
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error getting user embeddings: {str(e)}")
        return handle_error(e)

@app.route('/similarity', methods=['POST'])
@rate_limit(requests_per_minute=30)
def calculate_similarity():
    """Calculate similarity between two texts"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        text1 = data.get('text1')
        text2 = data.get('text2')
        model = data.get('model', 'text-embedding-ada-002')
        
        if not text1 or not text2:
            return jsonify({'error': 'text1 and text2 are required'}), 400
        
        logger.info("Calculating similarity between two texts")
        
        # Generate embeddings for both texts
        embedding1 = await embedding_service.generate_embedding(text1, model)
        embedding2 = await embedding_service.generate_embedding(text2, model)
        
        # Calculate cosine similarity
        similarity = await vector_service.calculate_similarity(embedding1, embedding2)
        
        return jsonify({
            'success': True,
            'similarity': similarity,
            'model': model,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error calculating similarity: {str(e)}")
        return handle_error(e)

@app.route('/collections', methods=['GET'])
@rate_limit(requests_per_minute=60)
def list_collections():
    """List all collections in the vector database"""
    try:
        collections = await vector_service.list_collections()
        
        return jsonify({
            'success': True,
            'collections': collections,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error listing collections: {str(e)}")
        return handle_error(e)

@app.route('/collections/<collection_name>', methods=['DELETE'])
@rate_limit(requests_per_minute=10)
def delete_collection(collection_name):
    """Delete a collection"""
    try:
        user_id = request.args.get('userId')
        
        if not user_id:
            return jsonify({'error': 'userId is required'}), 400
        
        logger.info(f"Deleting collection: {collection_name}")
        
        await vector_service.delete_collection(collection_name, user_id)
        
        return jsonify({
            'success': True,
            'message': 'Collection deleted successfully',
            'collectionName': collection_name,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error deleting collection: {str(e)}")
        return handle_error(e)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3005, debug=True)
