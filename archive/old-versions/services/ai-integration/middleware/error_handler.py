import logging
from flask import jsonify
import traceback

logger = logging.getLogger(__name__)

def handle_error(error):
    """Handle errors and return appropriate response"""
    logger.error(f"Error occurred: {str(error)}")
    logger.error(f"Traceback: {traceback.format_exc()}")
    
    # Handle specific error types
    if hasattr(error, 'status_code'):
        return jsonify({
            'error': 'Request failed',
            'message': str(error)
        }), error.status_code
    
    # Default error response
    return jsonify({
        'error': 'Internal server error',
        'message': 'An unexpected error occurred'
    }), 500
