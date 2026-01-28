"""
Vercel Python serverless function for Docling document processing.

This endpoint converts PDF, DOCX, PPTX, XLSX, HTML, and images to structured text
using the Docling library for superior document understanding.
"""
import json
import os
import sys
import base64
import tempfile
from http.server import BaseHTTPRequestHandler
from typing import Dict, Any, List, Optional

# Import Docling with fallback
try:
    from docling.document_converter import DocumentConverter
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    DOCLING_AVAILABLE = True
except ImportError:
    DocumentConverter = None
    InputFormat = None
    PdfPipelineOptions = None
    DOCLING_AVAILABLE = False


class handler(BaseHTTPRequestHandler):
    """Vercel Python function handler for Docling document conversion."""
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
    
    def do_POST(self):
        """Handle POST requests for document conversion."""
        tmp_path = None
        try:
            # Read request body
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self._send_error(400, "Request body is required")
                return
            
            body_data = self.rfile.read(content_length)
            body = json.loads(body_data.decode('utf-8'))
            
            # Validate request
            file_data_b64 = body.get('fileData')
            file_name = body.get('fileName', 'document.pdf')
            options = body.get('options', {})
            
            if not file_data_b64:
                self._send_error(400, "fileData (base64) is required")
                return
            
            # Check Docling availability
            if not DOCLING_AVAILABLE:
                self._send_error(503, "Docling is not available. Check requirements.txt installation.")
                return
            
            # Decode file data
            try:
                file_data = base64.b64decode(file_data_b64)
            except Exception as e:
                self._send_error(400, f"Invalid base64 file data: {str(e)}")
                return
            
            # Determine file extension and input format
            file_ext = file_name.lower().split('.')[-1] if '.' in file_name else 'pdf'
            input_format = self._get_input_format(file_ext)
            
            if input_format is None:
                self._send_error(400, f"Unsupported file type: .{file_ext}")
                return
            
            # Configure pipeline options
            pipeline_options = None
            if file_ext == 'pdf':
                pipeline_options = PdfPipelineOptions()
                pipeline_options.do_ocr = options.get('enableOcr', True)
                pipeline_options.do_table_structure = options.get('extractTables', True)
            
            # Create converter with appropriate settings
            converter_kwargs = {
                'allowed_formats': [input_format],
            }
            if pipeline_options:
                converter_kwargs['pdf_pipeline_options'] = pipeline_options
            
            converter = DocumentConverter(**converter_kwargs)
            
            # Write to temp file for processing
            suffix = f'.{file_ext}'
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(file_data)
                tmp_path = tmp.name
            
            # Convert the document
            result = converter.convert(tmp_path)
            doc = result.document
            
            # Extract content in multiple formats
            markdown_content = doc.export_to_markdown()
            text_content = doc.export_to_text() if hasattr(doc, 'export_to_text') else markdown_content
            
            # Count tables and figures
            table_count = 0
            figure_count = 0
            if hasattr(doc, 'tables'):
                table_count = len(doc.tables)
            if hasattr(doc, 'pictures'):
                figure_count = len(doc.pictures)
            
            # Extract page-by-page content if available
            pages_data: List[Dict[str, Any]] = []
            if hasattr(doc, 'pages') and doc.pages:
                for i, page in enumerate(doc.pages):
                    page_text = ''
                    if hasattr(page, 'export_to_text'):
                        page_text = page.export_to_text()
                    elif hasattr(page, 'text'):
                        page_text = page.text
                    else:
                        page_text = str(page)
                    
                    pages_data.append({
                        'pageNumber': i + 1,
                        'text': page_text,
                    })
            else:
                # If no page structure, treat entire document as one page
                pages_data.append({
                    'pageNumber': 1,
                    'text': text_content,
                })
            
            # Build response
            response_data = {
                'success': True,
                'markdown': markdown_content,
                'text': text_content,
                'metadata': {
                    'pageCount': len(pages_data),
                    'tables': table_count,
                    'figures': figure_count,
                    'fileType': file_ext,
                    'fileName': file_name,
                },
                'structure': {
                    'pages': pages_data,
                },
            }
            
            self._send_json(200, response_data)
            
        except json.JSONDecodeError:
            self._send_error(400, "Invalid JSON in request body")
        except Exception as e:
            error_msg = str(e)
            print(f"Error in Docling conversion: {error_msg}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            self._send_error(500, f"Document conversion failed: {error_msg}")
        finally:
            # Clean up temp file
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass
    
    def _get_input_format(self, file_ext: str) -> Optional[Any]:
        """Map file extension to Docling InputFormat."""
        if not InputFormat:
            return None
        
        format_map = {
            'pdf': InputFormat.PDF,
            'docx': InputFormat.DOCX,
            'pptx': InputFormat.PPTX,
            'xlsx': InputFormat.XLSX,
            'html': InputFormat.HTML,
            'htm': InputFormat.HTML,
            'png': InputFormat.IMAGE,
            'jpg': InputFormat.IMAGE,
            'jpeg': InputFormat.IMAGE,
            'tiff': InputFormat.IMAGE,
            'tif': InputFormat.IMAGE,
            'bmp': InputFormat.IMAGE,
        }
        
        return format_map.get(file_ext)
    
    def _send_json(self, status_code: int, data: Dict[str, Any]):
        """Send JSON response."""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
    
    def _send_error(self, status_code: int, message: str):
        """Send error response."""
        self._send_json(status_code, {'success': False, 'error': message})
    
    def log_message(self, format, *args):
        """Override to prevent default logging."""
        # Vercel handles logging, so we suppress default HTTP server logs
        pass
