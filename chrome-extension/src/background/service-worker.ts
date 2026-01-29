/**
 * Ryzomatic Chrome Extension - Background Service Worker
 * Handles context menus, message routing, and background operations
 */

import { isAuthenticated, getAuthToken } from '../shared/auth';
import { saveWebPage, savePdf, saveQuickClip } from '../shared/api';
import { getSettings, addToRecentDocuments } from '../shared/storage';
import {
  ExtensionMessage,
  ExtensionResponse,
  PageContent,
  HIGHLIGHT_COLORS,
} from '../shared/types';

// ==================== Context Menu Setup ====================

chrome.runtime.onInstalled.addListener(() => {
  // Remove existing menus to avoid duplicates
  chrome.contextMenus.removeAll(() => {
    // Create parent menu
    chrome.contextMenus.create({
      id: 'ryzomatic-parent',
      title: 'Ryzomatic',
      contexts: ['page', 'selection', 'link', 'image'],
    });

    // Save page option
    chrome.contextMenus.create({
      id: 'save-page',
      parentId: 'ryzomatic-parent',
      title: 'Save this page',
      contexts: ['page'],
    });

    // Save link as document
    chrome.contextMenus.create({
      id: 'save-link',
      parentId: 'ryzomatic-parent',
      title: 'Save link as document',
      contexts: ['link'],
    });

    // Highlight selection submenu
    chrome.contextMenus.create({
      id: 'highlight-selection',
      parentId: 'ryzomatic-parent',
      title: 'Highlight selection',
      contexts: ['selection'],
    });

    // Add color options for highlighting
    HIGHLIGHT_COLORS.forEach((color) => {
      chrome.contextMenus.create({
        id: `highlight-${color.id}`,
        parentId: 'highlight-selection',
        title: `${color.name}`,
        contexts: ['selection'],
      });
    });

    // Save selection as note
    chrome.contextMenus.create({
      id: 'save-note',
      parentId: 'ryzomatic-parent',
      title: 'Save selection as note',
      contexts: ['selection'],
    });

    // Separator
    chrome.contextMenus.create({
      id: 'separator-1',
      parentId: 'ryzomatic-parent',
      type: 'separator',
      contexts: ['page', 'selection', 'link'],
    });

    // Open Ryzomatic
    chrome.contextMenus.create({
      id: 'open-ryzomatic',
      parentId: 'ryzomatic-parent',
      title: 'Open Ryzomatic Library',
      contexts: ['page', 'selection', 'link'],
    });
  });
});

// ==================== Context Menu Handler ====================

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  const authenticated = await isAuthenticated();
  if (!authenticated) {
    // Open popup for authentication
    showNotification('Please sign in', 'Sign in to Ryzomatic to use this feature');
    return;
  }

  try {
    switch (info.menuItemId) {
      case 'save-page':
        await handleSavePage(tab);
        break;

      case 'save-link':
        if (info.linkUrl) {
          await handleSaveLink(info.linkUrl, tab);
        }
        break;

      case 'save-note':
        if (info.selectionText) {
          await handleSaveNote(info.selectionText, tab);
        }
        break;

      case 'open-ryzomatic':
        chrome.tabs.create({ url: 'https://ryzomatic.net' });
        break;

      default:
        // Check if it's a highlight color
        if (typeof info.menuItemId === 'string' && info.menuItemId.startsWith('highlight-')) {
          const colorId = info.menuItemId.replace('highlight-', '');
          if (info.selectionText) {
            await handleHighlightSelection(info.selectionText, colorId, tab);
          }
        }
    }
  } catch (error) {
    console.error('Context menu action failed:', error);
    showNotification(
      'Error',
      error instanceof Error ? error.message : 'Operation failed'
    );
  }
});

// ==================== Message Handler ====================

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionResponse) => void
  ) => {
    // Handle async operations
    handleMessage(message, sender)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });

    // Return true to indicate async response
    return true;
  }
);

async function handleMessage(
  message: ExtensionMessage,
  _sender: chrome.runtime.MessageSender
): Promise<ExtensionResponse> {
  switch (message.type) {
    case 'GET_AUTH_STATE': {
      const authenticated = await isAuthenticated();
      return { success: true, data: { authenticated } };
    }

    case 'SAVE_PAGE': {
      const content = message.payload as PageContent;
      const response = await saveWebPage(content);
      if (response.success && response.document) {
        await addToRecentDocuments(response.document);
      }
      return { success: response.success, data: response.document, error: response.error };
    }

    case 'SAVE_PDF': {
      const { blob, title, url } = message.payload as {
        blob: Blob;
        title: string;
        url: string;
      };
      const response = await savePdf(blob, title, url);
      if (response.success && response.document) {
        await addToRecentDocuments(response.document);
      }
      return { success: response.success, data: response.document, error: response.error };
    }

    case 'SAVE_HIGHLIGHT': {
      const { text, colorId, url, title, context } = message.payload as {
        text: string;
        colorId: string;
        url: string;
        title: string;
        context?: { before?: string; after?: string };
      };
      const color = HIGHLIGHT_COLORS.find((c) => c.id === colorId) || HIGHLIGHT_COLORS[0];
      const result = await saveQuickClip(text, url, title, color.id, color.hex, context);
      return { success: true, data: result };
    }

    case 'OPEN_RYZOMATIC': {
      chrome.tabs.create({ url: 'https://ryzomatic.net' });
      return { success: true };
    }

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

// ==================== Action Handlers ====================

async function handleSavePage(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id || !tab.url) return;

  try {
    // Get page content from content script
    const content = await getPageContent(tab.id);

    if (content.isPdf) {
      // Fetch and save PDF
      const response = await fetch(content.url);
      const blob = await response.blob();
      const result = await savePdf(blob, content.title, content.url);

      if (result.success && result.document) {
        await addToRecentDocuments(result.document);
        showNotification('Saved!', `"${content.title}" saved to your library`);
      } else {
        throw new Error(result.error || 'Failed to save PDF');
      }
    } else {
      // Save web page
      const result = await saveWebPage(content);

      if (result.success && result.document) {
        await addToRecentDocuments(result.document);
        showNotification('Saved!', `"${content.title}" saved to your library`);
      } else {
        throw new Error(result.error || 'Failed to save page');
      }
    }
  } catch (error) {
    throw error;
  }
}

async function handleSaveLink(linkUrl: string, tab: chrome.tabs.Tab): Promise<void> {
  try {
    // Check if it's a PDF link
    const isPdf = linkUrl.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      const response = await fetch(linkUrl);
      const blob = await response.blob();
      const title = linkUrl.split('/').pop() || 'Linked PDF';
      const result = await savePdf(blob, title, linkUrl);

      if (result.success && result.document) {
        await addToRecentDocuments(result.document);
        showNotification('Saved!', `PDF saved to your library`);
      } else {
        throw new Error(result.error || 'Failed to save PDF');
      }
    } else {
      // For non-PDF links, save as a reference document
      const pageContent: PageContent = {
        url: linkUrl,
        title: `Link from: ${tab.title || 'Unknown page'}`,
        text: `Saved link: ${linkUrl}`,
        isPdf: false,
      };
      const result = await saveWebPage(pageContent);

      if (result.success) {
        showNotification('Saved!', 'Link saved to your library');
      } else {
        throw new Error(result.error || 'Failed to save link');
      }
    }
  } catch (error) {
    throw error;
  }
}

async function handleHighlightSelection(
  text: string,
  colorId: string,
  tab: chrome.tabs.Tab
): Promise<void> {
  if (!tab.url || !tab.title) return;

  const color = HIGHLIGHT_COLORS.find((c) => c.id === colorId) || HIGHLIGHT_COLORS[0];

  try {
    // Get context around selection
    const context = await getSelectionContext(tab.id!);

    const result = await saveQuickClip(
      text,
      tab.url,
      tab.title,
      color.id,
      color.hex,
      context
    );

    showNotification('Highlighted!', `Selection saved with ${color.name} highlight`);
  } catch (error) {
    throw error;
  }
}

async function handleSaveNote(text: string, tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.url || !tab.title) return;

  const settings = await getSettings();
  const defaultColor = HIGHLIGHT_COLORS.find((c) => c.id === settings.defaultHighlightColor) ||
    HIGHLIGHT_COLORS[0];

  try {
    await saveQuickClip(text, tab.url, tab.title, defaultColor.id, defaultColor.hex);
    showNotification('Note saved!', 'Selection saved as a note');
  } catch (error) {
    throw error;
  }
}

// ==================== Helpers ====================

async function getPageContent(tabId: number): Promise<PageContent> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'GET_PAGE_CONTENT',
    } as ExtensionMessage);

    if (response?.success && response.data) {
      return response.data as PageContent;
    }
  } catch (error) {
    // Content script might not be loaded
    console.warn('Could not get page content from content script:', error);
  }

  // Fallback: get basic info from tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return {
    url: tab.url || '',
    title: tab.title || 'Untitled',
    text: '',
    isPdf: tab.url?.toLowerCase().endsWith('.pdf') || false,
  };
}

async function getSelectionContext(
  tabId: number
): Promise<{ before?: string; after?: string }> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'GET_SELECTION_CONTEXT',
    } as ExtensionMessage);

    if (response?.success && response.data) {
      return response.data as { before?: string; after?: string };
    }
  } catch (error) {
    console.warn('Could not get selection context:', error);
  }
  return {};
}

function showNotification(title: string, message: string): void {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '/icons/icon-48.png',
    title,
    message,
  });
}

// ==================== Extension Icon Click ====================

chrome.action.onClicked.addListener((tab) => {
  // This only fires if there's no default_popup defined
  // Since we have a popup, this won't trigger
  // But keeping it as a fallback
  if (tab.id) {
    chrome.action.openPopup();
  }
});

// ==================== Token Refresh Alarm ====================

// Set up periodic token refresh
chrome.alarms.create('refresh-token', { periodInMinutes: 30 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'refresh-token') {
    // Just check auth to trigger refresh if needed
    await getAuthToken();
  }
});

console.log('Ryzomatic service worker initialized');

