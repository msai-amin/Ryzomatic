"""
LOTUS Document Synthesis Service

Provides semantic aggregation across multiple documents using LOTUS sem_agg operator.
"""
import pandas as pd
import lotus
from lotus.models import LM
from typing import List, Dict, Optional
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class DocumentSynthesizer:
    """Synthesize insights across multiple documents using LOTUS semantic operators."""
    
    def __init__(self, model: str = "gpt-4o-mini"):
        """
        Initialize the synthesizer with a language model.
        
        Args:
            model: Model name supported by LiteLLM (default: gpt-4o-mini)
        """
        self.lm = LM(model=model)
        lotus.settings.configure(lm=self.lm)
        self.model_name = model
    
    def synthesize_documents(
        self, 
        documents: List[Dict[str, str]], 
        query: str,
        max_tokens: Optional[int] = None
    ) -> str:
        """
        Use sem_agg to synthesize insights across multiple documents.
        
        Args:
            documents: List of document dicts with keys: id, title, content
            query: The research question or topic to synthesize around
            max_tokens: Optional max tokens for the synthesis
            
        Returns:
            Synthesized literature review text
        """
        if not documents:
            return "No documents provided for synthesis."
        
        # Create DataFrame from documents
        df = pd.DataFrame(documents)
        
        # Ensure required columns exist
        if 'content' not in df.columns:
            raise ValueError("Documents must have 'content' field")
        
        # Build the semantic aggregation prompt
        # The {content} placeholder will be replaced by LOTUS with each document's content
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
        try:
            result = df.sem_agg(langex)
            
            # If result is a DataFrame, extract the text
            if isinstance(result, pd.DataFrame):
                # sem_agg typically returns a single aggregated value
                if len(result) > 0:
                    # Try to get the first column's value
                    result = str(result.iloc[0, 0]) if len(result.columns) > 0 else str(result)
                else:
                    result = "No synthesis could be generated."
            elif not isinstance(result, str):
                result = str(result)
            
            return result
        except Exception as e:
            return f"Error during synthesis: {str(e)}"
    
    def get_usage_stats(self) -> Dict:
        """Get LM usage statistics."""
        return {
            "model": self.model_name,
            "total_usage": self.lm.print_total_usage() if hasattr(self.lm, 'print_total_usage') else None
        }


def create_synthesizer(model: Optional[str] = None) -> DocumentSynthesizer:
    """
    Factory function to create a DocumentSynthesizer.
    
    Args:
        model: Optional model name (defaults to gpt-4o-mini or env var)
        
    Returns:
        DocumentSynthesizer instance
    """
    model_name = model or os.getenv('LOTUS_MODEL', 'gpt-4o-mini')
    return DocumentSynthesizer(model=model_name)
