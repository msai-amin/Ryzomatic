/**
 * Ryzomatic Chrome Extension - Content Script
 * Handles page content extraction and selection toolbar
 */

import { ExtensionMessage, ExtensionResponse, PageContent, HIGHLIGHT_COLORS } from '../shared/types';

// ==================== Message Handler ====================

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionResponse) => void
  ) => {
    switch (message.type) {
      case 'GET_PAGE_CONTENT':
        sendResponse({ success: true, data: extractPageContent() });
        break;

      case 'GET_SELECTION_CONTEXT':
        sendResponse({ success: true, data: getSelectionContext() });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
    return true;
  }
);

// ==================== Page Content Extraction ====================

function extractPageContent(): PageContent {
  const url = window.location.href;
  const isPdf = url.toLowerCase().endsWith('.pdf') || 
                document.contentType === 'application/pdf';

  if (isPdf) {
    return {
      url,
      title: document.title || extractTitleFromUrl(url),
      text: '',
      isPdf: true,
    };
  }

  return {
    url,
    title: extractTitle(),
    text: extractMainContent(),
    html: document.documentElement.outerHTML,
    description: extractDescription(),
    author: extractAuthor(),
    publishDate: extractPublishDate(),
    favicon: extractFavicon(),
    ogImage: extractOgImage(),
    isPdf: false,
  };
}

function extractTitle(): string {
  // Try Open Graph title first
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) {
    return ogTitle.getAttribute('content') || '';
  }

  // Try Twitter title
  const twitterTitle = document.querySelector('meta[name="twitter:title"]');
  if (twitterTitle) {
    return twitterTitle.getAttribute('content') || '';
  }

  // Fall back to document title
  return document.title || 'Untitled';
}

function extractDescription(): string | undefined {
  // Try Open Graph description
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) {
    return ogDesc.getAttribute('content') || undefined;
  }

  // Try meta description
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    return metaDesc.getAttribute('content') || undefined;
  }

  return undefined;
}

function extractAuthor(): string | undefined {
  // Try various author meta tags
  const selectors = [
    'meta[name="author"]',
    'meta[property="article:author"]',
    'meta[name="twitter:creator"]',
    '[rel="author"]',
    '.author',
    '.byline',
    '[itemprop="author"]',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      const content = element.getAttribute('content') || element.textContent;
      if (content) {
        return content.trim();
      }
    }
  }

  return undefined;
}

function extractPublishDate(): string | undefined {
  // Try various date meta tags
  const selectors = [
    'meta[property="article:published_time"]',
    'meta[name="publish-date"]',
    'meta[name="date"]',
    'time[datetime]',
    '[itemprop="datePublished"]',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      const content = element.getAttribute('content') || 
                     element.getAttribute('datetime') || 
                     element.textContent;
      if (content) {
        return content.trim();
      }
    }
  }

  return undefined;
}

function extractFavicon(): string | undefined {
  const link = document.querySelector('link[rel="icon"]') || 
               document.querySelector('link[rel="shortcut icon"]');
  if (link) {
    const href = link.getAttribute('href');
    if (href) {
      return new URL(href, window.location.origin).href;
    }
  }
  return `${window.location.origin}/favicon.ico`;
}

function extractOgImage(): string | undefined {
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) {
    return ogImage.getAttribute('content') || undefined;
  }
  return undefined;
}

function extractMainContent(): string {
  // Try to find the main content area
  const mainSelectors = [
    'article',
    '[role="main"]',
    'main',
    '.article-content',
    '.post-content',
    '.entry-content',
    '.content',
    '#content',
  ];

  for (const selector of mainSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      return cleanText(element.textContent || '');
    }
  }

  // Fall back to body, but try to remove nav, header, footer, etc.
  const body = document.body.cloneNode(true) as HTMLElement;
  const removeSelectors = [
    'nav',
    'header',
    'footer',
    'aside',
    '.sidebar',
    '.navigation',
    '.menu',
    '.comments',
    '.advertisement',
    '.ad',
    'script',
    'style',
    'noscript',
  ];

  removeSelectors.forEach((selector) => {
    body.querySelectorAll(selector).forEach((el) => el.remove());
  });

  return cleanText(body.textContent || '');
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

function extractTitleFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').pop() || '';
    return filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  } catch {
    return 'Untitled';
  }
}

// ==================== Selection Context ====================

function getSelectionContext(): { before?: string; after?: string } {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return {};
  }

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const textNode = container.nodeType === Node.TEXT_NODE
    ? container
    : container.firstChild;

  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
    return {};
  }

  const fullText = textNode.textContent || '';
  const selectionText = selection.toString();
  const startIndex = fullText.indexOf(selectionText);

  if (startIndex === -1) {
    return {};
  }

  const before = fullText.substring(Math.max(0, startIndex - 50), startIndex);
  const after = fullText.substring(
    startIndex + selectionText.length,
    startIndex + selectionText.length + 50
  );

  return { before, after };
}

// ==================== Selection Toolbar ====================

let toolbar: HTMLDivElement | null = null;

function createToolbar(): HTMLDivElement {
  const div = document.createElement('div');
  div.id = 'ryzomatic-toolbar';
  div.innerHTML = `
    <div class="ryzomatic-toolbar-inner">
      <button class="ryzomatic-save-btn" title="Save to Ryzomatic">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
        Save
      </button>
      <div class="ryzomatic-divider"></div>
      <div class="ryzomatic-colors">
        ${HIGHLIGHT_COLORS.map(
          (color) =>
            `<button class="ryzomatic-color-btn" data-color-id="${color.id}" data-color-hex="${color.hex}" title="${color.name}" style="background-color: ${color.hex}"></button>`
        ).join('')}
      </div>
    </div>
  `;
  
  document.body.appendChild(div);
  
  // Event listeners
  div.querySelector('.ryzomatic-save-btn')?.addEventListener('click', handleSaveClick);
  div.querySelectorAll('.ryzomatic-color-btn').forEach((btn) => {
    btn.addEventListener('click', handleColorClick);
  });
  
  return div;
}

function showToolbar(x: number, y: number): void {
  if (!toolbar) {
    toolbar = createToolbar();
  }
  
  toolbar.style.display = 'block';
  toolbar.style.left = `${x}px`;
  toolbar.style.top = `${y - 50}px`;
  
  // Ensure toolbar stays in viewport
  const rect = toolbar.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    toolbar.style.left = `${window.innerWidth - rect.width - 10}px`;
  }
  if (rect.top < 0) {
    toolbar.style.top = `${y + 30}px`;
  }
}

function hideToolbar(): void {
  if (toolbar) {
    toolbar.style.display = 'none';
  }
}

async function handleSaveClick(): Promise<void> {
  const selection = window.getSelection();
  if (!selection) return;
  
  const text = selection.toString().trim();
  if (!text) return;
  
  const context = getSelectionContext();
  
  try {
    await chrome.runtime.sendMessage({
      type: 'SAVE_HIGHLIGHT',
      payload: {
        text,
        colorId: 'yellow',
        url: window.location.href,
        title: document.title,
        context,
      },
    } as ExtensionMessage);
    
    hideToolbar();
    selection.removeAllRanges();
    showToast('Saved to Ryzomatic!');
  } catch (error) {
    console.error('Error saving:', error);
    showToast('Error saving. Please try again.');
  }
}

async function handleColorClick(event: Event): Promise<void> {
  const btn = event.target as HTMLButtonElement;
  const colorId = btn.dataset.colorId;
  const colorHex = btn.dataset.colorHex;
  
  if (!colorId || !colorHex) return;
  
  const selection = window.getSelection();
  if (!selection) return;
  
  const text = selection.toString().trim();
  if (!text) return;
  
  const context = getSelectionContext();
  
  try {
    await chrome.runtime.sendMessage({
      type: 'SAVE_HIGHLIGHT',
      payload: {
        text,
        colorId,
        url: window.location.href,
        title: document.title,
        context,
      },
    } as ExtensionMessage);
    
    // Visually highlight the selection
    highlightSelection(colorHex);
    
    hideToolbar();
    showToast('Highlighted and saved!');
  } catch (error) {
    console.error('Error highlighting:', error);
    showToast('Error saving. Please try again.');
  }
}

function highlightSelection(colorHex: string): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  
  const range = selection.getRangeAt(0);
  const span = document.createElement('span');
  span.style.backgroundColor = colorHex;
  span.style.borderRadius = '2px';
  span.className = 'ryzomatic-highlight';
  
  try {
    range.surroundContents(span);
  } catch {
    // Can't surround if selection spans multiple elements
    // Just clear the selection
  }
  
  selection.removeAllRanges();
}

// ==================== Toast Notification ====================

function showToast(message: string): void {
  const existing = document.getElementById('ryzomatic-toast');
  if (existing) {
    existing.remove();
  }
  
  const toast = document.createElement('div');
  toast.id = 'ryzomatic-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });
  
  // Remove after delay
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ==================== Selection Event Handler ====================

let selectionTimeout: ReturnType<typeof setTimeout> | null = null;

document.addEventListener('mouseup', (event) => {
  // Clear any pending timeout
  if (selectionTimeout) {
    clearTimeout(selectionTimeout);
  }
  
  // Don't show toolbar if clicking on the toolbar itself
  if (toolbar && toolbar.contains(event.target as Node)) {
    return;
  }
  
  // Small delay to let selection settle
  selectionTimeout = setTimeout(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    
    if (text && text.length > 0) {
      showToolbar(event.pageX, event.pageY);
    } else {
      hideToolbar();
    }
  }, 100);
});

// Hide toolbar when clicking outside
document.addEventListener('mousedown', (event) => {
  if (toolbar && !toolbar.contains(event.target as Node)) {
    // Don't hide immediately if there's a selection
    const selection = window.getSelection();
    if (!selection || selection.toString().trim().length === 0) {
      hideToolbar();
    }
  }
});

// Hide toolbar on scroll
document.addEventListener('scroll', () => {
  hideToolbar();
});

// Hide toolbar on escape key
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    hideToolbar();
  }
});

console.log('Ryzomatic content script loaded');

