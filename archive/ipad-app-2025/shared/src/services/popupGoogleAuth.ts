// Alternative Google OAuth using popup window approach
// This bypasses the Google Identity Services CORS issues

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
}

class PopupGoogleAuth {
  private clientId: string;
  private currentUser: GoogleUser | null = null;

  constructor() {
    this.clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    
    if (!this.clientId) {
      console.error('Google Client ID is not configured');
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
    return new Promise((resolve, reject) => {
      if (!this.clientId) {
        reject(new Error('Google Client ID is not configured'));
        return;
      }

      // Create OAuth URL
      const redirectUri = encodeURIComponent(window.location.origin);
      const scope = encodeURIComponent('openid email profile');
      const responseType = 'code';
      const oauthUrl = `https://accounts.google.com/oauth/authorize?` +
        `client_id=${this.clientId}&` +
        `redirect_uri=${redirectUri}&` +
        `scope=${scope}&` +
        `response_type=${responseType}&` +
        `access_type=offline&` +
        `prompt=select_account`;

      console.log('Opening OAuth popup...');

      // Open popup window
      const popup = window.open(
        oauthUrl,
        'googleOAuth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        reject(new Error('Popup blocked. Please allow popups for this site.'));
        return;
      }

      // Listen for popup messages
      const messageListener = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'GOOGLE_OAUTH_SUCCESS') {
          window.removeEventListener('message', messageListener);
          popup.close();
          
          try {
            const payload = this.decodeJWT(event.data.credential);
            
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
            resolve(this.currentUser);
          } catch (error) {
            console.error('Error processing OAuth response:', error);
            reject(new Error('Failed to process OAuth response'));
          }
        } else if (event.data.type === 'GOOGLE_OAUTH_ERROR') {
          window.removeEventListener('message', messageListener);
          popup.close();
          reject(new Error(event.data.error || 'OAuth failed'));
        }
      };

      window.addEventListener('message', messageListener);

      // Check if popup was closed manually
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageListener);
          reject(new Error('OAuth popup was closed'));
        }
      }, 1000);

      // Timeout after 5 minutes
      setTimeout(() => {
        if (!popup.closed) {
          popup.close();
        }
        clearInterval(checkClosed);
        window.removeEventListener('message', messageListener);
        reject(new Error('OAuth timeout'));
      }, 300000);
    });
  }

  async signOut(): Promise<void> {
    this.currentUser = null;
    localStorage.removeItem('google_user');
    console.log('User signed out successfully');
  }

  getCurrentUser(): GoogleUser | null {
    return this.currentUser;
  }

  isSignedIn(): boolean {
    return this.currentUser !== null;
  }
}

export const popupGoogleAuth = new PopupGoogleAuth();
