import requests
import sys

def health_check():
    """Health check for the AI integration service"""
    try:
        response = requests.get('http://localhost:3004/health', timeout=5)
        if response.status_code == 200:
            sys.exit(0)
        else:
            sys.exit(1)
    except Exception as e:
        print(f"Health check failed: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    health_check()
