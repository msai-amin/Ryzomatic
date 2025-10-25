// Modern Google Identity Services implementation
// This uses the newer Google Identity Services instead of the deprecated gapi.auth2

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
}

export interface GoogleCredentialResponse {
  credential: string;
  select_by: string;
}

class GoogleIdentityService {
  private clientId: string;
  private isInitialized = false;
  private currentUser: GoogleUser | null = null;

  constructor() {
    this.clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    
    // Only log error if this service is actually being used
    // Since we're using Supabase OAuth, this is just a fallback service
    if (!this.clientId && import.meta.env.NODE_ENV === 'development') {
      console.warn('Google Client ID is not configured for googleIdentityService (using Supabase OAuth instead)');
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      // Check if Google Identity Services is already loaded
      if (typeof window !== 'undefined' && window.google) {
        console.log('Google Identity Services already loaded');
        this.initializeGoogleIdentity().then(resolve).catch(reject);
        return;
      }

      // Wait for Google Identity Services to load
      const checkGoogle = () => {
        if (window.google && window.google.accounts) {
          console.log('Google Identity Services loaded');
          this.initializeGoogleIdentity().then(resolve).catch(reject);
        } else {
          setTimeout(checkGoogle, 100);
        }
      };

      // Start checking after a short delay
      setTimeout(checkGoogle, 100);
    });
  }

  private async initializeGoogleIdentity(): Promise<void> {
    try {
      if (!window.google || !window.google.accounts) {
        throw new Error('Google Identity Services not available');
      }

      if (!this.clientId) {
        throw new Error('Google Client ID is not configured');
      }

      // Initialize Google Identity Services with modern configuration
      window.google.accounts.id.initialize({
        client_id: this.clientId,
        callback: this.handleCredentialResponse.bind(this),
        auto_select: false,
        cancel_on_tap_outside: true,
        // Modern configuration for better compatibility
        ux_mode: 'popup',
        context: 'signin',
        // Add FedCM support
        use_fedcm_for_prompt: true
      });

      this.isInitialized = true;
      console.log('Google Identity Services initialized successfully');

      // Check if user is already signed in
      const savedUser = localStorage.getItem('google_user');
      if (savedUser) {
        try {
          this.currentUser = JSON.parse(savedUser);
          console.log('User already signed in:', this.currentUser?.email);
        } catch (error) {
          console.error('Error parsing saved user:', error);
          localStorage.removeItem('google_user');
        }
      }
    } catch (error) {
      console.error('Error initializing Google Identity Services:', error);
      throw new Error(`Failed to initialize Google Identity Services: ${error}`);
    }
  }

  private handleCredentialResponse(response: GoogleCredentialResponse): void {
    try {
      // Decode the JWT token to get user information
      const payload = this.decodeJWT(response.credential);
      
      this.currentUser = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        given_name: payload.given_name,
        family_name: payload.family_name
      };

      // Store user info in localStorage
      localStorage.setItem('google_user', JSON.stringify(this.currentUser));
      
      console.log('User signed in successfully:', this.currentUser.email);
      
      // Dispatch a custom event to notify components
      window.dispatchEvent(new CustomEvent('googleSignIn', { 
        detail: this.currentUser 
      }));
    } catch (error) {
      console.error('Error handling credential response:', error);
    }
  }

  private decodeJWT(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding JWT:', error);
      throw new Error('Failed to decode JWT token');
    }
  }

  async signIn(): Promise<GoogleUser> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      if (!window.google || !window.google.accounts) {
        reject(new Error('Google Identity Services not available'));
        return;
      }

      // Set up a one-time listener for the sign-in event
      const handleSignIn = (event: CustomEvent) => {
        window.removeEventListener('googleSignIn', handleSignIn as EventListener);
        if (this.currentUser) {
          resolve(this.currentUser);
        } else {
          reject(new Error('Sign in failed'));
        }
      };

      window.addEventListener('googleSignIn', handleSignIn as EventListener);

      // Try the modern prompt method first
      try {
        window.google.accounts.id.prompt((notification: any) => {
          console.log('Google prompt notification:', notification);
          
          // Handle different notification types
          if (notification.isNotDisplayed()) {
            console.log('Prompt not displayed, trying alternative method...');
            // Try alternative sign-in method
            this.tryAlternativeSignIn().then(resolve).catch(reject);
          } else if (notification.isSkippedMoment()) {
            console.log('Prompt skipped');
            window.removeEventListener('googleSignIn', handleSignIn as EventListener);
            reject(new Error('Sign in was skipped or cancelled by user.'));
          } else if (notification.isDismissedMoment()) {
            console.log('Prompt dismissed');
            window.removeEventListener('googleSignIn', handleSignIn as EventListener);
            reject(new Error('Sign in was dismissed by user.'));
          }
          // If none of the above, the prompt is displayed and we wait for user action
        });
      } catch (error) {
        console.error('Error triggering Google sign-in:', error);
        // Try alternative method
        this.tryAlternativeSignIn().then(resolve).catch(reject);
      }
    });
  }

  private async tryAlternativeSignIn(): Promise<GoogleUser> {
    // Alternative method using renderButton approach
    return new Promise((resolve, reject) => {
      // Create a temporary button element for Google sign-in
      const buttonDiv = document.createElement('div');
      buttonDiv.style.display = 'none';
      document.body.appendChild(buttonDiv);

      try {
        window.google.accounts.id.renderButton(buttonDiv, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          shape: 'rectangular',
          text: 'signin_with',
          callback: (response: any) => {
            this.handleCredentialResponse(response);
            if (this.currentUser) {
              resolve(this.currentUser);
            } else {
              reject(new Error('Sign in failed'));
            }
            document.body.removeChild(buttonDiv);
          }
        });

        // Programmatically click the button
        const button = buttonDiv.querySelector('div[role="button"]') as HTMLElement;
        if (button) {
          button.click();
        } else {
          throw new Error('Could not create sign-in button');
        }
      } catch (error) {
        document.body.removeChild(buttonDiv);
        reject(new Error(`Alternative sign-in failed: ${error}`));
      }
    });
  }

  async signOut(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if (window.google && window.google.accounts) {
        window.google.accounts.id.disableAutoSelect();
      }
      
      this.currentUser = null;
      localStorage.removeItem('google_user');
      
      console.log('User signed out successfully');
      
      // Dispatch a custom event to notify components
      window.dispatchEvent(new CustomEvent('googleSignOut'));
    } catch (error) {
      console.error('Error signing out:', error);
      throw new Error('Failed to sign out');
    }
  }

  getCurrentUser(): GoogleUser | null {
    return this.currentUser;
  }

  isSignedIn(): boolean {
    return this.currentUser !== null;
  }
}

// Global type declarations
declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: (callback?: (notification: any) => void) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

export const googleIdentityService = new GoogleIdentityService();
