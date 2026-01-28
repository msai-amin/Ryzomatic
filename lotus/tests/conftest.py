"""
Pytest fixtures for LOTUS tests.
"""
import pytest
from unittest.mock import MagicMock, patch


@pytest.fixture
def sample_documents():
    """Sample documents for testing synthesis."""
    return [
        {
            "id": "doc-1",
            "title": "Machine Learning Paper",
            "content": "Machine learning algorithms have revolutionized data analysis. "
                       "Key findings include improved accuracy with neural networks."
        },
        {
            "id": "doc-2",
            "title": "Natural Language Processing Paper",
            "content": "Natural language processing enables computers to understand human language. "
                       "Transformer architectures have become the dominant approach."
        },
        {
            "id": "doc-3",
            "title": "Artificial Intelligence Paper",
            "content": "Artificial intelligence encompasses machine learning and other techniques. "
                       "Recent advances focus on large language models and their applications."
        },
    ]


@pytest.fixture
def single_document():
    """Single document for edge case testing."""
    return [
        {
            "id": "doc-single",
            "title": "Single Paper",
            "content": "This is the only document content for single document testing."
        }
    ]


@pytest.fixture
def empty_documents():
    """Empty document list for edge case testing."""
    return []


@pytest.fixture
def documents_missing_content():
    """Documents missing the content field."""
    return [
        {"id": "doc-1", "title": "Paper without content"},
        {"id": "doc-2", "title": "Another paper without content"},
    ]


@pytest.fixture
def mock_lm():
    """Mock LOTUS LM class."""
    with patch('lotus.models.LM') as mock:
        mock_instance = MagicMock()
        mock.return_value = mock_instance
        yield mock


@pytest.fixture
def mock_lotus_settings():
    """Mock LOTUS settings.configure."""
    with patch('lotus.settings.configure') as mock:
        yield mock


@pytest.fixture
def mock_sem_agg():
    """Mock pandas DataFrame.sem_agg method."""
    with patch('pandas.DataFrame.sem_agg') as mock:
        mock.return_value = "Synthesized result: The papers discuss machine learning, " \
                            "NLP, and AI advances. Key themes include neural networks " \
                            "and transformer architectures."
        yield mock


@pytest.fixture
def mock_sem_agg_dataframe():
    """Mock sem_agg that returns a DataFrame."""
    import pandas as pd
    with patch('pandas.DataFrame.sem_agg') as mock:
        result_df = pd.DataFrame([["Synthesis result from DataFrame"]])
        mock.return_value = result_df
        yield mock


@pytest.fixture
def mock_sem_agg_error():
    """Mock sem_agg that raises an exception."""
    with patch('pandas.DataFrame.sem_agg') as mock:
        mock.side_effect = Exception("LOTUS sem_agg failed")
        yield mock


@pytest.fixture
def mock_env_lotus_model(monkeypatch):
    """Set LOTUS_MODEL environment variable."""
    monkeypatch.setenv('LOTUS_MODEL', 'gpt-4o-mini')


@pytest.fixture
def mock_env_no_lotus_model(monkeypatch):
    """Ensure LOTUS_MODEL environment variable is not set."""
    monkeypatch.delenv('LOTUS_MODEL', raising=False)
