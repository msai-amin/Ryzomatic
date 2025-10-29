import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, User, CreditCard, LogOut, Volume2, Settings, Timer, 
  ChevronDown, ChevronUp, Crown, HardDrive, FileText, 
  Play, Pause, VolumeX, Monitor, Cloud, AlertCircle
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { timerService, TimerSettings } from '../services/timerService';
import { ttsManager } from '../services/ttsManager';

interface GeneralSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AccordionSection {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  content: React.ReactNode;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({ isOpen, onClose }) => {
  const { user, logout, tts, updateTTS, documents } = useAppStore();
  const [expandedSection, setExpandedSection] = useState<string>('account');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [timerSettings, setTimerSettings] = useState<TimerSettings>({
    workDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    sessionsUntilLongBreak: 4,
    autoStartBreaks: false,
    autoStartPomodoros: false,
    notificationsEnabled: true,
  });

  // Load timer settings from service
  useEffect(() => {
    const state = timerService.getState();
    setTimerSettings(state.settings);
  }, []);

  // Calculate usage stats
  const documentCount = documents.length;
  const storageUsed = documents.reduce((total, doc) => {
    // Estimate storage based on content length (rough approximation)
    return total + (doc.content?.length || 0) * 2; // 2 bytes per character estimate
  }, 0);
  const storageUsedMB = (storageUsed / (1024 * 1024)).toFixed(1);

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  const handleTTSUpdate = (updates: Partial<typeof tts>) => {
    updateTTS(updates);
    // Apply to TTS manager
    if (updates.rate !== undefined) ttsManager.setRate(updates.rate);
    if (updates.pitch !== undefined) ttsManager.setPitch(updates.pitch);
    if (updates.volume !== undefined) ttsManager.setVolume(updates.volume);
  };

  const handleTimerUpdate = (updates: Partial<TimerSettings>) => {
    const newSettings = { ...timerSettings, ...updates };
    setTimerSettings(newSettings);
    timerService.updateSettings(newSettings);
  };

  const handleVoicePreview = async () => {
    try {
      const currentProvider = ttsManager.getCurrentProvider();
      if (currentProvider && tts.voice) {
        currentProvider.stop();
        const previewText = "Hello! This is how I sound when reading your documents.";
        await currentProvider.speak(previewText, () => {
          console.log('Voice preview completed');
        });
      }
    } catch (error) {
      console.error('Error previewing voice:', error);
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? '' : sectionId);
  };

  if (!isOpen) return null;

  const sections: AccordionSection[] = [
    {
      id: 'account',
      title: 'Account',
      icon: User,
      content: (
        <div className="space-y-6">
          {/* Profile Info */}
          <div className="flex items-center space-x-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-background)' }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)' }}>
              <User className="w-6 h-6" style={{ color: 'var(--color-text-inverse)' }} />
            </div>
            <div>
              <div className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {user?.full_name || user?.email}
              </div>
              <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {user?.email}
              </div>
              {user?.tier && (
                <div className="flex items-center space-x-1 mt-1">
                  <Crown className="w-3 h-3" style={{ color: 'var(--color-primary)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>
                    {user.tier.toUpperCase()} Plan
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Usage Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-background)' }}>
              <div className="flex items-center space-x-2 mb-2">
                <FileText className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Documents
                </span>
              </div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {documentCount}
              </div>
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-background)' }}>
              <div className="flex items-center space-x-2 mb-2">
                <HardDrive className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Storage Used
                </span>
              </div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {storageUsedMB} MB
              </div>
            </div>
          </div>

          {/* Plan Management */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Plan Management
            </h4>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text-inverse)',
                }}
              >
                Upgrade Plan
              </button>
              <button
                onClick={() => setShowCancelModal(true)}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--color-surface-hover)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                }}
              >
                Cancel Plan
              </button>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Payment Methods
            </h4>
            <div className="p-4 rounded-lg text-center" style={{ backgroundColor: 'var(--color-background)' }}>
              <CreditCard className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-text-secondary)' }} />
              <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                No payment methods added
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                Payment methods will be available soon
              </div>
            </div>
          </div>

          {/* Sign Out */}
          <div className="pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: 'transparent',
                color: '#ef4444',
                border: '1px solid #ef4444',
              }}
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      ),
    },
    {
      id: 'audio',
      title: 'Audio & TTS',
      icon: Volume2,
      content: (
        <div className="space-y-6">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium mb-3" style={{ color: 'var(--color-text-primary)' }}>
              Voice Provider
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleTTSUpdate({ provider: 'native' })}
                className={`p-3 rounded-lg border-2 transition-all ${
                  tts.provider === 'native'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
                }`}
                style={{ backgroundColor: 'var(--color-surface)' }}
              >
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4" />
                  <div className="text-left">
                    <div className="font-medium text-sm">Native</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      Free, Offline
                    </div>
                  </div>
                </div>
              </button>
              <button
                onClick={() => handleTTSUpdate({ provider: 'google-cloud' })}
                className={`p-3 rounded-lg border-2 transition-all ${
                  tts.provider === 'google-cloud'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
                }`}
                style={{ backgroundColor: 'var(--color-surface)' }}
              >
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4" />
                  <div className="text-left">
                    <div className="font-medium text-sm">Google Cloud</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      Premium, Online
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Voice Settings */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Speed: {tts.rate}x
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={tts.rate}
                onChange={(e) => handleTTSUpdate({ rate: Number(e.target.value) })}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{ backgroundColor: 'var(--color-border)' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Pitch: {tts.pitch}
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={tts.pitch}
                onChange={(e) => handleTTSUpdate({ pitch: Number(e.target.value) })}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{ backgroundColor: 'var(--color-border)' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Volume: {Math.round(tts.volume * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={tts.volume}
                onChange={(e) => handleTTSUpdate({ volume: Number(e.target.value) })}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{ backgroundColor: 'var(--color-border)' }}
              />
            </div>
          </div>

          {/* TTS Options */}
          <div className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={tts.highlightCurrentWord}
                onChange={(e) => handleTTSUpdate({ highlightCurrentWord: e.target.checked })}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                Highlight current word
              </span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={tts.autoAdvanceParagraph}
                onChange={(e) => handleTTSUpdate({ autoAdvanceParagraph: e.target.checked })}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                Auto-advance paragraphs
              </span>
            </label>
          </div>

          {/* Voice Preview */}
          <div>
            <button
              onClick={handleVoicePreview}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-inverse)',
              }}
            >
              <Play className="w-4 h-4" />
              <span>Preview Voice</span>
            </button>
          </div>
        </div>
      ),
    },
    {
      id: 'pomodoro',
      title: 'Pomodoro Timer',
      icon: Timer,
      content: (
        <div className="space-y-6">
          {/* Duration Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Work Duration (minutes)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={timerSettings.workDuration}
                onChange={(e) => handleTimerUpdate({ workDuration: parseInt(e.target.value) || 25 })}
                className="w-full px-3 py-2 rounded-lg border"
                style={{
                  backgroundColor: 'var(--color-background)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Short Break (minutes)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={timerSettings.shortBreakDuration}
                onChange={(e) => handleTimerUpdate({ shortBreakDuration: parseInt(e.target.value) || 5 })}
                className="w-full px-3 py-2 rounded-lg border"
                style={{
                  backgroundColor: 'var(--color-background)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Long Break (minutes)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={timerSettings.longBreakDuration}
                onChange={(e) => handleTimerUpdate({ longBreakDuration: parseInt(e.target.value) || 15 })}
                className="w-full px-3 py-2 rounded-lg border"
                style={{
                  backgroundColor: 'var(--color-background)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Sessions Until Long Break
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={timerSettings.sessionsUntilLongBreak}
                onChange={(e) => handleTimerUpdate({ sessionsUntilLongBreak: parseInt(e.target.value) || 4 })}
                className="w-full px-3 py-2 rounded-lg border"
                style={{
                  backgroundColor: 'var(--color-background)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>
          </div>

          {/* Behavior Settings */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Behavior
            </h4>
            
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={timerSettings.autoStartBreaks}
                onChange={(e) => handleTimerUpdate({ autoStartBreaks: e.target.checked })}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                Auto-start breaks
              </span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={timerSettings.autoStartPomodoros}
                onChange={(e) => handleTimerUpdate({ autoStartPomodoros: e.target.checked })}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                Auto-start pomodoros
              </span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={timerSettings.notificationsEnabled}
                onChange={(e) => handleTimerUpdate({ notificationsEnabled: e.target.checked })}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                Enable notifications
              </span>
            </label>
          </div>
        </div>
      ),
    },
  ];

  return createPortal(
    <div 
      className="fixed inset-0 flex items-center justify-center z-[9999] pt-20 pb-8 px-4 overflow-y-auto" 
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
    >
      <div 
        className="rounded-xl shadow-xl max-w-2xl w-full mx-4 animate-scale-in my-auto" 
        style={{ 
          backgroundColor: 'var(--color-surface)', 
          border: '1px solid var(--color-border)' 
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Settings
          </h2>
          <button
            onClick={onClose}
            className="transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-2">
            {sections.map((section) => {
              const Icon = section.icon;
              const isExpanded = expandedSection === section.id;
              
              return (
                <div key={section.id} className="border rounded-lg" style={{ borderColor: 'var(--color-border)' }}>
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between p-4 text-left transition-colors"
                    style={{ 
                      backgroundColor: isExpanded ? 'var(--color-surface-hover)' : 'transparent',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{section.title}</span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>
                  
                  {isExpanded && (
                    <div className="px-4 pb-4">
                      {section.content}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Placeholder Modals */}
      {showUpgradeModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[10000]" style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <AlertCircle className="w-6 h-6 text-blue-500" />
              <h3 className="text-lg font-semibold">Payment Integration Coming Soon!</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              We're working on integrating payment processing. You'll be able to upgrade your plan soon!
            </p>
            <button
              onClick={() => setShowUpgradeModal(false)}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[10000]" style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <AlertCircle className="w-6 h-6 text-orange-500" />
              <h3 className="text-lg font-semibold">Contact Support to Cancel</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              To cancel your plan, please contact our support team. They'll help you with the cancellation process.
            </p>
            <button
              onClick={() => setShowCancelModal(false)}
              className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
