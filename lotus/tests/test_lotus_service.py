"""
Unit tests for LOTUS document synthesis service.
"""
import pytest
from unittest.mock import patch, MagicMock
import pandas as pd
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestDocumentSynthesizerInit:
    """Tests for DocumentSynthesizer initialization."""

    def test_init_default_model(self, mock_lm, mock_lotus_settings):
        """Test initialization with default model."""
        from lotus_service import DocumentSynthesizer
        
        synthesizer = DocumentSynthesizer()
        
        mock_lm.assert_called_once_with(model="gpt-4o-mini")
        mock_lotus_settings.assert_called_once()
        assert synthesizer.model_name == "gpt-4o-mini"

    def test_init_custom_model(self, mock_lm, mock_lotus_settings):
        """Test initialization with custom model."""
        from lotus_service import DocumentSynthesizer
        
        synthesizer = DocumentSynthesizer(model="gpt-4o")
        
        mock_lm.assert_called_once_with(model="gpt-4o")
        assert synthesizer.model_name == "gpt-4o"


class TestSynthesizeDocuments:
    """Tests for synthesize_documents method."""

    def test_synthesize_empty_documents(self, mock_lm, mock_lotus_settings):
        """Test that empty document list returns appropriate message."""
        from lotus_service import DocumentSynthesizer
        
        synthesizer = DocumentSynthesizer()
        result = synthesizer.synthesize_documents([], "What are the key findings?")
        
        assert result == "No documents provided for synthesis."

    def test_synthesize_missing_content_field(self, mock_lm, mock_lotus_settings, documents_missing_content):
        """Test that documents without content field raise ValueError."""
        from lotus_service import DocumentSynthesizer
        
        synthesizer = DocumentSynthesizer()
        
        with pytest.raises(ValueError, match="Documents must have 'content' field"):
            synthesizer.synthesize_documents(documents_missing_content, "Summarize")

    def test_synthesize_single_document(self, mock_lm, mock_lotus_settings, mock_sem_agg, single_document):
        """Test synthesis with a single document."""
        from lotus_service import DocumentSynthesizer
        
        synthesizer = DocumentSynthesizer()
        result = synthesizer.synthesize_documents(single_document, "What is this about?")
        
        assert mock_sem_agg.called
        assert isinstance(result, str)
        assert len(result) > 0

    def test_synthesize_multiple_documents(self, mock_lm, mock_lotus_settings, mock_sem_agg, sample_documents):
        """Test synthesis with multiple documents."""
        from lotus_service import DocumentSynthesizer
        
        synthesizer = DocumentSynthesizer()
        result = synthesizer.synthesize_documents(
            sample_documents, 
            "What are the key findings across these papers?"
        )
        
        assert mock_sem_agg.called
        assert isinstance(result, str)
        assert "Synthesized" in result or len(result) > 0

    def test_synthesize_dataframe_result(self, mock_lm, mock_lotus_settings, mock_sem_agg_dataframe, sample_documents):
        """Test that DataFrame results are converted to string."""
        from lotus_service import DocumentSynthesizer
        
        synthesizer = DocumentSynthesizer()
        result = synthesizer.synthesize_documents(sample_documents, "Summarize")
        
        assert isinstance(result, str)
        assert "Synthesis result from DataFrame" in result

    def test_synthesize_error_handling(self, mock_lm, mock_lotus_settings, mock_sem_agg_error, sample_documents):
        """Test that exceptions are caught and returned as error messages."""
        from lotus_service import DocumentSynthesizer
        
        synthesizer = DocumentSynthesizer()
        result = synthesizer.synthesize_documents(sample_documents, "Summarize")
        
        assert "Error during synthesis" in result
        assert "LOTUS sem_agg failed" in result

    def test_synthesize_query_included_in_prompt(self, mock_lm, mock_lotus_settings, sample_documents):
        """Test that the query is included in the sem_agg prompt."""
        from lotus_service import DocumentSynthesizer
        
        with patch('pandas.DataFrame.sem_agg') as mock_agg:
            mock_agg.return_value = "Result"
            
            synthesizer = DocumentSynthesizer()
            synthesizer.synthesize_documents(sample_documents, "machine learning advances")
            
            # Check that sem_agg was called with a prompt containing the query
            call_args = mock_agg.call_args[0][0]
            assert "machine learning advances" in call_args


class TestGetUsageStats:
    """Tests for get_usage_stats method."""

    def test_get_usage_stats(self, mock_lm, mock_lotus_settings):
        """Test usage stats retrieval."""
        from lotus_service import DocumentSynthesizer
        
        synthesizer = DocumentSynthesizer()
        stats = synthesizer.get_usage_stats()
        
        assert "model" in stats
        assert stats["model"] == "gpt-4o-mini"
        assert "total_usage" in stats


class TestCreateSynthesizerFactory:
    """Tests for create_synthesizer factory function."""

    def test_factory_with_explicit_model(self, mock_lm, mock_lotus_settings):
        """Test factory function with explicit model parameter."""
        from lotus_service import create_synthesizer
        
        synthesizer = create_synthesizer(model="gpt-4o")
        
        mock_lm.assert_called_with(model="gpt-4o")
        assert synthesizer.model_name == "gpt-4o"

    def test_factory_with_env_var(self, mock_lm, mock_lotus_settings, mock_env_lotus_model):
        """Test factory function using LOTUS_MODEL env var."""
        from lotus_service import create_synthesizer
        
        synthesizer = create_synthesizer()
        
        mock_lm.assert_called_with(model="gpt-4o-mini")
        assert synthesizer.model_name == "gpt-4o-mini"

    def test_factory_default_fallback(self, mock_lm, mock_lotus_settings, mock_env_no_lotus_model):
        """Test factory function falls back to default when no env var."""
        from lotus_service import create_synthesizer
        
        synthesizer = create_synthesizer()
        
        # Should use default gpt-4o-mini
        mock_lm.assert_called_with(model="gpt-4o-mini")


class TestIntegrationScenarios:
    """Integration-style tests with realistic scenarios."""

    def test_literature_review_synthesis(self, mock_lm, mock_lotus_settings, mock_sem_agg, sample_documents):
        """Test a realistic literature review synthesis scenario."""
        from lotus_service import DocumentSynthesizer
        
        synthesizer = DocumentSynthesizer()
        result = synthesizer.synthesize_documents(
            sample_documents,
            "Compare and contrast the approaches to AI across these papers. "
            "Identify common themes and methodological differences."
        )
        
        assert isinstance(result, str)
        assert len(result) > 0

    def test_key_findings_extraction(self, mock_lm, mock_lotus_settings, sample_documents):
        """Test extracting key findings from multiple documents."""
        from lotus_service import DocumentSynthesizer
        
        with patch('pandas.DataFrame.sem_agg') as mock_agg:
            mock_agg.return_value = "Key findings: 1) Neural networks improve accuracy. " \
                                    "2) Transformers dominate NLP. 3) LLMs are advancing rapidly."
            
            synthesizer = DocumentSynthesizer()
            result = synthesizer.synthesize_documents(
                sample_documents,
                "Extract the key findings from each paper"
            )
            
            assert "Key findings" in result
            assert "Neural networks" in result
