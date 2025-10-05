// Google OAuth Configuration Test
// This utility helps debug Google OAuth setup issues

export function testGoogleOAuthConfig() {
  console.log('=== Google OAuth Configuration Test ===');
  
  // Test 1: Check environment variables
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
  
  console.log('Client ID configured:', !!clientId);
  if (clientId) {
    console.log('Client ID (first 20 chars):', clientId.substring(0, 20) + '...');
  }
  
  console.log('API Key configured:', !!apiKey);
  if (apiKey) {
    console.log('API Key (first 20 chars):', apiKey.substring(0, 20) + '...');
  }
  
  // Test 2: Check current origin
  const currentOrigin = window.location.origin;
  console.log('Current origin:', currentOrigin);
  
  // Test 3: Check Google Identity Services
  console.log('Google Identity Services available:', !!(window as any).google?.accounts?.id);
  
  // Test 4: Check if we're on localhost
  const isLocalhost = currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1');
  console.log('Running on localhost:', isLocalhost);
  
  // Test 5: Check for common OAuth issues
  const issues: string[] = [];
  
  if (!clientId) {
    issues.push('❌ Client ID not configured');
  } else {
    console.log('✅ Client ID is configured');
  }
  
  if (!apiKey) {
    issues.push('❌ API Key not configured');
  } else {
    console.log('✅ API Key is configured');
  }
  
  if (!(window as any).google?.accounts?.id) {
    issues.push('❌ Google Identity Services not loaded');
  } else {
    console.log('✅ Google Identity Services loaded');
  }
  
  if (!isLocalhost) {
    issues.push('⚠️ Not running on localhost - OAuth might not work');
  } else {
    console.log('✅ Running on localhost');
  }
  
  // Test 6: Check OAuth redirect URI format
  const expectedOrigins = [
    'http://localhost:3001',
    'http://127.0.0.1:3001'
  ];
  
  const originMatches = expectedOrigins.includes(currentOrigin);
  if (!originMatches) {
    issues.push(`❌ Current origin (${currentOrigin}) doesn't match expected OAuth origins`);
  } else {
    console.log('✅ Current origin matches expected OAuth origins');
  }
  
  // Summary
  console.log('=== Test Summary ===');
  if (issues.length === 0) {
    console.log('✅ All tests passed! OAuth should work.');
  } else {
    console.log('❌ Issues found:');
    issues.forEach(issue => console.log(issue));
    console.log('\n📋 To fix these issues:');
    console.log('1. Make sure your .env file has VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY');
    console.log('2. Add your current origin to Google Cloud Console OAuth settings:');
    console.log(`   - Authorized JavaScript origins: ${currentOrigin}`);
    console.log(`   - Authorized redirect URIs: ${currentOrigin}`);
    console.log('3. Make sure you\'re running on localhost or 127.0.0.1');
  }
  
  console.log('=== End OAuth Test ===');
  
  return {
    clientId: !!clientId,
    apiKey: !!apiKey,
    googleIdentityServices: !!(window as any).google?.accounts?.id,
    isLocalhost,
    originMatches,
    issues
  };
}

// Auto-run the test when imported
if (typeof window !== 'undefined' && false) { // Temporarily disabled
  // Run after a short delay to ensure everything is loaded
  setTimeout(() => {
    testGoogleOAuthConfig();
  }, 1000);
}
