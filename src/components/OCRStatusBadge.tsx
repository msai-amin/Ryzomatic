import React from 'react';
import { Loader, CheckCircle, XCircle, AlertTriangle, Sparkles, Ban } from 'lucide-react';

interface OCRStatusBadgeProps {
  status: 'not_needed' | 'pending' | 'processing' | 'completed' | 'failed' | 'user_declined';
  className?: string;
  showText?: boolean;
}

export const OCRStatusBadge: React.FC<OCRStatusBadgeProps> = ({ 
  status, 
  className = '', 
  showText = true 
}) => {
  const statusConfig = {
    not_needed: {
      icon: null,
      text: 'No OCR Needed',
      color: 'var(--color-text-secondary)',
      bgColor: 'transparent',
    },
    pending: {
      icon: AlertTriangle,
      text: 'OCR Available',
      color: '#F59E0B',
      bgColor: '#FEF3C7',
    },
    processing: {
      icon: Loader,
      text: 'Processing OCR...',
      color: 'var(--color-primary)',
      bgColor: 'var(--color-primary-light)',
      animate: true,
    },
    completed: {
      icon: CheckCircle,
      text: 'OCR Complete',
      color: '#10B981',
      bgColor: '#D1FAE5',
    },
    failed: {
      icon: XCircle,
      text: 'OCR Failed',
      color: '#EF4444',
      bgColor: '#FEE2E2',
    },
    user_declined: {
      icon: Ban,
      text: 'OCR Skipped',
      color: '#6B7280',
      bgColor: '#F3F4F6',
    },
  };

  const config = statusConfig[status];
  
  if (!config || status === 'not_needed') {
    return null;
  }

  const Icon = config.icon;

  return (
    <div 
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${className}`}
      style={{
        color: config.color,
        backgroundColor: config.bgColor,
        border: `1px solid ${config.color}20`,
      }}
    >
      {Icon && (
        <Icon 
          className={`w-3.5 h-3.5 ${'animate' in config && config.animate ? 'animate-spin' : ''}`} 
          style={{ color: config.color }}
        />
      )}
      {showText && <span>{config.text}</span>}
    </div>
  );
};

interface OCRBannerProps {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  onRetry?: () => void;
  onStartOCR?: () => void;
  errorMessage?: string;
}

export const OCRBanner: React.FC<OCRBannerProps> = ({ 
  status, 
  onRetry, 
  onStartOCR,
  errorMessage 
}) => {
  if (status === 'pending') {
    return (
      <div 
        className="flex items-start gap-3 p-4 rounded-lg border-l-4"
        style={{
          backgroundColor: '#FEF3C7',
          borderColor: '#F59E0B',
        }}
      >
        <Sparkles className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-yellow-900">
            Scanned Document Detected
          </p>
          <p className="text-xs text-yellow-700 mt-1">
            This document appears to be scanned. Use AI OCR to extract text and make it searchable.
          </p>
          {onStartOCR && (
            <button
              onClick={onStartOCR}
              className="mt-2 px-3 py-1.5 bg-yellow-600 text-white text-xs font-medium rounded-lg hover:bg-yellow-700 transition-colors"
            >
              Enable OCR
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === 'processing') {
    return (
      <div 
        className="flex items-start gap-3 p-4 rounded-lg border-l-4"
        style={{
          backgroundColor: 'var(--color-primary-light)',
          borderColor: 'var(--color-primary)',
        }}
      >
        <Loader className="w-5 h-5 animate-spin flex-shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} />
        <div className="flex-1">
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            AI OCR Processing
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Extracting text from your document. This may take a moment...
          </p>
        </div>
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div 
        className="flex items-start gap-3 p-4 rounded-lg border-l-4"
        style={{
          backgroundColor: '#D1FAE5',
          borderColor: '#10B981',
        }}
      >
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-green-900">
            OCR Complete
          </p>
          <p className="text-xs text-green-700 mt-1">
            Text has been successfully extracted and is now searchable.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div 
        className="flex items-start gap-3 p-4 rounded-lg border-l-4"
        style={{
          backgroundColor: '#FEE2E2',
          borderColor: '#EF4444',
        }}
      >
        <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-900">
            OCR Failed
          </p>
          <p className="text-xs text-red-700 mt-1">
            {errorMessage || 'Failed to extract text from document. You can try again.'}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry OCR
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
};

