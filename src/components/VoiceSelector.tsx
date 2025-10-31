import React, { useState, useEffect } from 'react';
import { Volume2, Play, Pause, Check } from 'lucide-react';
import { ttsManager } from '../services/ttsManager';
import { Voice as StoreVoice, useAppStore } from '../store/appStore';

interface Voice {
  name: string;
  lang: string;
  gender: 'male' | 'female' | 'unknown';
  voiceURI: string;
  localService: boolean;
  languageCode?: string;
}

interface VoiceSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onVoiceSelect: (voice: Voice) => void;
  currentVoice?: StoreVoice | null;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  isOpen,
  onClose,
  onVoiceSelect,
  currentVoice
}) => {
  const { tts, updateTTS } = useAppStore();
  const [voices, setVoices] = useState<Voice[]>([]);
  const [naturalVoices, setNaturalVoices] = useState<{ female: Voice[]; male: Voice[] }>({ female: [], male: [] });
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewText, setPreviewText] = useState("Hello! I'm here to help you find the perfect voice for reading. This is a natural conversation that will help you evaluate how I sound. I hope you find a voice that feels comfortable and pleasant to listen to.");

  useEffect(() => {
    if (isOpen) {
      loadVoices();
    }
  }, [isOpen]);

  const loadVoices = async () => {
    setIsLoading(true);
    try {
      // Check TTS provider status
      const providers = ttsManager.getProviders();
      const availableProviders = ttsManager.getAvailableProviders();
      const configuredProviders = ttsManager.getConfiguredProviders();
      const currentProvider = ttsManager.getCurrentProvider();
      
      console.log('TTS Provider Status:', {
        allProviders: providers.map(p => ({ name: p.name, type: p.type, available: p.isAvailable, configured: p.isConfigured })),
        availableProviders: availableProviders.map(p => ({ name: p.name, type: p.type })),
        configuredProviders: configuredProviders.map(p => ({ name: p.name, type: p.type })),
        currentProvider: currentProvider ? { name: currentProvider.name, type: currentProvider.type } : null
      });
      
      const allVoices = await ttsManager.getVoices();
      console.log('Loaded voices:', allVoices.length);
      
      // Convert to our Voice interface
      const convertedVoices: Voice[] = allVoices.map(voice => ({
        name: voice.name,
        lang: voice.lang,
        gender: determineGender(voice.name),
        voiceURI: voice.voiceURI,
        localService: voice.localService
      }));

      setVoices(convertedVoices);

      // Filter voices for natural-sounding ones
      const naturalVoices = convertedVoices.filter(voice => {
        const lowerName = voice.name.toLowerCase();
        const quality = getVoiceQuality(voice);
        
        // Include premium and high quality voices
        if (quality === 'premium' || quality === 'high') {
          return true;
        }
        
        // Include voices that sound natural based on name patterns
        if (lowerName.includes('natural') ||
            lowerName.includes('human') ||
            lowerName.includes('realistic') ||
            lowerName.includes('clear') ||
            lowerName.includes('smooth') ||
            lowerName.includes('pleasant') ||
            lowerName.includes('warm') ||
            lowerName.includes('friendly')) {
          return true;
        }
        
        // Exclude obviously robotic voices
        if (lowerName.includes('robotic') ||
            lowerName.includes('synthetic') ||
            lowerName.includes('mechanical') ||
            lowerName.includes('artificial') ||
            lowerName.includes('computer') ||
            lowerName.includes('system')) {
          return false;
        }
        
        // Include local service voices (usually better quality)
        return voice.localService;
      });
      
      const naturalConverted = {
        female: naturalVoices.filter(voice => voice.gender === 'female'),
        male: naturalVoices.filter(voice => voice.gender === 'male')
      };

      setNaturalVoices(naturalConverted);
      console.log('Natural voices loaded:', naturalConverted);
      
      // Auto-select the most natural voice if none is selected
      if (!selectedVoice && naturalVoices.length > 0) {
        // Prioritize Google Cloud voices (neural/studio), then premium, then high quality
        const bestVoice = naturalVoices.find(v => v.name.toLowerCase().includes('neural')) ||
                         naturalVoices.find(v => v.name.toLowerCase().includes('studio')) ||
                         naturalVoices.find(v => v.name.toLowerCase().includes('wavenet')) ||
                         naturalVoices.find(v => getVoiceQuality(v) === 'premium') ||
                         naturalVoices.find(v => getVoiceQuality(v) === 'high') ||
                         naturalVoices.find(v => v.localService) ||
                         naturalVoices[0];
        
        if (bestVoice) {
          setSelectedVoice(bestVoice);
          console.log('Auto-selected best natural voice:', bestVoice.name);
        }
      }
    } catch (error) {
      console.error('Error loading voices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const determineGender = (voiceName: string): 'male' | 'female' | 'unknown' => {
    const lowerName = voiceName.toLowerCase();
    
    const femaleKeywords = [
      'female', 'woman', 'samantha', 'karen', 'moira', 'tessa', 
      'fiona', 'alice', 'victoria', 'zira', 'susan', 'linda',
      'heather', 'serena', 'aria', 'emma', 'ava', 'ella', 'sarah',
      'jessica', 'amanda', 'jennifer', 'michelle', 'lisa', 'maria',
      'anna', 'sophia', 'isabella', 'charlotte', 'olivia', 'amelia'
    ];
    
    const maleKeywords = [
      'male', 'man', 'daniel', 'oliver', 'tom', 'alex', 'fred',
      'james', 'david', 'mark', 'george', 'rishi', 'thomas', 'john',
      'michael', 'william', 'richard', 'charles', 'joseph', 'christopher',
      'matthew', 'anthony', 'donald', 'steven', 'paul', 'andrew'
    ];

    if (femaleKeywords.some(keyword => lowerName.includes(keyword))) {
      return 'female';
    } else if (maleKeywords.some(keyword => lowerName.includes(keyword))) {
      return 'male';
    }
    
    return 'unknown';
  };

  const handleVoiceSelect = (voice: Voice) => {
    setSelectedVoice(voice);
    ttsManager.setVoice(voice);
    onVoiceSelect(voice);
  };

  const handlePreview = async (voice: Voice) => {
    // Check if anything is currently playing (store state or actual TTSManager state)
    if (tts.isPlaying || ttsManager.isSpeaking()) {
      ttsManager.stop();
      updateTTS({ isPlaying: false, isPaused: false });
      return;
    }

    try {
      // Stop any existing playback and update store
      ttsManager.stop();
      updateTTS({ isPlaying: true, isPaused: false });
      
      ttsManager.setVoice(voice);
      await ttsManager.speak(previewText, () => {
        // Update store when preview ends
        updateTTS({ isPlaying: false, isPaused: false });
      });
    } catch (error) {
      console.error('Error playing voice preview:', error);
      updateTTS({ isPlaying: false, isPaused: false });
    }
  };

  const getVoiceQuality = (voice: Voice): 'premium' | 'high' | 'standard' => {
    const lowerName = voice.name.toLowerCase();
    
    // Premium voices - most natural sounding
    if (lowerName.includes('premium') || 
        lowerName.includes('enhanced') || 
        lowerName.includes('neural') ||
        lowerName.includes('studio') ||
        lowerName.includes('wavenet') ||
        lowerName.includes('natural') ||
        lowerName.includes('human') ||
        lowerName.includes('realistic')) {
      return 'premium';
    }
    
    // High quality voices - good natural sound
    if (lowerName.includes('samantha') ||
        lowerName.includes('karen') ||
        lowerName.includes('moira') ||
        lowerName.includes('tessa') ||
        lowerName.includes('daniel') ||
        lowerName.includes('oliver') ||
        lowerName.includes('alex') ||
        lowerName.includes('tom') ||
        voice.localService) {
      return 'high';
    }
    
    return 'standard';
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'premium': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'high': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getGenderIcon = (gender: string) => {
    switch (gender) {
      case 'female': return '👩';
      case 'male': return '👨';
      default: return '👤';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>

        <div className="inline-block w-full max-w-4xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Volume2 className="w-6 h-6" />
              Select Voice
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              ✕
            </button>
          </div>

          {/* Preview Section */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preview Text
                </label>
                <input
                  type="text"
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter text to preview voices..."
                />
              </div>
              <button
                onClick={() => selectedVoice && handlePreview(selectedVoice)}
                disabled={!selectedVoice || isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {(tts.isPlaying || ttsManager.isSpeaking()) ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {(tts.isPlaying || ttsManager.isSpeaking()) ? 'Stop' : 'Preview'}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading voices...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Natural Voices */}
                {(naturalVoices.female.length > 0 || naturalVoices.male.length > 0) && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">🌟 Natural Voices</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Female Voices */}
                      {naturalVoices.female.map((voice, index) => {
                        const quality = getVoiceQuality(voice);
                        const isSelected = selectedVoice?.voiceURI === voice.voiceURI;
                        
                        return (
                          <div
                            key={`female-${index}`}
                            className={`p-4 border rounded-lg cursor-pointer transition-all ${
                              isSelected 
                                ? 'border-blue-500 bg-blue-50' 
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                            onClick={() => handleVoiceSelect(voice)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{getGenderIcon(voice.gender)}</span>
                                <span className="font-medium text-gray-900">{voice.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 text-xs rounded-full border ${getQualityColor(quality)}`}>
                                  {quality}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePreview(voice);
                                  }}
                                  className="p-1 text-gray-400 hover:text-gray-600"
                                >
                                  <Play className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <div className="text-sm text-gray-600">
                              <div>{voice.lang}</div>
                              {voice.localService && <div className="text-green-600">Local Service</div>}
                            </div>
                            {isSelected && (
                              <div className="mt-2 flex items-center gap-1 text-blue-600">
                                <Check className="w-4 h-4" />
                                <span className="text-sm font-medium">Selected</span>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Male Voices */}
                      {naturalVoices.male.map((voice, index) => {
                        const quality = getVoiceQuality(voice);
                        const isSelected = selectedVoice?.voiceURI === voice.voiceURI;
                        
                        return (
                          <div
                            key={`male-${index}`}
                            className={`p-4 border rounded-lg cursor-pointer transition-all ${
                              isSelected 
                                ? 'border-blue-500 bg-blue-50' 
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                            onClick={() => handleVoiceSelect(voice)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{getGenderIcon(voice.gender)}</span>
                                <span className="font-medium text-gray-900">{voice.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 text-xs rounded-full border ${getQualityColor(quality)}`}>
                                  {quality}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePreview(voice);
                                  }}
                                  className="p-1 text-gray-400 hover:text-gray-600"
                                >
                                  <Play className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <div className="text-sm text-gray-600">
                              <div>{voice.lang}</div>
                              {voice.localService && <div className="text-green-600">Local Service</div>}
                            </div>
                            {isSelected && (
                              <div className="mt-2 flex items-center gap-1 text-blue-600">
                                <Check className="w-4 h-4" />
                                <span className="text-sm font-medium">Selected</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* All English Voices */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">🌍 All English Voices</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {voices
                      .filter(voice => voice.lang && voice.lang.startsWith('en'))
                      .map((voice, index) => {
                        const quality = getVoiceQuality(voice);
                        const isSelected = selectedVoice?.voiceURI === voice.voiceURI;
                        
                        return (
                          <div
                            key={`all-${index}`}
                            className={`p-3 border rounded-lg cursor-pointer transition-all ${
                              isSelected 
                                ? 'border-blue-500 bg-blue-50' 
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                            onClick={() => handleVoiceSelect(voice)}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{getGenderIcon(voice.gender)}</span>
                                <span className="text-sm font-medium text-gray-900 truncate">{voice.name}</span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePreview(voice);
                                }}
                                className="p-1 text-gray-400 hover:text-gray-600"
                              >
                                <Play className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="text-xs text-gray-600">
                              <div>{voice.lang}</div>
                              <div className={`inline-block px-1 py-0.5 text-xs rounded ${getQualityColor(quality)}`}>
                                {quality}
                              </div>
                            </div>
                            {isSelected && (
                              <div className="mt-1 flex items-center gap-1 text-blue-600">
                                <Check className="w-3 h-3" />
                                <span className="text-xs font-medium">Selected</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {selectedVoice ? `Selected: ${selectedVoice.name}` : 'No voice selected'}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (selectedVoice) {
                      onVoiceSelect(selectedVoice);
                    }
                    onClose();
                  }}
                  disabled={!selectedVoice}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Select Voice
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
