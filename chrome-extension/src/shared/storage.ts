/**
 * Chrome Storage Helpers
 * Wraps chrome.storage.local with typed getters/setters
 */

import {
  Session,
  User,
  Document,
  ExtensionSettings,
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
} from './types';

/**
 * Get a value from chrome.storage.local
 */
export async function getStorageValue<T>(key: string): Promise<T | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key] ?? null);
    });
  });
}

/**
 * Set a value in chrome.storage.local
 */
export async function setStorageValue<T>(key: string, value: T): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

/**
 * Remove a value from chrome.storage.local
 */
export async function removeStorageValue(key: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove([key], resolve);
  });
}

/**
 * Clear all extension storage
 */
export async function clearStorage(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.clear(resolve);
  });
}

// Session Management
export async function getStoredSession(): Promise<Session | null> {
  return getStorageValue<Session>(STORAGE_KEYS.SESSION);
}

export async function storeSession(session: Session): Promise<void> {
  await setStorageValue(STORAGE_KEYS.SESSION, session);
  await setStorageValue(STORAGE_KEYS.USER, session.user);
}

export async function clearSession(): Promise<void> {
  await removeStorageValue(STORAGE_KEYS.SESSION);
  await removeStorageValue(STORAGE_KEYS.USER);
}

export async function getStoredUser(): Promise<User | null> {
  return getStorageValue<User>(STORAGE_KEYS.USER);
}

// Recent Documents Cache
export async function getRecentDocuments(): Promise<Document[]> {
  const docs = await getStorageValue<Document[]>(STORAGE_KEYS.RECENT_DOCUMENTS);
  return docs ?? [];
}

export async function setRecentDocuments(documents: Document[]): Promise<void> {
  // Keep only the most recent 10 documents
  const trimmed = documents.slice(0, 10);
  await setStorageValue(STORAGE_KEYS.RECENT_DOCUMENTS, trimmed);
}

export async function addToRecentDocuments(document: Document): Promise<void> {
  const recent = await getRecentDocuments();
  // Remove if already exists (to move to top)
  const filtered = recent.filter((d) => d.id !== document.id);
  // Add to beginning
  const updated = [document, ...filtered].slice(0, 10);
  await setRecentDocuments(updated);
}

// Settings Management
export async function getSettings(): Promise<ExtensionSettings> {
  const settings = await getStorageValue<ExtensionSettings>(STORAGE_KEYS.SETTINGS);
  return settings ?? DEFAULT_SETTINGS;
}

export async function updateSettings(
  updates: Partial<ExtensionSettings>
): Promise<ExtensionSettings> {
  const current = await getSettings();
  const updated = { ...current, ...updates };
  await setStorageValue(STORAGE_KEYS.SETTINGS, updated);
  return updated;
}

export async function resetSettings(): Promise<ExtensionSettings> {
  await setStorageValue(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

// Listen for storage changes
export function onStorageChange(
  callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void
): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    if (areaName === 'local') {
      callback(changes);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

