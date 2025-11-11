/**
 * Google Authentication Service
 * Handles Google OAuth and Drive API integration
 */

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture: string;
  accessToken: string;
  refreshToken?: string;
  givenName?: string;
  familyName?: string;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
  modifiedTime: string;
  webViewLink?: string;
  webContentLink?: string;
}

class GoogleAuthService {
  private clientId: string;
  private apiKey: string;
  private discoveryDocs: string[] = [
    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
  ];
  private scopes: string = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
  private driveScope = 'https://www.googleapis.com/auth/drive.file';
  private gapi: any = null;
  private isInitialized = false;
  private currentUser: GoogleUser | null = null;

  constructor() {
    this.clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    this.apiKey = import.meta.env.VITE_GOOGLE_API_KEY || '';
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      // Check if gapi is already loaded
      if (typeof window !== 'undefined' && window.gapi) {
        this.gapi = window.gapi;
        
        // If client is already available, initialize directly
        if (window.gapi.client) {
          console.log('Google API client already available');
          this.initializeGapi().then(resolve).catch(reject);
        } else {
          // Load client libraries first
          console.log('Loading Google API client libraries...');
          
          // Use a more robust loading approach
          const loadClient = () => {
            if (window.gapi && window.gapi.load) {
              window.gapi.load('client:auth2', () => {
                console.log('Client libraries loaded, waiting for client to be ready...');
                
                // Wait for client to be available
                let attempts = 0;
                const maxAttempts = 50;
                
                const waitForClient = () => {
                  attempts++;
                  if (this.gapi && this.gapi.client) {
                    console.log('Google API client is ready');
                    this.initializeGapi().then(resolve).catch(reject);
                  } else if (attempts >= maxAttempts) {
                    reject(new Error('Google API client failed to load after 5 seconds'));
                  } else {
                    console.log(`Waiting for Google API client... (${attempts}/${maxAttempts})`);
                    setTimeout(waitForClient, 100);
                  }
                };
                
                waitForClient();
              });
            } else {
              // If gapi.load is not available, wait a bit and try again
              console.log('gapi.load not available, retrying...');
              setTimeout(loadClient, 100);
            }
          };
          
          loadClient();
        }
        return;
      }

      // Load Google API script
      if (typeof window !== 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.async = true;
        script.defer = true;
        
        script.onload = () => {
          console.log('Google API script loaded');
          if (window.gapi) {
            window.gapi.load('client:auth2', () => {
              console.log('Google API client loaded');
              this.gapi = window.gapi;
              
              // Wait for client to be available with timeout
              let attempts = 0;
              const maxAttempts = 50; // 5 seconds max wait
              
              const waitForClient = () => {
                attempts++;
                if (this.gapi && this.gapi.client) {
                  console.log('Google API client is ready');
                  this.initializeGapi().then(resolve).catch(reject);
                } else if (attempts >= maxAttempts) {
                  reject(new Error('Google API client failed to load after 5 seconds'));
                } else {
                  console.log(`Waiting for Google API client... (${attempts}/${maxAttempts})`);
                  setTimeout(waitForClient, 100);
                }
              };
              
              waitForClient();
            });
          } else {
            reject(new Error('Google API not available after script load'));
          }
        };
        
        script.onerror = () => {
          console.error('Failed to load Google API script');
          reject(new Error('Failed to load Google API script'));
        };
        
        document.head.appendChild(script);
      } else {
        reject(new Error('Window object not available'));
      }
    });
  }

  private async initializeGapi(): Promise<void> {
    try {
      // Validate gapi and client
      if (!this.gapi) {
        throw new Error('Google API not loaded');
      }
      if (!this.gapi.client) {
        throw new Error('Google API client not available');
      }
      if (typeof this.gapi.client.init !== 'function') {
        throw new Error('Google API client.init is not a function');
      }

      // Validate credentials
      if (!this.clientId) {
        throw new Error('Google Client ID is not configured. Please check your .env file.');
      }
      if (!this.apiKey) {
        throw new Error('Google API Key is not configured. Please check your .env file.');
      }

      console.log('Initializing Google API with Client ID:', this.clientId.substring(0, 20) + '...');
      
      await this.gapi.client.init({
        apiKey: this.apiKey,
        clientId: this.clientId,
        discoveryDocs: this.discoveryDocs,
        scope: this.scopes
      });

      this.isInitialized = true;
      console.log('Google API initialized successfully');
      
      // Check if user is already signed in
      const authInstance = this.gapi.auth2.getAuthInstance();
      if (authInstance && authInstance.isSignedIn.get()) {
        const user = authInstance.currentUser.get();
        this.currentUser = this.mapGoogleUser(user);
        this.persistCurrentUser();
        console.log('User already signed in:', this.currentUser.email);
      }
    } catch (error) {
      console.error('Error initializing Google API:', error);
      
      // Try to get more specific error information
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object') {
        // Handle Google API specific errors
        if ('error' in error) {
          const errorStr = JSON.stringify(error.error);
          errorMessage = `Google API Error: ${errorStr}`;
          
          // Handle specific known errors
          if (errorStr.includes('idpiframe_initialization_failed')) {
            errorMessage = 'Google OAuth iframe failed to initialize. This is usually due to Content Security Policy restrictions or browser security settings. Please try refreshing the page or using a different browser.';
          } else if (errorStr.includes('popup_blocked_by_browser')) {
            errorMessage = 'Google OAuth popup was blocked by your browser. Please allow popups for this site and try again.';
          } else if (errorStr.includes('access_denied')) {
            errorMessage = 'Access denied. You may have cancelled the Google sign-in process.';
          }
        } else if ('details' in error) {
          errorMessage = `Google API Error: ${JSON.stringify(error.details)}`;
        } else {
          errorMessage = `Google API Error: ${JSON.stringify(error)}`;
        }
      }
      
      throw new Error(`Failed to initialize Google API: ${errorMessage}`);
    }
  }

  async signIn(): Promise<GoogleUser> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const authInstance = this.gapi.auth2.getAuthInstance();
      
      // Try popup-based sign-in first (more reliable for OAuth)
      const user = await authInstance.signIn({
        ux_mode: 'popup'
      });
      
      this.currentUser = this.mapGoogleUser(user);
      this.persistCurrentUser();
      return this.currentUser;
    } catch (error) {
      console.error('Error signing in:', error);
      
      // If popup fails, try redirect-based sign-in
      try {
        console.log('Popup failed, trying redirect-based sign-in...');
        const authInstance = this.gapi.auth2.getAuthInstance();
        const user = await authInstance.signIn({
          ux_mode: 'redirect'
        });
        
        this.currentUser = this.mapGoogleUser(user);
        this.persistCurrentUser();
        return this.currentUser;
      } catch (redirectError) {
        console.error('Redirect sign in also failed:', redirectError);
        throw new Error('Failed to sign in with Google');
      }
    }
  }

  private persistCurrentUser(): void {
    if (!this.currentUser) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    try {
      const storagePayload = {
        id: this.currentUser.id,
        email: this.currentUser.email,
        name: this.currentUser.name,
        picture: this.currentUser.picture,
        given_name: this.currentUser.givenName || this.currentUser.name?.split(' ')[0] || '',
        family_name: this.currentUser.familyName || '',
      };

      window.localStorage.setItem('google_user', JSON.stringify(storagePayload));
      window.localStorage.setItem('google_auth_user', JSON.stringify(this.currentUser));
    } catch (error) {
      console.warn('Failed to persist Google user to storage', error);
    }
  }

  async hasDriveScope(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const authInstance = this.gapi?.auth2?.getAuthInstance?.();
      if (!authInstance) {
        return false;
      }

      const user = authInstance.currentUser.get();
      if (!user || typeof user.hasGrantedScopes !== 'function') {
        return false;
      }

      const hasScope = user.hasGrantedScopes(this.driveScope);
      if (hasScope && !this.currentUser) {
        this.currentUser = this.mapGoogleUser(user);
        this.persistCurrentUser();
      }
      return hasScope;
    } catch (error) {
      console.warn('googleAuthService.hasDriveScope failed', error);
      return false;
    }
  }

  async ensureDriveAccess(options: { forcePrompt?: boolean } = {}): Promise<boolean> {
    try {
      await this.initialize();
    } catch (error) {
      console.error('Failed to initialize Google API before requesting Drive access', error);
      return false;
    }

    const authInstance = this.gapi?.auth2?.getAuthInstance?.();
    if (!authInstance) {
      console.warn('Google auth instance not available to request Drive access');
      return false;
    }

    try {
      let user = authInstance.currentUser.get();
      const alreadyGranted = user && typeof user.hasGrantedScopes === 'function'
        ? user.hasGrantedScopes(this.driveScope)
        : false;

      if (alreadyGranted && !options.forcePrompt) {
        this.currentUser = this.mapGoogleUser(user);
        this.persistCurrentUser();
        return true;
      }

      user = await authInstance.signIn({
        scope: this.scopes,
        prompt: options.forcePrompt ? 'consent select_account' : 'consent'
      });

      const granted = user && typeof user.hasGrantedScopes === 'function'
        ? user.hasGrantedScopes(this.driveScope)
        : false;

      if (granted) {
        this.currentUser = this.mapGoogleUser(user);
        this.persistCurrentUser();
      }

      return granted;
    } catch (error) {
      console.warn('User declined or failed Google Drive consent', error);
      return false;
    }
  }

  async signOut(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const authInstance = this.gapi.auth2.getAuthInstance();
      await authInstance.signOut();
      this.currentUser = null;
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('google_user');
        window.localStorage.removeItem('google_auth_user');
      }
    } catch (error) {
      console.error('Error signing out:', error);
      throw new Error('Failed to sign out');
    }
  }

  getCurrentUser(): GoogleUser | null {
    if (this.currentUser) {
      return this.currentUser;
    }

    // Try to restore from localStorage
    if (typeof window === 'undefined') {
      return null;
    }

    const storedAuth = window.localStorage.getItem('google_auth_user');
    if (storedAuth) {
      try {
        this.currentUser = JSON.parse(storedAuth) as GoogleUser;
        return this.currentUser;
      } catch (error) {
        window.localStorage.removeItem('google_auth_user');
      }
    }

    const stored = window.localStorage.getItem('google_user');
    if (stored) {
      try {
        const legacy = JSON.parse(stored) as {
          id: string;
          email: string;
          name: string;
          picture: string;
          given_name?: string;
          family_name?: string;
        };
        this.currentUser = {
          id: legacy.id,
          email: legacy.email,
          name: legacy.name,
          picture: legacy.picture,
          givenName: legacy.given_name,
          familyName: legacy.family_name,
          accessToken: '',
        };
        return this.currentUser;
      } catch (error) {
        window.localStorage.removeItem('google_user');
      }
    }

    return null;
  }

  isSignedIn(): boolean {
    return this.currentUser !== null;
  }

  private mapGoogleUser(googleUser: any): GoogleUser {
    const profile = googleUser.getBasicProfile();
    const authResponse = googleUser.getAuthResponse(true);
    
    return {
      id: profile.getId(),
      email: profile.getEmail(),
      name: profile.getName(),
      picture: profile.getImageUrl(),
      givenName: typeof profile.getGivenName === 'function' ? profile.getGivenName() : undefined,
      familyName: typeof profile.getFamilyName === 'function' ? profile.getFamilyName() : undefined,
      accessToken: authResponse.access_token,
      refreshToken: authResponse.refresh_token
    };
  }

  async refreshAccessToken(): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const authInstance = this.gapi.auth2.getAuthInstance();
      const user = authInstance.currentUser.get();
      await user.reloadAuthResponse();
      
      const authResponse = user.getAuthResponse(true);
      this.currentUser!.accessToken = authResponse.access_token;
      
      // Update stored user
      this.persistCurrentUser();
      
      return authResponse.access_token;
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  async getAccessToken(): Promise<string> {
    if (!this.currentUser) {
      throw new Error('User not signed in');
    }

    // Check if token is expired (basic check)
    const tokenExpiry = typeof window !== 'undefined'
      ? window.localStorage.getItem('google_token_expiry')
      : null;
    if (tokenExpiry && Date.now() > parseInt(tokenExpiry)) {
      return await this.refreshAccessToken();
    }

    return this.currentUser.accessToken;
  }
}

export const googleAuthService = new GoogleAuthService();
