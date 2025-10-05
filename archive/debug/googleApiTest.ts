/**
 * Google API Test Utility
 * Helps debug Google API initialization issues
 */

export const testGoogleApiConfig = () => {
  console.log('=== Google API Configuration Test ===');
  
  // Check environment variables
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
  
  console.log('Client ID configured:', !!clientId);
  console.log('Client ID (first 20 chars):', clientId ? clientId.substring(0, 20) + '...' : 'NOT SET');
  console.log('API Key configured:', !!apiKey);
  console.log('API Key (first 20 chars):', apiKey ? apiKey.substring(0, 20) + '...' : 'NOT SET');
  
  // Check if gapi is available
  console.log('gapi available:', typeof window !== 'undefined' && !!window.gapi);
  
  if (typeof window !== 'undefined' && window.gapi) {
    console.log('gapi.client available:', !!window.gapi.client);
    console.log('gapi.auth2 available:', !!window.gapi.auth2);
    
    if (window.gapi.client) {
      console.log('gapi.client.init available:', typeof window.gapi.client.init === 'function');
    }
  }
  
  // Check for common issues
  if (!clientId) {
    console.error('❌ VITE_GOOGLE_CLIENT_ID is not set in .env file');
  } else {
    console.log('✅ Client ID is configured');
  }
  
  if (!apiKey) {
    console.error('❌ VITE_GOOGLE_API_KEY is not set in .env file');
  } else {
    console.log('✅ API Key is configured');
  }
  
  if (typeof window === 'undefined') {
    console.error('❌ Window object not available (SSR issue)');
  } else {
    console.log('✅ Window object available');
  }
  
  if (typeof window !== 'undefined' && !window.gapi) {
    console.warn('⚠️ Google API script not loaded yet');
  } else if (typeof window !== 'undefined' && window.gapi) {
    console.log('✅ Google API script loaded');
  }
  
  console.log('=== End Configuration Test ===');
};

// Auto-run test in development
if (import.meta.env.DEV && false) { // Temporarily disabled
  // Run test after a short delay to allow scripts to load
  setTimeout(testGoogleApiConfig, 1000);
}
