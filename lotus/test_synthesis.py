"""
Test script for LOTUS document synthesis.

This script tests the sem_agg operator with sample documents from Supabase.
Run this locally to validate LOTUS integration before deploying.
"""
import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client
from lotus_service import DocumentSynthesizer

# Load environment variables
load_dotenv()

def get_supabase_client() -> Client:
    """Create Supabase client from environment variables."""
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_ANON_KEY')
    
    if not supabase_url or not supabase_key:
        raise ValueError(
            "Missing Supabase credentials. Set SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY in .env"
        )
    
    return create_client(supabase_url, supabase_key)


def fetch_document_content(supabase: Client, book_id: str, user_id: str) -> str:
    """
    Fetch full document content from document_content table.
    
    Args:
        supabase: Supabase client
        book_id: Document/book ID
        user_id: User ID
        
    Returns:
        Concatenated content from all chunks
    """
    # Fetch all chunks ordered by chunk_index
    response = supabase.table('document_content')\
        .select('content, chunk_index')\
        .eq('book_id', book_id)\
        .eq('user_id', user_id)\
        .order('chunk_index', ascending=True)\
        .execute()
    
    if not response.data:
        return ""
    
    # Concatenate chunks with double newline separator
    chunks = [chunk['content'] for chunk in sorted(response.data, key=lambda x: x['chunk_index'])]
    return '\n\n'.join(chunks)


def fetch_user_documents(supabase: Client, user_id: str, limit: int = 5) -> list:
    """
    Fetch user's documents with metadata.
    
    Args:
        supabase: Supabase client
        user_id: User ID
        limit: Maximum number of documents to fetch
        
    Returns:
        List of document dicts with id, title, and content
    """
    # Fetch document metadata
    books_response = supabase.table('user_books')\
        .select('id, title')\
        .eq('user_id', user_id)\
        .limit(limit)\
        .execute()
    
    if not books_response.data:
        print(f"No documents found for user {user_id}")
        return []
    
    documents = []
    for book in books_response.data:
        book_id = book['id']
        title = book.get('title', f'Document {book_id[:8]}')
        
        # Fetch content
        content = fetch_document_content(supabase, book_id, user_id)
        
        if content:
            documents.append({
                'id': book_id,
                'title': title,
                'content': content[:10000]  # Limit to first 10K chars per doc for testing
            })
    
    return documents


def main():
    """Main test function."""
    print("=" * 60)
    print("LOTUS Document Synthesis Test")
    print("=" * 60)
    
    # Check for required env vars
    if not os.getenv('SUPABASE_URL'):
        print("ERROR: SUPABASE_URL not set in environment")
        print("Create a .env file with your Supabase credentials")
        sys.exit(1)
    
    # Get test user ID from env or use a test value
    test_user_id = os.getenv('TEST_USER_ID')
    if not test_user_id:
        print("WARNING: TEST_USER_ID not set. Using placeholder.")
        print("Set TEST_USER_ID in .env to test with real data")
        test_user_id = "00000000-0000-0000-0000-000000000000"
    
    try:
        # Initialize Supabase client
        print("\n[1/4] Connecting to Supabase...")
        supabase = get_supabase_client()
        print("✓ Connected")
        
        # Fetch sample documents
        print("\n[2/4] Fetching user documents...")
        documents = fetch_user_documents(supabase, test_user_id, limit=3)
        
        if not documents:
            print("⚠ No documents found. Using sample documents for testing...")
            documents = [
                {
                    'id': 'sample-1',
                    'title': 'Sample Paper 1: Machine Learning',
                    'content': 'This paper discusses machine learning algorithms and their applications in natural language processing. Key findings include improved accuracy with transformer architectures.'
                },
                {
                    'id': 'sample-2',
                    'title': 'Sample Paper 2: Deep Learning',
                    'content': 'Deep learning models have shown remarkable performance in computer vision tasks. The paper explores convolutional neural networks and their optimization techniques.'
                },
                {
                    'id': 'sample-3',
                    'title': 'Sample Paper 3: NLP Advances',
                    'content': 'Recent advances in natural language processing focus on large language models. The research demonstrates significant improvements in downstream tasks through pre-training.'
                }
            ]
        else:
            print(f"✓ Found {len(documents)} documents")
        
        # Initialize synthesizer
        print("\n[3/4] Initializing LOTUS synthesizer...")
        model = os.getenv('LOTUS_MODEL', 'gpt-4o-mini')
        synthesizer = DocumentSynthesizer(model=model)
        print(f"✓ Initialized with model: {model}")
        
        # Test synthesis
        print("\n[4/4] Running synthesis...")
        query = "What are the key findings and methodologies across these papers?"
        
        print(f"\nQuery: {query}")
        print(f"Documents: {[doc['title'] for doc in documents]}")
        print("\n" + "-" * 60)
        print("SYNTHESIS RESULT:")
        print("-" * 60)
        
        result = synthesizer.synthesize_documents(documents, query)
        print(result)
        print("-" * 60)
        
        # Print usage stats
        print("\n✓ Synthesis complete!")
        print(f"\nModel: {synthesizer.model_name}")
        
    except Exception as e:
        print(f"\n✗ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
