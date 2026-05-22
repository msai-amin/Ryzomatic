/**
 * Tests for ttsManager — covers the orchestration logic (provider selection,
 * configured/available filters, getCurrentProvider) rather than the delegate
 * methods, which are pass-throughs to ttsService / googleCloudTTSService /
 * azureTTSService and would be tautological under mocks.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// vi.mock factories are hoisted; use vi.hoisted to share the mock objects
// between the factories and the test body.
const { ttsMock, googleMock, azureMock } = vi.hoisted(() => {
  const stub = () => ({
    isSupported: vi.fn().mockReturnValue(true),
    isConfigured: vi.fn().mockReturnValue(true),
    getVoices: vi.fn().mockResolvedValue([]),
    speak: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    resume: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    isSpeaking: vi.fn().mockReturnValue(false),
    isPausedState: vi.fn().mockReturnValue(false),
    setRate: vi.fn(),
    setPitch: vi.fn(),
    setVolume: vi.fn(),
    setVoice: vi.fn(),
    setSpeakingRate: vi.fn(),
    setVolumeGain: vi.fn(),
    cleanText: vi.fn().mockImplementation((t: string) => t),
    splitIntoSentences: vi.fn().mockImplementation((t: string) => [t]),
    getProgress: vi.fn().mockReturnValue(0),
    getCurrentTime: vi.fn().mockReturnValue(0),
    getDuration: vi.fn().mockReturnValue(0),
  });
  return {
    ttsMock: stub(),
    googleMock: stub(),
    azureMock: stub(),
  };
});

vi.mock('../../src/services/ttsService', () => ({ ttsService: ttsMock }));
vi.mock('../../src/services/googleCloudTTSService', () => ({
  googleCloudTTSService: googleMock,
}));
vi.mock('../../src/services/azureTTSService', () => ({
  azureTTSService: azureMock,
}));

// Import AFTER vi.mock so the manager wires up the mocks at construction time.
async function loadManager() {
  // Reset module registry so the manager's constructor sees the latest mock
  // return values (e.g. isSupported / isConfigured changes between tests).
  vi.resetModules();
  const mod = await import('../../src/services/ttsManager');
  return mod.ttsManager;
}

beforeEach(() => {
  // Default all three providers to available + configured
  [ttsMock, googleMock, azureMock].forEach(m => {
    m.isSupported.mockReturnValue(true);
    m.isConfigured.mockReturnValue(true);
    m.getVoices.mockResolvedValue([]);
    m.setVoice.mockClear();
  });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('ttsManager.getProviders', () => {
  it('returns all three providers', async () => {
    const manager = await loadManager();
    const providers = manager.getProviders();
    expect(providers).toHaveLength(3);
    const names = providers.map(p => p.type).sort();
    expect(names).toEqual(['azure', 'google-cloud', 'native']);
  });
});

describe('ttsManager.getAvailableProviders', () => {
  it('filters out providers whose isSupported() returns false', async () => {
    azureMock.isSupported.mockReturnValue(false);
    const manager = await loadManager();
    const types = manager.getAvailableProviders().map(p => p.type).sort();
    expect(types).toEqual(['google-cloud', 'native']);
  });
});

describe('ttsManager.getConfiguredProviders', () => {
  it('filters out providers whose isConfigured() returns false', async () => {
    googleMock.isConfigured.mockReturnValue(false);
    const manager = await loadManager();
    const types = manager.getConfiguredProviders().map(p => p.type).sort();
    expect(types).toEqual(['azure', 'native']);
  });
});

describe('ttsManager.setProvider', () => {
  it('switches currentProvider when the target is available + configured', async () => {
    const manager = await loadManager();
    const ok = await manager.setProvider('native');
    expect(ok).toBe(true);
    expect(manager.getCurrentProvider()?.type).toBe('native');
  });

  it('returns false and leaves currentProvider unchanged when target is unavailable', async () => {
    googleMock.isSupported.mockReturnValue(false);
    const manager = await loadManager();
    // First successfully set native, then try unavailable google-cloud
    await manager.setProvider('native');
    const before = manager.getCurrentProvider();
    const ok = await manager.setProvider('google-cloud');
    expect(ok).toBe(false);
    expect(manager.getCurrentProvider()).toBe(before);
  });

  it('returns false when target is unconfigured', async () => {
    azureMock.isConfigured.mockReturnValue(false);
    const manager = await loadManager();
    const ok = await manager.setProvider('azure');
    expect(ok).toBe(false);
  });

  it('picks an English neural voice as default when switching to google-cloud', async () => {
    googleMock.getVoices.mockResolvedValueOnce([
      { name: 'es-ES-Wavenet-A', languageCode: 'es-ES' },
      { name: 'en-US-Neural2-A', languageCode: 'en-US' },
      { name: 'en-US-Standard-A', languageCode: 'en-US' },
    ]);
    const manager = await loadManager();
    await manager.setProvider('google-cloud');
    expect(googleMock.setVoice).toHaveBeenCalledTimes(1);
    const chosenName = googleMock.setVoice.mock.calls[0][0].name;
    expect(chosenName).toBe('en-US-Neural2-A');
  });

  it('falls back to the first English voice if no Neural/Studio/Wavenet found for google-cloud', async () => {
    googleMock.getVoices.mockResolvedValueOnce([
      { name: 'en-GB-Standard-A', languageCode: 'en-GB' },
      { name: 'en-US-Standard-B', languageCode: 'en-US' },
    ]);
    const manager = await loadManager();
    await manager.setProvider('google-cloud');
    expect(googleMock.setVoice).toHaveBeenCalledTimes(1);
    expect(googleMock.setVoice.mock.calls[0][0].name).toBe('en-GB-Standard-A');
  });

  it('does not throw if getVoices rejects when switching to google-cloud', async () => {
    googleMock.getVoices.mockRejectedValueOnce(new Error('network'));
    const manager = await loadManager();
    const ok = await manager.setProvider('google-cloud');
    // Provider still gets selected; voice default just isn't set.
    expect(ok).toBe(true);
    expect(manager.getCurrentProvider()?.type).toBe('google-cloud');
    expect(googleMock.setVoice).not.toHaveBeenCalled();
  });
});

describe('ttsManager.getCurrentProvider', () => {
  it('exposes the provider type for downstream consumers', async () => {
    const manager = await loadManager();
    await manager.setProvider('native');
    const current = manager.getCurrentProvider();
    expect(current).not.toBeNull();
    expect(current?.type).toBe('native');
    expect(current?.name).toBe('Native Browser TTS');
  });
});
