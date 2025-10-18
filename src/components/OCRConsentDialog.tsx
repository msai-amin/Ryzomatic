import React, { useState } from 'react';
import { X, AlertTriangle, Sparkles, CheckCircle, Info } from 'lucide-react';
import { OCR_LIMITS } from '../../lib/gpt5nano';

interface OCRConsentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => void;
  onDecline: () => void;
  pageCount: number;
  estimatedCredits: number;
  userTier: string;
  remainingOCRs: number;
  userCredits: number;
}

export const OCRConsentDialog: React.FC<OCRConsentDialogProps> = ({
  isOpen,
  onClose,
  onApprove,
  onDecline,
  pageCount,
  estimatedCredits,
  userTier,
  remainingOCRs,
  userCredits,
}) => {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  if (!isOpen) return null;

  const tierConfig = OCR_LIMITS[userTier as keyof typeof OCR_LIMITS] || OCR_LIMITS.free;
  const ocrLimit = tierConfig.monthlyOCR;
  const ocrsRemaining = ocrLimit - remainingOCRs;
  const isEnterprise = userTier === 'enterprise';
  const canAfford = isEnterprise || userCredits >= estimatedCredits;
  const hasOCRsLeft = isEnterprise || ocrsRemaining > 0;

  const handleApprove = () => {
    if (dontAskAgain) {
      sessionStorage.setItem('ocr_auto_approve', 'true');
    }
    onApprove();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
            <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              AI OCR Required
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Warning/Info Banner */}
          <div 
            className="p-4 rounded-lg flex gap-3"
            style={{ 
              backgroundColor: canAfford && hasOCRsLeft ? 'var(--color-primary-light)' : '#FEF3C7',
              border: '1px solid',
              borderColor: canAfford && hasOCRsLeft ? 'var(--color-primary)' : '#F59E0B'
            }}
          >
            <AlertTriangle 
              className="w-5 h-5 flex-shrink-0 mt-0.5" 
              style={{ color: canAfford && hasOCRsLeft ? 'var(--color-primary)' : '#F59E0B' }}
            />
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                This document appears to be scanned or non-searchable
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                AI-powered OCR can extract text to make it searchable and readable.
              </p>
            </div>
          </div>

          {/* Document Info */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-secondary)' }}>Document Pages:</span>
              <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {pageCount} {pageCount === 1 ? 'page' : 'pages'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-secondary)' }}>OCR Cost:</span>
              <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {isEnterprise ? 'Free (Enterprise)' : `${estimatedCredits} ${estimatedCredits === 1 ? 'credit' : 'credits'}`}
              </span>
            </div>
          </div>

          {/* Tier-Specific Info */}
          {!isEnterprise && (
            <div 
              className="p-3 rounded-lg space-y-2"
              style={{ 
                backgroundColor: 'var(--color-background-secondary)',
                border: '1px solid var(--color-border)'
              }}
            >
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--color-text-secondary)' }}>Your Credits:</span>
                <span 
                  className="font-medium" 
                  style={{ color: canAfford ? 'var(--color-success)' : 'var(--color-error)' }}
                >
                  {userCredits} available
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--color-text-secondary)' }}>OCR Remaining This Month:</span>
                <span 
                  className="font-medium"
                  style={{ color: hasOCRsLeft ? 'var(--color-success)' : 'var(--color-error)' }}
                >
                  {ocrsRemaining} / {ocrLimit}
                </span>
              </div>
            </div>
          )}

          {/* Upgrade Prompt for Free Tier */}
          {userTier === 'free' && ocrsRemaining <= 2 && (
            <div 
              className="p-3 rounded-lg flex gap-2"
              style={{ backgroundColor: '#EFF6FF', border: '1px solid #3B82F6' }}
            >
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-blue-900">
                  Running low on OCR credits?
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Upgrade to Pro for 100 OCR extractions per month
                </p>
              </div>
            </div>
          )}

          {/* Error Messages */}
          {!canAfford && (
            <div 
              className="p-3 rounded-lg flex gap-2"
              style={{ backgroundColor: '#FEE2E2', border: '1px solid #EF4444' }}
            >
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-900">
                Insufficient credits. You need {estimatedCredits} credits but only have {userCredits}.
              </p>
            </div>
          )}

          {!hasOCRsLeft && (
            <div 
              className="p-3 rounded-lg flex gap-2"
              style={{ backgroundColor: '#FEE2E2', border: '1px solid #EF4444' }}
            >
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-900">
                Monthly OCR limit reached. Upgrade your plan or wait until next month.
              </p>
            </div>
          )}

          {/* Don't Ask Again Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dontAskAgain}
              onChange={(e) => setDontAskAgain(e.target.checked)}
              className="w-4 h-4 rounded"
              style={{ accentColor: 'var(--color-primary)' }}
            />
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Don't ask again this session
            </span>
          </label>
        </div>

        {/* Footer Actions */}
        <div 
          className="flex gap-3 p-6 border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <button
            onClick={handleApprove}
            disabled={!canAfford || !hasOCRsLeft}
            className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-inverse)',
            }}
          >
            {isEnterprise ? 'Process with OCR' : `Use OCR (${estimatedCredits} credit${estimatedCredits === 1 ? '' : 's'})`}
          </button>
          <button
            onClick={onDecline}
            className="px-4 py-2 rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            Skip OCR
          </button>
        </div>
      </div>
    </div>
  );
};

