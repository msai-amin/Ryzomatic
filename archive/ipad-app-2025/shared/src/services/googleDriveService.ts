/**
 * Google Drive Service
 * Handles file operations with Google Drive and Google Docs
 */

import { googleAuthService } from './googleAuthService';

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  createdTime: Date;
  modifiedTime: Date;
  webViewLink?: string;
  parents?: string[];
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  createdTime: Date;
  modifiedTime: Date;
  webViewLink?: string;
  parents?: string[];
}

export interface UploadOptions {
  name: string;
  mimeType: string;
  parents?: string[];
  description?: string;
}

class GoogleDriveService {
  private folderId: string | null = null;
  private readonly APP_FOLDER_NAME = 'Smart Reader';

  async initialize(): Promise<void> {
    await googleAuthService.initialize();
    
    if (!googleAuthService.isSignedIn()) {
      throw new Error('User must be signed in to use Google Drive');
    }

    // Find or create app folder
    await this.ensureAppFolder();
  }

  private async ensureAppFolder(): Promise<void> {
    try {
      // Search for existing folder
      const response = await this.searchFiles(`name='${this.APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
      
      if (response.files && response.files.length > 0) {
        this.folderId = response.files[0].id;
        return;
      }

      // Create folder if it doesn't exist
      const folder = await this.createFolder(this.APP_FOLDER_NAME, 'Smart Reader app data storage');
      this.folderId = folder.id;
    } catch (error) {
      console.error('Error ensuring app folder:', error);
      throw new Error('Failed to create app folder');
    }
  }

  async createFolder(name: string, description?: string): Promise<DriveFileMetadata> {
    const accessToken = await googleAuthService.getAccessToken();
    
    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        description,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create folder: ${response.statusText}`);
    }

    const folder = await response.json();
    return this.mapDriveFile(folder);
  }

  async uploadFile(file: File | Blob, options: UploadOptions): Promise<DriveFileMetadata> {
    const accessToken = await googleAuthService.getAccessToken();
    
    // Create metadata
    const metadata = {
      name: options.name,
      mimeType: options.mimeType,
      parents: options.parents || (this.folderId ? [this.folderId] : undefined),
      description: options.description,
    };

    // Create form data
    const formData = new FormData();
    formData.append('metadata', JSON.stringify(metadata));
    formData.append('file', file);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.statusText}`);
    }

    const uploadedFile = await response.json();
    return this.mapDriveFile(uploadedFile);
  }

  async downloadFile(fileId: string): Promise<Blob> {
    const accessToken = await googleAuthService.getAccessToken();
    
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    return await response.blob();
  }

  async getFileMetadata(fileId: string): Promise<DriveFileMetadata> {
    const accessToken = await googleAuthService.getAccessToken();
    
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get file metadata: ${response.statusText}`);
    }

    const file = await response.json();
    return this.mapDriveFile(file);
  }

  async searchFiles(query: string): Promise<{ files: GoogleDriveFile[] }> {
    const accessToken = await googleAuthService.getAccessToken();
    
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,parents)`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to search files: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      files: data.files.map((file: any) => this.mapDriveFile(file))
    };
  }

  async listAppFiles(): Promise<DriveFileMetadata[]> {
    if (!this.folderId) {
      await this.ensureAppFolder();
    }

    const query = `'${this.folderId}' in parents and trashed=false`;
    const response = await this.searchFiles(query);
    return response.files.map(file => this.mapDriveFile(file));
  }

  async deleteFile(fileId: string): Promise<void> {
    const accessToken = await googleAuthService.getAccessToken();
    
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete file: ${response.statusText}`);
    }
  }

  async updateFile(fileId: string, updates: Partial<UploadOptions>): Promise<DriveFileMetadata> {
    const accessToken = await googleAuthService.getAccessToken();
    
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`Failed to update file: ${response.statusText}`);
    }

    const file = await response.json();
    return this.mapDriveFile(file);
  }

  private mapDriveFile(file: any): DriveFileMetadata {
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size ? parseInt(file.size) : undefined,
      createdTime: new Date(file.createdTime),
      modifiedTime: new Date(file.modifiedTime),
      webViewLink: file.webViewLink,
      parents: file.parents,
    };
  }

  // Smart Reader specific methods
  async saveBook(bookData: any): Promise<DriveFileMetadata> {
    const blob = new Blob([JSON.stringify(bookData)], { type: 'application/json' });
    return await this.uploadFile(blob, {
      name: `${bookData.title}.json`,
      mimeType: 'application/json',
      description: `Smart Reader book: ${bookData.title}`,
    });
  }

  async saveNotes(notesData: any[]): Promise<DriveFileMetadata> {
    const blob = new Blob([JSON.stringify(notesData)], { type: 'application/json' });
    return await this.uploadFile(blob, {
      name: 'notes.json',
      mimeType: 'application/json',
      description: 'Smart Reader notes',
    });
  }

  async saveAudio(audioBlob: Blob, metadata: any): Promise<DriveFileMetadata> {
    return await this.uploadFile(audioBlob, {
      name: `${metadata.title}.wav`,
      mimeType: 'audio/wav',
      description: `Smart Reader audio: ${metadata.title}`,
    });
  }

  async loadBook(fileId: string): Promise<any> {
    const blob = await this.downloadFile(fileId);
    const text = await blob.text();
    return JSON.parse(text);
  }

  async loadNotes(fileId: string): Promise<any[]> {
    const blob = await this.downloadFile(fileId);
    const text = await blob.text();
    return JSON.parse(text);
  }

  async loadAudio(fileId: string): Promise<Blob> {
    return await this.downloadFile(fileId);
  }
}

export const googleDriveService = new GoogleDriveService();
