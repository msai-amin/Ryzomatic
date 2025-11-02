import React from 'react';
import { Brain, FileText, Mic, Sparkles, Zap, BookOpen } from 'lucide-react';

export type LoaderContext = 
  | 'document-comparison'
  | 'tts-preparation'
  | 'ocr-processing'
  | 'ai-insights'
  | 'embedding-generation'
  | 'text-cleanup';

interface AIProcessingLoaderProps {
  context: LoaderContext;
  message?: string;
  progress?: number;
  className?: string;
}

const loaderConfig = {
  'document-comparison': {
    icon: Brain,
    color: '#8B5CF6',
    gradient: 'from-purple-500 to-pink-500',
    defaultMessage: 'Analyzing document relationships...',
    subMessage: 'Comparing themes, topics, and content',
  },
  'tts-preparation': {
    icon: Mic,
    color: '#3B82F6',
    gradient: 'from-blue-500 to-cyan-500',
    defaultMessage: 'Preparing text for audio...',
    subMessage: 'Extracting and optimizing content for natural speech',
  },
  'ocr-processing': {
    icon: FileText,
    color: '#F59E0B',
    gradient: 'from-amber-500 to-orange-500',
    defaultMessage: 'Extracting text from image...',
    subMessage: 'AI-powered optical character recognition in progress',
  },
  'ai-insights': {
    icon: Sparkles,
    color: '#10B981',
    gradient: 'from-emerald-500 to-teal-500',
    defaultMessage: 'Generating AI insights...',
    subMessage: 'Analyzing frameworks, context, and key concepts',
  },
  'embedding-generation': {
    icon: Zap,
    color: '#EC4899',
    gradient: 'from-pink-500 to-rose-500',
    defaultMessage: 'Creating semantic embeddings...',
    subMessage: 'Building vector representations for smart search',
  },
  'text-cleanup': {
    icon: BookOpen,
    color: '#6366F1',
    gradient: 'from-indigo-500 to-purple-500',
    defaultMessage: 'Cleaning text for reading...',
    subMessage: 'Removing artifacts and formatting for optimal readability',
  },
};

export const AIProcessingLoader: React.FC<AIProcessingLoaderProps> = ({
  context,
  message,
  progress,
  className = '',
}) => {
  const config = loaderConfig[context];
  const Icon = config.icon;

  return (
    <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
      {/* Animated icon with gradient background */}
      <div className="relative mb-6">
        {/* Pulsing background circles */}
        <div 
          className={`absolute inset-0 rounded-full bg-gradient-to-r ${config.gradient} opacity-20 animate-ping`}
          style={{ animationDuration: '2s' }}
        />
        <div 
          className={`absolute inset-0 rounded-full bg-gradient-to-r ${config.gradient} opacity-30 animate-pulse`}
        />
        
        {/* Icon container */}
        <div 
          className={`relative w-20 h-20 rounded-full bg-gradient-to-r ${config.gradient} flex items-center justify-center shadow-lg`}
        >
          <Icon className="w-10 h-10 text-white animate-pulse" />
        </div>
      </div>

      {/* Message */}
      <h3 
        className="text-lg font-semibold mb-2 text-center"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {message || config.defaultMessage}
      </h3>
      
      <p 
        className="text-sm text-center mb-6 max-w-md"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {config.subMessage}
      </p>

      {/* Progress bar (if progress is provided) */}
      {progress !== undefined && (
        <div className="w-full max-w-xs">
          <div 
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--color-border)' }}
          >
            <div
              className={`h-full bg-gradient-to-r ${config.gradient} transition-all duration-300 ease-out`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <p 
            className="text-xs text-center mt-2"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            {Math.round(progress)}% complete
          </p>
        </div>
      )}

      {/* Animated dots */}
      <div className="flex items-center gap-2 mt-4">
        <div 
          className="w-2 h-2 rounded-full animate-bounce"
          style={{ backgroundColor: config.color, animationDelay: '0ms' }}
        />
        <div 
          className="w-2 h-2 rounded-full animate-bounce"
          style={{ backgroundColor: config.color, animationDelay: '150ms' }}
        />
        <div 
          className="w-2 h-2 rounded-full animate-bounce"
          style={{ backgroundColor: config.color, animationDelay: '300ms' }}
        />
      </div>
    </div>
  );
};

