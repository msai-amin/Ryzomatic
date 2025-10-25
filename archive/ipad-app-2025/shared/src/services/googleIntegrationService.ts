/**
 * Google Integration Service
 * Handles Google Drive and Google Docs integration for PDFs and Notes
 * 
 * Requirements:
 * - PDFs go to "Readings In Progress" folder in Google Drive
 * - Notes go to Google Docs with naming: {book name}_notes_page{page}_modified{date}
 */

import { simpleGoogleAuth } from './simpleGoogleAuth';

export interface ReadingFile {
  id: string;
  name: string;
  driveId?: string;
  url?: string;
  lastModified: Date;
}

export interface NoteDocument {
  id: string;
  docId?: string;
  bookName: string;
  pageNumber: number;
  content: string;
  lastModified: Date;
  url?: string;
}

class GoogleIntegrationService {
  private readingsFolderId: string | null = null;
  private readonly READINGS_FOLDER_NAME = 'Readings In Progress';
  private accessToken: string | null = null;

  /**
   * Initialize and ensure Google authentication
   */
  async initialize(): Promise<void> {
    if (!simpleGoogleAuth.isSignedIn()) {
      throw new Error('Please sign in with Google to use Drive and Docs integration');
    }

    // Get access token using Google API client
    await this.getAccessToken();
    
    // Ensure readings folder exists
    await this.ensureReadingsFolder();
  }

  /**
   * Get access token for API calls
   * Note: This requires additional scope configuration
   */
  private async getAccessToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.gapi) {
        reject(new Error('Google API not loaded'));
        return;
      }

      // Load the client library if not already loaded
      if (!window.gapi.client) {
        window.gapi.load('client', () => {
          this.initializeGapiClient().then(resolve).catch(reject);
        });
      } else {
        this.initializeGapiClient().then(resolve).catch(reject);
      }
    });
  }

  private async initializeGapiClient(): Promise<string> {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!apiKey || !clientId) {
      throw new Error('Google API credentials not configured');
    }

    // Initialize the gapi client with Drive and Docs scopes
    await window.gapi.client.init({
      apiKey: apiKey,
      clientId: clientId,
      discoveryDocs: [
        'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
        'https://docs.googleapis.com/$discovery/rest?version=v1'
      ],
      scope: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/documents'
      ].join(' ')
    });

    // Get the access token
    const auth = window.gapi.auth2.getAuthInstance();
    if (auth && auth.isSignedIn.get()) {
      const user = auth.currentUser.get();
      const authResponse = user.getAuthResponse(true);
      this.accessToken = authResponse.access_token;
      return this.accessToken;
    }

    throw new Error('User not authenticated with Google');
  }

  /**
   * Ensure "Readings In Progress" folder exists in Drive
   */
  private async ensureReadingsFolder(): Promise<void> {
    try {
      // Search for existing folder
      const response = await window.gapi.client.drive.files.list({
        q: `name='${this.READINGS_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive'
      });

      if (response.result.files && response.result.files.length > 0) {
        this.readingsFolderId = response.result.files[0].id;
        console.log('Found existing Readings folder:', this.readingsFolderId);
        return;
      }

      // Create folder if it doesn't exist
      const createResponse = await window.gapi.client.drive.files.create({
        resource: {
          name: this.READINGS_FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder',
          description: 'PDFs currently being read in Smart Reader'
        },
        fields: 'id'
      });

      this.readingsFolderId = createResponse.result.id;
      console.log('Created Readings folder:', this.readingsFolderId);
    } catch (error) {
      console.error('Error ensuring readings folder:', error);
      throw new Error('Failed to create/find Readings folder');
    }
  }

  /**
   * Upload PDF to "Readings In Progress" folder
   */
  async uploadPDFToReadings(file: File): Promise<ReadingFile> {
    await this.initialize();

    if (!this.readingsFolderId) {
      throw new Error('Readings folder not initialized');
    }

    try {
      // Upload the file
      const metadata = {
        name: file.name,
        mimeType: 'application/pdf',
        parents: [this.readingsFolderId],
        description: `Uploaded from Smart Reader on ${new Date().toISOString()}`
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,modifiedTime', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: form
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();

      return {
        id: result.id,
        name: result.name,
        driveId: result.id,
        url: result.webViewLink,
        lastModified: new Date(result.modifiedTime)
      };
    } catch (error) {
      console.error('Error uploading PDF:', error);
      throw new Error(`Failed to upload PDF: ${error}`);
    }
  }

  /**
   * Create Google Doc for notes
   * Naming: {book name}_notes_page{page}_modified{date}
   */
  async createNoteDocument(bookName: string, pageNumber: number, content: string): Promise<NoteDocument> {
    await this.initialize();

    try {
      // Format the document name
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const docName = `${bookName}_notes_page${pageNumber}_modified${date}`;

      // Create the Google Doc
      const createResponse = await window.gapi.client.docs.documents.create({
        resource: {
          title: docName
        }
      });

      const docId = createResponse.result.documentId;

      // Add content to the document
      if (content) {
        await window.gapi.client.docs.documents.batchUpdate({
          documentId: docId,
          resource: {
            requests: [
              {
                insertText: {
                  location: {
                    index: 1
                  },
                  text: content
                }
              }
            ]
          }
        });
      }

      // Get the document URL
      const docUrl = `https://docs.google.com/document/d/${docId}/edit`;

      return {
        id: `${bookName}-${pageNumber}-${Date.now()}`,
        docId: docId,
        bookName: bookName,
        pageNumber: pageNumber,
        content: content,
        lastModified: new Date(),
        url: docUrl
      };
    } catch (error) {
      console.error('Error creating note document:', error);
      throw new Error(`Failed to create note document: ${error}`);
    }
  }

  /**
   * Update existing note document
   */
  async updateNoteDocument(docId: string, newContent: string, pageNumber: number): Promise<void> {
    await this.initialize();

    try {
      // Get current document to append/update
      const doc = await window.gapi.client.docs.documents.get({
        documentId: docId
      });

      // Clear existing content and add new
      const endIndex = doc.result.body.content[doc.result.body.content.length - 1].endIndex - 1;

      await window.gapi.client.docs.documents.batchUpdate({
        documentId: docId,
        resource: {
          requests: [
            {
              deleteContentRange: {
                range: {
                  startIndex: 1,
                  endIndex: endIndex
                }
              }
            },
            {
              insertText: {
                location: {
                  index: 1
                },
                text: newContent
              }
            }
          ]
        }
      });

      console.log('Note document updated:', docId);
    } catch (error) {
      console.error('Error updating note document:', error);
      throw new Error(`Failed to update note document: ${error}`);
    }
  }

  /**
   * List all PDFs in Readings folder
   */
  async listReadings(): Promise<ReadingFile[]> {
    await this.initialize();

    if (!this.readingsFolderId) {
      return [];
    }

    try {
      const response = await window.gapi.client.drive.files.list({
        q: `'${this.readingsFolderId}' in parents and mimeType='application/pdf' and trashed=false`,
        fields: 'files(id, name, webViewLink, modifiedTime)',
        orderBy: 'modifiedTime desc'
      });

      return response.result.files.map((file: any) => ({
        id: file.id,
        name: file.name,
        driveId: file.id,
        url: file.webViewLink,
        lastModified: new Date(file.modifiedTime)
      }));
    } catch (error) {
      console.error('Error listing readings:', error);
      return [];
    }
  }

  /**
   * Delete PDF from Readings folder
   */
  async deleteReading(driveId: string): Promise<void> {
    await this.initialize();

    try {
      await window.gapi.client.drive.files.delete({
        fileId: driveId
      });
      console.log('Reading deleted:', driveId);
    } catch (error) {
      console.error('Error deleting reading:', error);
      throw new Error(`Failed to delete reading: ${error}`);
    }
  }

  /**
   * Delete note document from Google Docs
   */
  async deleteNoteDocument(docId: string): Promise<void> {
    await this.initialize();

    try {
      await window.gapi.client.drive.files.delete({
        fileId: docId
      });
      console.log('Note document deleted:', docId);
    } catch (error) {
      console.error('Error deleting note document:', error);
      throw new Error(`Failed to delete note document: ${error}`);
    }
  }

  /**
   * Check if Google Drive/Docs integration is available
   */
  isAvailable(): boolean {
    return simpleGoogleAuth.isSignedIn() && 
           typeof window !== 'undefined' && 
           !!window.gapi;
  }
}

// Global type declarations
declare global {
  interface Window {
    gapi: any;
  }
}

export const googleIntegrationService = new GoogleIntegrationService();
