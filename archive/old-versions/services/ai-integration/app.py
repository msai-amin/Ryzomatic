from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import logging
from datetime import datetime
import traceback

from services.openai_service import OpenAIService
from services.anthropic_service import AnthropicService
from services.text_processor import TextProcessor
from models.conversation import Conversation
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
openai_service = OpenAIService()
anthropic_service = AnthropicService()
text_processor = TextProcessor()

# Database connection
db = get_database()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'ai-integration',
        'timestamp': datetime.utcnow().isoformat(),
        'uptime': 'N/A'  # Could implement uptime tracking
    })

@app.route('/chat', methods=['POST'])
@rate_limit(requests_per_minute=30)
def chat():
    """Main chat endpoint for AI interactions"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        user_id = data.get('userId')
        message = data.get('message')
        conversation_id = data.get('conversationId')
        model = data.get('model', 'gpt-3.5-turbo')
        context = data.get('context', {})
        
        if not user_id or not message:
            return jsonify({'error': 'userId and message are required'}), 400
        
        logger.info(f"Processing chat request for user: {user_id}")
        
        # Get or create conversation
        if conversation_id:
            conversation = Conversation.get_by_id(conversation_id)
            if not conversation:
                return jsonify({'error': 'Conversation not found'}), 404
        else:
            conversation = Conversation.create(user_id)
        
        # Add user message to conversation
        conversation.add_message('user', message)
        
        # Process the message and get AI response
        ai_response = await process_message(message, model, context, conversation)
        
        # Add AI response to conversation
        conversation.add_message('assistant', ai_response)
        
        # Save conversation
        conversation.save()
        
        return jsonify({
            'success': True,
            'response': ai_response,
            'conversationId': conversation.id,
            'model': model,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        return handle_error(e)

@app.route('/summarize', methods=['POST'])
@rate_limit(requests_per_minute=20)
def summarize():
    """Summarize text or document content"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        text = data.get('text')
        document_id = data.get('documentId')
        summary_type = data.get('type', 'brief')  # brief, detailed, bullet_points
        model = data.get('model', 'gpt-3.5-turbo')
        
        if not text and not document_id:
            return jsonify({'error': 'Either text or documentId is required'}), 400
        
        # If document_id is provided, fetch the document content
        if document_id:
            # This would integrate with the document processing service
            # For now, we'll assume text is provided
            pass
        
        logger.info(f"Processing summarize request: {summary_type}")
        
        # Generate summary
        summary = await text_processor.summarize_text(text, summary_type, model)
        
        return jsonify({
            'success': True,
            'summary': summary,
            'type': summary_type,
            'model': model,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in summarize endpoint: {str(e)}")
        return handle_error(e)

@app.route('/analyze', methods=['POST'])
@rate_limit(requests_per_minute=15)
def analyze():
    """Analyze text for various insights"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        text = data.get('text')
        analysis_type = data.get('type', 'general')  # general, sentiment, topics, entities
        model = data.get('model', 'gpt-3.5-turbo')
        
        if not text:
            return jsonify({'error': 'Text is required'}), 400
        
        logger.info(f"Processing analyze request: {analysis_type}")
        
        # Perform analysis
        analysis = await text_processor.analyze_text(text, analysis_type, model)
        
        return jsonify({
            'success': True,
            'analysis': analysis,
            'type': analysis_type,
            'model': model,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in analyze endpoint: {str(e)}")
        return handle_error(e)

@app.route('/generate-questions', methods=['POST'])
@rate_limit(requests_per_minute=20)
def generate_questions():
    """Generate questions based on text content"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        text = data.get('text')
        question_type = data.get('type', 'comprehension')  # comprehension, critical_thinking, discussion
        count = data.get('count', 5)
        model = data.get('model', 'gpt-3.5-turbo')
        
        if not text:
            return jsonify({'error': 'Text is required'}), 400
        
        logger.info(f"Processing generate-questions request: {question_type}")
        
        # Generate questions
        questions = await text_processor.generate_questions(text, question_type, count, model)
        
        return jsonify({
            'success': True,
            'questions': questions,
            'type': question_type,
            'count': len(questions),
            'model': model,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in generate-questions endpoint: {str(e)}")
        return handle_error(e)

@app.route('/conversations/<user_id>', methods=['GET'])
@rate_limit(requests_per_minute=60)
def get_conversations(user_id):
    """Get user's conversation history"""
    try:
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 10, type=int)
        
        conversations = Conversation.get_by_user(user_id, page, limit)
        
        return jsonify({
            'success': True,
            'conversations': [conv.to_dict() for conv in conversations],
            'pagination': {
                'page': page,
                'limit': limit
            },
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error getting conversations: {str(e)}")
        return handle_error(e)

@app.route('/conversations/<conversation_id>', methods=['DELETE'])
@rate_limit(requests_per_minute=30)
def delete_conversation(conversation_id):
    """Delete a conversation"""
    try:
        conversation = Conversation.get_by_id(conversation_id)
        
        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404
        
        conversation.delete()
        
        return jsonify({
            'success': True,
            'message': 'Conversation deleted successfully',
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error deleting conversation: {str(e)}")
        return handle_error(e)

async def process_message(message, model, context, conversation):
    """Process a message and return AI response"""
    try:
        # Determine which AI service to use
        if model.startswith('gpt'):
            service = openai_service
        elif model.startswith('claude'):
            service = anthropic_service
        else:
            service = openai_service  # Default to OpenAI
        
        # Get conversation history for context
        history = conversation.get_recent_messages(10)  # Last 10 messages
        
        # Process the message
        response = await service.chat_completion(
            message=message,
            history=history,
            context=context,
            model=model
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Error processing message: {str(e)}")
        raise e

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3004, debug=True)
