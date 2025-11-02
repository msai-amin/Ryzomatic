/**
 * AI Insights Panel Component
 * Main panel that integrates all AI analysis features
 */

import React, { useState } from 'react';
import { 
  Brain, 
  Sparkles, 
  Network, 
  Calendar, 
  Loader2,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { FrameworkMapper } from './FrameworkMapper';
import { HistoricalTimeline } from './HistoricalTimeline';
import { 
  analyzeFrameworks, 
  TheoreticalFramework,
  FrameworkMapping 
} from '../../services/ai/frameworkMapperService';
import { 
  generateHistoricalContext,
  HistoricalContext 
} from '../../services/ai/historicalContextService';
import { AIProcessingLoader, LoaderContext } from '../loaders/AIProcessingLoader';

interface AIInsightsPanelProps {
  documentText: string;
  documentId?: string;
  author?: string;
  title?: string;
  year?: number;
  className?: string;
}

type AnalysisTab = 'frameworks' | 'historical' | 'insights';
type AnalysisStatus = 'idle' | 'loading' | 'success' | 'error';

export const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({
  documentText,
  documentId,
  author,
  title,
  year,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<AnalysisTab>('frameworks');
  const [frameworkStatus, setFrameworkStatus] = useState<AnalysisStatus>('idle');
  const [contextStatus, setContextStatus] = useState<AnalysisStatus>('idle');
  
  const [frameworkData, setFrameworkData] = useState<FrameworkMapping | null>(null);
  const [contextData, setContextData] = useState<HistoricalContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Analyze frameworks
  const handleAnalyzeFrameworks = async () => {
    if (!documentText) {
      setError('No document text available');
      return;
    }

    setFrameworkStatus('loading');
    setError(null);

    try {
      const result = await analyzeFrameworks(documentText, documentId);
      setFrameworkData(result);
      setFrameworkStatus('success');
    } catch (err) {
      console.error('Framework analysis error:', err);
      setError('Failed to analyze frameworks. Please try again.');
      setFrameworkStatus('error');
    }
  };

  // Generate historical context
  const handleGenerateContext = async () => {
    if (!author) {
      setError('Author information is required for historical context');
      return;
    }

    setContextStatus('loading');
    setError(null);

    try {
      const result = await generateHistoricalContext(author, title, year);
      setContextData(result);
      setContextStatus('success');
    } catch (err) {
      console.error('Historical context error:', err);
      setError('Failed to generate historical context. Please try again.');
      setContextStatus('error');
    }
  };

  // Run all analyses
  const handleAnalyzeAll = async () => {
    await handleAnalyzeFrameworks();
    if (author) {
      await handleGenerateContext();
    }
  };

  return (
    <div className={`ai-insights-panel bg-white rounded-lg shadow-xl ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">
              AI Insights
            </h2>
            <Sparkles className="w-5 h-5 text-yellow-500" />
          </div>
          <button
            onClick={handleAnalyzeAll}
            disabled={!documentText || frameworkStatus === 'loading' || contextStatus === 'loading'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {(frameworkStatus === 'loading' || contextStatus === 'loading') ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4" />
                Analyze All
              </>
            )}
          </button>
        </div>

        {/* Status indicators */}
        <div className="flex gap-3 text-sm">
          <StatusBadge 
            label="Frameworks" 
            status={frameworkStatus} 
            count={frameworkData?.frameworks.length}
          />
          <StatusBadge 
            label="Historical Context" 
            status={contextStatus} 
            count={contextData?.events.length}
          />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 border-b border-red-200 flex items-center gap-2 text-red-800">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <TabButton
          icon={Network}
          label="Frameworks"
          active={activeTab === 'frameworks'}
          onClick={() => setActiveTab('frameworks')}
          count={frameworkData?.frameworks.length}
        />
        <TabButton
          icon={Calendar}
          label="Historical Context"
          active={activeTab === 'historical'}
          onClick={() => setActiveTab('historical')}
          count={contextData?.events.length}
        />
        <TabButton
          icon={Sparkles}
          label="Insights"
          active={activeTab === 'insights'}
          onClick={() => setActiveTab('insights')}
        />
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Frameworks Tab */}
        {activeTab === 'frameworks' && (
          <div>
            {frameworkStatus === 'idle' && (
              <EmptyState
                title="Framework Analysis"
                description="Identify theoretical frameworks, methodologies, and key concepts in your document"
                action={handleAnalyzeFrameworks}
                actionLabel="Analyze Frameworks"
                disabled={!documentText}
              />
            )}
            
            {frameworkStatus === 'loading' && (
              <LoadingState message="Analyzing theoretical frameworks..." context="ai-insights" />
            )}
            
            {frameworkStatus === 'success' && frameworkData && (
              <FrameworkMapper
                frameworks={frameworkData.frameworks}
                relationships={frameworkData.relationships}
                visualizationData={frameworkData.visualizationData}
              />
            )}
          </div>
        )}

        {/* Historical Context Tab */}
        {activeTab === 'historical' && (
          <div>
            {contextStatus === 'idle' && (
              <EmptyState
                title="Historical Context"
                description="Get historical, cultural, and intellectual context for your document"
                action={handleGenerateContext}
                actionLabel="Generate Context"
                disabled={!author}
              />
            )}
            
            {contextStatus === 'loading' && (
              <LoadingState message="Generating historical context..." context="ai-insights" />
            )}
            
            {contextStatus === 'success' && contextData && (
              <HistoricalTimeline context={contextData} />
            )}
          </div>
        )}

        {/* Insights Tab */}
        {activeTab === 'insights' && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">AI Analysis Summary</h3>
              
              {frameworkData && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-800 mb-1">Frameworks Identified</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Found {frameworkData.frameworks.length} theoretical frameworks in 
                    {' '}{frameworkData.metadata.processingTime}ms
                  </p>
                  <ul className="list-disc list-inside text-sm text-gray-700">
                    {frameworkData.frameworks.slice(0, 5).map((fw, idx) => (
                      <li key={idx}>
                        <strong>{fw.name}</strong> by {fw.author}
                        {' '}({(fw.confidence * 100).toFixed(0)}% confidence)
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {contextData && (
                <div>
                  <h4 className="font-medium text-gray-800 mb-1">Historical Context</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    {contextData.summary}
                  </p>
                  <p className="text-sm text-gray-700">
                    <strong>Period:</strong> {contextData.period}
                  </p>
                  <p className="text-sm text-gray-700">
                    <strong>Movement:</strong> {contextData.intellectualMovement}
                  </p>
                </div>
              )}

              {!frameworkData && !contextData && (
                <p className="text-sm text-gray-600">
                  Run analysis to see AI-generated insights
                </p>
              )}
            </div>

            {frameworkData?.suggestions && frameworkData.suggestions.length > 0 && (
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">Suggestions</h4>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {frameworkData.suggestions.map((suggestion, idx) => (
                    <li key={idx}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Helper components
const TabButton: React.FC<{
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}> = ({ icon: Icon, label, active, onClick, count }) => (
  <button
    onClick={onClick}
    className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-colors ${
      active
        ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
        : 'text-gray-600 hover:bg-gray-50'
    }`}
  >
    <Icon className="w-4 h-4" />
    <span className="font-medium">{label}</span>
    {count !== undefined && count > 0 && (
      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
        {count}
      </span>
    )}
  </button>
);

const StatusBadge: React.FC<{
  label: string;
  status: AnalysisStatus;
  count?: number;
}> = ({ label, status, count }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'loading': return 'bg-yellow-100 text-yellow-800';
      case 'success': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'loading': return <Loader2 className="w-3 h-3 animate-spin" />;
      case 'success': return <CheckCircle className="w-3 h-3" />;
      case 'error': return <AlertCircle className="w-3 h-3" />;
      default: return null;
    }
  };

  return (
    <div className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${getStatusColor()}`}>
      {getStatusIcon()}
      <span>{label}</span>
      {status === 'success' && count !== undefined && (
        <span className="font-semibold">({count})</span>
      )}
    </div>
  );
};

const EmptyState: React.FC<{
  title: string;
  description: string;
  action: () => void;
  actionLabel: string;
  disabled?: boolean;
}> = ({ title, description, action, actionLabel, disabled }) => (
  <div className="text-center py-12">
    <Brain className="w-16 h-16 mx-auto mb-4 text-gray-400" />
    <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
    <p className="text-gray-600 mb-4 max-w-md mx-auto">{description}</p>
    <button
      onClick={action}
      disabled={disabled}
      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
    >
      {actionLabel}
    </button>
  </div>
);

const LoadingState: React.FC<{ message: string; context: LoaderContext }> = ({ message, context }) => (
  <div className="py-8">
    <AIProcessingLoader 
      context={context}
      message={message}
    />
  </div>
);

