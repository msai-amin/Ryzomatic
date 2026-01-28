"""
Vercel Python serverless function for LOTUS document synthesis.

This endpoint receives document data and a query, then uses LOTUS sem_agg
to synthesize insights across multiple documents.
"""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler
from typing import Dict, List, Any

# For Vercel, we need to inline the LOTUS service or use a different approach
# Since Vercel Python functions are isolated, we'll inline the core logic
try:
    import pandas as pd
    import lotus
    from lotus.models import LM
except ImportError:
    # If LOTUS is not available, provide a fallback
    pd = None
    lotus = None
    LM = None


class handler(BaseHTTPRequestHandler):
    """Vercel Python function handler."""
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
    
    def do_POST(self):
        """Handle POST requests for document synthesis."""
        try:
            # Read request body
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self._send_error(400, "Request body is required")
                return
            
            body_data = self.rfile.read(content_length)
            body = json.loads(body_data.decode('utf-8'))
            
            # Validate request
            documents = body.get('documents')
            query = body.get('query')
            
            if not documents:
                self._send_error(400, "documents array is required")
                return
            
            if not query:
                self._send_error(400, "query string is required")
                return
            
            if not isinstance(documents, list) or len(documents) == 0:
                self._send_error(400, "documents must be a non-empty array")
                return
            
            # Validate document structure
            for doc in documents:
                if not isinstance(doc, dict) or 'content' not in doc:
                    self._send_error(400, "Each document must have 'content' field")
                    return
            
            # Get model from env or request
            model = body.get('model') or os.getenv('LOTUS_MODEL', 'gpt-4o-mini')
            
            # Perform synthesis using LOTUS
            if not pd or not lotus or not LM:
                raise Exception("LOTUS dependencies not available. Ensure lotus-ai and pandas are in requirements.txt")
            
            # Initialize LOTUS
            lm = LM(model=model)
            lotus.settings.configure(lm=lm)
            
            # Create DataFrame from documents
            df = pd.DataFrame(documents)
            
            # Build semantic aggregation prompt
            langex = (
                f"Synthesize the key findings from {{content}} that relate to: {query}. "
                "Provide a comprehensive literature review that:\n"
                "1. Identifies common themes and patterns across the documents\n"
                "2. Highlights key findings and methodologies\n"
                "3. Notes any contradictions or complementary insights\n"
                "4. Cites specific document titles when referencing findings\n"
                "5. Organizes the synthesis in a logical, coherent structure"
            )
            
            # Perform semantic aggregation
            result = df.sem_agg(langex)
            
            # Convert result to string if needed
            if isinstance(result, pd.DataFrame):
                if len(result) > 0:
                    result = str(result.iloc[0, 0]) if len(result.columns) > 0 else str(result)
                else:
                    result = "No synthesis could be generated."
            elif not isinstance(result, str):
                result = str(result)
            
            # Send success response
            self._send_json(200, {
                'synthesis': result,
                'model': model,
                'document_count': len(documents)
            })
            
        except json.JSONDecodeError:
            self._send_error(400, "Invalid JSON in request body")
        except Exception as e:
            error_msg = str(e)
            print(f"Error in LOTUS synthesis: {error_msg}", file=sys.stderr)
            self._send_error(500, f"Internal server error: {error_msg}")
    
    def _send_json(self, status_code: int, data: Dict[str, Any]):
        """Send JSON response."""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
    
    def _send_error(self, status_code: int, message: str):
        """Send error response."""
        self._send_json(status_code, {'error': message})
    
    def log_message(self, format, *args):
        """Override to prevent default logging."""
        # Vercel handles logging, so we suppress default HTTP server logs
        pass
