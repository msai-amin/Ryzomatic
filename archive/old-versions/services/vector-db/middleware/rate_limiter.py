from functools import wraps
import time
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)

# In-memory rate limiter (in production, use Redis)
rate_limit_storage = defaultdict(list)

def rate_limit(requests_per_minute: int = 60):
    """Rate limiting decorator"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get client IP (simplified - in production, get from request)
            client_ip = 'default'  # This should be extracted from request
            
            current_time = time.time()
            minute_ago = current_time - 60
            
            # Clean old requests
            rate_limit_storage[client_ip] = [
                req_time for req_time in rate_limit_storage[client_ip]
                if req_time > minute_ago
            ]
            
            # Check if limit exceeded
            if len(rate_limit_storage[client_ip]) >= requests_per_minute:
                logger.warning(f"Rate limit exceeded for IP: {client_ip}")
                return {
                    'error': 'Rate limit exceeded',
                    'message': f'Too many requests. Limit: {requests_per_minute} per minute'
                }, 429
            
            # Add current request
            rate_limit_storage[client_ip].append(current_time)
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator
