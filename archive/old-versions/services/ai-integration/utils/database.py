from pymongo import MongoClient
import os
import logging

logger = logging.getLogger(__name__)

def get_database():
    """Get database connection"""
    try:
        client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017/'))
        return client['smart-reader']
    except Exception as e:
        logger.error(f"Database connection error: {str(e)}")
        raise e

def get_redis_client():
    """Get Redis client"""
    try:
        import redis
        return redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379'))
    except Exception as e:
        logger.error(f"Redis connection error: {str(e)}")
        raise e
