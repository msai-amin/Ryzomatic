// Simple Google OAuth implementation using the most basic approach
// This should be more reliable than the complex Identity Services approach

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
}

class SimpleGoogleAuth {
  private clientId: string;
  private isInitialized = false;
  private currentUser: GoogleUser | null = null;

  constructor() {
    this.clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    
    // Only log error if this service is actually being used
    // Since we're using Supabase OAuth, this is just a fallback service
    if (!this.clientId && import.meta.env.NODE_ENV === 'development') {
      console.warn('Google Client ID is not configured for simpleGoogleAuth (using Supabase OAuth instead)');
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      // Check if Google Identity Services is already loaded
      if (typeof window !== 'undefined' && window.google && window.google.accounts) {
        console.log('Google Identity Services already loaded');
        this.isInitialized = true;
        resolve();
        return;
      }

      // Wait for Google Identity Services to load
      const checkGoogle = () => {
        if (window.google && window.google.accounts) {
          console.log('Google Identity Services loaded');
          this.isInitialized = true;
          resolve();
        } else {
          setTimeout(checkGoogle, 100);
        }
      };

      // Start checking after a short delay
      setTimeout(checkGoogle, 100);
    });
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

  private handleCredentialResponse = (response: any) => {
    try {
      console.log('Received credential response:', response);
      
      // Clean up any hidden buttons
      const hiddenButtons = document.querySelectorAll('div[style*="position: fixed"][style*="top: -1000px"]');
      hiddenButtons.forEach(button => {
        if (document.body.contains(button)) {
          document.body.removeChild(button);
        }
      });
      
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
  };

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

      // Use the simplest possible approach - just call prompt
      try {
        console.log('Attempting Google sign-in...');
        
      // Initialize with callback and disable FedCM
      window.google.accounts.id.initialize({
        client_id: this.clientId,
        callback: this.handleCredentialResponse,
        use_fedcm_for_prompt: false, // Disable FedCM to avoid CORS issues
        auto_select: false,
        cancel_on_tap_outside: true
      });

      // Skip the prompt and go directly to renderButton approach
      console.log('Using renderButton approach to avoid CORS issues...');
      
      // Create a button and click it
      const buttonDiv = document.createElement('div');
      buttonDiv.style.position = 'fixed';
      buttonDiv.style.top = '-1000px';
      buttonDiv.style.left = '-1000px';
      buttonDiv.style.visibility = 'hidden';
      document.body.appendChild(buttonDiv);

      try {
        window.google.accounts.id.renderButton(buttonDiv, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          shape: 'rectangular',
          text: 'signin_with',
          callback: this.handleCredentialResponse
        });

        // Click the button programmatically after a short delay
        setTimeout(() => {
          const button = buttonDiv.querySelector('div[role="button"]') as HTMLElement;
          if (button) {
            console.log('Clicking Google sign-in button...');
            button.click();
            
            // Clean up the button after 10 seconds if no response
            setTimeout(() => {
              if (document.body.contains(buttonDiv)) {
                document.body.removeChild(buttonDiv);
              }
            }, 10000);
          } else {
            console.error('Could not find Google sign-in button');
            document.body.removeChild(buttonDiv);
            reject(new Error('Could not create sign-in button'));
          }
        }, 500);
      } catch (error) {
        console.error('Error creating Google sign-in button:', error);
        document.body.removeChild(buttonDiv);
        reject(new Error(`Failed to create sign-in button: ${error}`));
      }
      } catch (error) {
        console.error('Error during sign-in:', error);
        window.removeEventListener('googleSignIn', handleSignIn as EventListener);
        reject(new Error(`Sign-in failed: ${error}`));
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

export const simpleGoogleAuth = new SimpleGoogleAuth();
