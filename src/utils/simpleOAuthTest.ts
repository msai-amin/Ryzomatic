// Simple OAuth Test - Check if everything is configured correctly

export function testSimpleOAuth() {
  console.log('=== Simple OAuth Test ===');
  
  // Check environment variables
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  console.log('Client ID configured:', !!clientId);
  if (clientId) {
    console.log('Client ID:', clientId.substring(0, 30) + '...');
  }
  
  // Check current origin
  const origin = window.location.origin;
  console.log('Current origin:', origin);
  
  // Check Google Identity Services
  const hasGoogle = !!(window as any).google?.accounts?.id;
  console.log('Google Identity Services available:', hasGoogle);
  
  // Check if we're on localhost
  const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
  console.log('Running on localhost:', isLocalhost);
  
  // Summary
  if (clientId && hasGoogle && isLocalhost) {
    console.log('✅ All checks passed! OAuth should work.');
    console.log('📋 Make sure you have added this origin to Google Cloud Console:');
    console.log(`   - Authorized JavaScript origins: ${origin}`);
    console.log(`   - Authorized redirect URIs: ${origin}`);
  } else {
    console.log('❌ Some checks failed:');
    if (!clientId) console.log('  - Client ID not configured');
    if (!hasGoogle) console.log('  - Google Identity Services not loaded');
    if (!isLocalhost) console.log('  - Not running on localhost');
  }
  
  console.log('=== End Simple OAuth Test ===');
}

// Auto-run the test
if (typeof window !== 'undefined' && false) { // Temporarily disabled
  setTimeout(() => {
    testSimpleOAuth();
  }, 1000);
}
