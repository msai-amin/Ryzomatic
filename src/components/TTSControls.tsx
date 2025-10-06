import { useState, useEffect } from 'react';
import { useAppStore, Voice } from '../store/appStore';
import { ttsManager } from '../services/ttsManager';
import { TTSVoiceSelector } from './TTSVoiceSelector';
import { 
  Volume2, VolumeX, Play, Pause, Square, Settings, 
  ChevronDown, FastForward, Rewind, User, Users, X, Cloud, Monitor
} from 'lucide-react';

export function TTSControls() {
  const { tts, updateTTS } = useAppStore();
  const [showSettings, setShowSettings] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<any[]>([]);
  const [currentProvider, setCurrentProvider] = useState<any | null>(null);

  useEffect(() => {
    // Initialize providers
    const providers = ttsManager.getAvailableProviders();
    setAvailableProviders(providers);
    
    // Set current provider based on TTS settings
    const provider = providers.find(p => p.type === tts.provider) || providers[0];
    if (provider) {
      setCurrentProvider(provider);
      ttsManager.setProvider(provider.type as 'native' | 'google-cloud');
      updateTTS({ provider: provider.type as 'native' | 'google-cloud' });
    }
  }, []);

  const handleVoiceChange = async (voice: Voice) => {
    try {
      // Update the TTS manager with the new voice
      if (currentProvider) {
        currentProvider.setVoice(voice);
      }
      
      // Update the store
      updateTTS({ 
        voice: voice,
        voiceName: voice.name 
      });
      
      console.log('Voice changed to:', voice.name);
    } catch (error) {
      console.error('Error changing voice:', error);
    }
  };

  useEffect(() => {
    // Apply TTS settings when they change
    if (currentProvider) {
      if (tts.voice) {
        currentProvider.setVoice(tts.voice);
      }
      currentProvider.setRate(tts.rate);
      currentProvider.setPitch(tts.pitch);
      currentProvider.setVolume(tts.volume);
    }
  }, [tts.rate, tts.pitch, tts.volume, tts.voice, currentProvider]);


  const handleProviderChange = (providerType: 'native' | 'google-cloud') => {
    const provider = availableProviders.find(p => p.type === providerType);
    if (provider) {
      setCurrentProvider(provider);
      ttsManager.setProvider(providerType);
      updateTTS({ provider: providerType });
      // Clear voice selection to trigger reload
      updateTTS({ voice: null, voiceName: null });
    }
  };


  const handleRateChange = (value: number) => {
    updateTTS({ rate: value });
  };

  const handlePitchChange = (value: number) => {
    updateTTS({ pitch: value });
  };

  const handleVolumeChange = (value: number) => {
    updateTTS({ volume: value });
  };

  const handleSpeedPreset = (speed: number) => {
    updateTTS({ rate: speed });
  };

  if (availableProviders.length === 0) {
    return (
      <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
        <VolumeX className="w-4 h-4" />
        <span>No TTS providers available</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => updateTTS({ isEnabled: !tts.isEnabled })}
          className={`p-2 rounded-lg transition-colors ${
            tts.isEnabled
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
          title={tts.isEnabled ? 'Disable TTS' : 'Enable TTS'}
        >
          <Volume2 className="w-4 h-4" />
        </button>

        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          title="TTS Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Speed Presets */}
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => handleSpeedPreset(0.75)}
            className={`px-2 py-1 text-xs rounded ${
              tts.rate === 0.75
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            0.75x
          </button>
          <button
            onClick={() => handleSpeedPreset(1.0)}
            className={`px-2 py-1 text-xs rounded ${
              tts.rate === 1.0
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            1x
          </button>
          <button
            onClick={() => handleSpeedPreset(1.25)}
            className={`px-2 py-1 text-xs rounded ${
              tts.rate === 1.25
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            1.25x
          </button>
          <button
            onClick={() => handleSpeedPreset(1.5)}
            className={`px-2 py-1 text-xs rounded ${
              tts.rate === 1.5
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            1.5x
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="relative p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Close Button */}
          <button
            onClick={() => setShowSettings(false)}
            className="absolute top-2 right-2 p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors z-10"
            title="Close settings"
          >
            <X className="w-4 h-4" />
          </button>

          {/* TTS Provider Selection */}
          <div>
            <label className="block text-sm font-medium mb-3">TTS Provider</label>
            <div className="grid grid-cols-2 gap-2">
              {availableProviders.map((provider) => (
                <button
                  key={provider.type}
                  onClick={() => handleProviderChange(provider.type as 'native' | 'google-cloud')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    currentProvider?.type === provider.type
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-700 bg-white dark:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {provider.type === 'native' ? (
                      <Monitor className="w-4 h-4" />
                    ) : (
                      <Cloud className="w-4 h-4" />
                    )}
                    <div className="text-left">
                      <div className="font-medium text-sm">{provider.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {provider.type === 'native' ? 'Free, Offline' : 'Premium, Online'}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Voice Selection */}
          {currentProvider && (
            <div>
              <label className="block text-sm font-medium mb-3">
                Choose a Voice ({currentProvider.name})
              </label>
              <TTSVoiceSelector
                currentVoice={tts.voice}
                onVoiceChange={handleVoiceChange}
                disabled={tts.isPlaying}
              />
            </div>
          )}

          {/* Speed Slider */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Speed: {tts.rate.toFixed(2)}x
            </label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={tts.rate}
              onChange={(e) => handleRateChange(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Pitch Slider */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Pitch: {tts.pitch.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={tts.pitch}
              onChange={(e) => handlePitchChange(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Volume Slider */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Volume: {Math.round(tts.volume * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={tts.volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Highlight Current Word */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="highlight-word"
              checked={tts.highlightCurrentWord}
              onChange={(e) => updateTTS({ highlightCurrentWord: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="highlight-word" className="text-sm">
              Highlight current word while reading
            </label>
          </div>

          {/* Cost Estimation for Google Cloud TTS */}
          {currentProvider?.type === 'google-cloud' && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Google Cloud TTS Pricing:</strong> $4.00 per 1M characters
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                Typical document: ~$0.01-0.05 per reading
              </div>
            </div>
          )}

          {/* Done Button */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowSettings(false)}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}