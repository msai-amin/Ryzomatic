import { useState } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { authService, supabase } from '../services/supabaseAuthService';
import Turnstile from 'react-turnstile';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: () => void;
}

export function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    confirmPassword: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setError('');
    setSuccessMessage('');
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      if (isSignUp) {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        if (formData.password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }

        // Check for CAPTCHA token if Turnstile is configured
        const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
        if (turnstileSiteKey && !captchaToken) {
          throw new Error('Please complete the CAPTCHA verification');
        }

        await authService.signUp({
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          captchaToken: captchaToken || undefined,
        });
        
        // Show success message in green
        setSuccessMessage('Check your email for a confirmation link!');
        // Clear form after successful signup
        setFormData({
          email: '',
          password: '',
          fullName: '',
          confirmPassword: '',
        });
        setCaptchaToken(null);
      } else {
        await authService.signIn({
          email: formData.email,
          password: formData.password,
        });
        
        onAuthSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      // Reset CAPTCHA on error
      setCaptchaToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setError('');

    try {
      await authService.signInWithGoogle();
      // User will be redirected to Google OAuth
    } catch (err: any) {
      setError(err.message || 'Google authentication failed');
      setIsLoading(false);
    }
  };

  const getPasswordStrength = (password: string) => {
    if (password.length === 0) return { strength: 0, label: '', color: '' };
    if (password.length < 6) return { strength: 1, label: 'Weak', color: 'var(--color-error)' };
    if (password.length < 8) return { strength: 2, label: 'Fair', color: 'var(--color-warning)' };
    if (password.length < 12) return { strength: 3, label: 'Good', color: 'var(--color-info)' };
    return { strength: 4, label: 'Strong', color: 'var(--color-success)' };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      fullName: '',
      confirmPassword: '',
    });
    setError('');
    setSuccessMessage('');
    setCaptchaToken(null);
    setIsSignUp(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 flex items-start justify-center z-50 pt-20 pb-8 px-4 overflow-y-auto auth-modal" 
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      data-testid="auth-modal"
    >
      <div 
        className="rounded-lg shadow-xl w-full max-w-md animate-scale-in my-auto" 
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center space-x-3">
            <h2 id="auth-modal-title" className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {isSignUp ? 'Create Account' : 'Sign In'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-md flex items-start gap-2" style={{ backgroundColor: 'rgba(248, 113, 113, 0.1)', border: '1px solid var(--color-error)' }}>
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-error)' }} />
              <p className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>
            </div>
          )}
          {successMessage && (
            <div className="mb-4 p-3 rounded-md flex items-start gap-2" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid var(--color-success)' }}>
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-success)' }} />
              <p className="text-sm" style={{ color: 'var(--color-success)' }}>{successMessage}</p>
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-3 py-2 rounded-md focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                      borderRadius: 'var(--border-radius-md)',
                    }}
                    placeholder="Enter your full name"
                    required={isSignUp}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 rounded-md focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--color-background)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                    borderRadius: 'var(--border-radius-md)',
                  }}
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-10 py-2 rounded-md focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--color-background)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                    borderRadius: 'var(--border-radius-md)',
                  }}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {/* Password Strength Indicator */}
              {isSignUp && formData.password && (
                <div className="mt-2">
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${(passwordStrength.strength / 4) * 100}%`,
                          backgroundColor: passwordStrength.color,
                        }}
                      />
                    </div>
                    <span className="text-xs" style={{ color: passwordStrength.color }}>
                      {passwordStrength.label}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {isSignUp && (
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-3 py-2 rounded-md focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                      borderRadius: 'var(--border-radius-md)',
                    }}
                    placeholder="Confirm your password"
                    required={isSignUp}
                  />
                </div>
              </div>
            )}

            {/* Turnstile CAPTCHA - Only show for sign up */}
            {isSignUp && import.meta.env.VITE_TURNSTILE_SITE_KEY && 
             import.meta.env.VITE_TURNSTILE_SITE_KEY.length > 10 && 
             !import.meta.env.VITE_TURNSTILE_SITE_KEY.includes('#') && (
              <div className="flex justify-center">
                <Turnstile
                  sitekey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                  onSuccess={(token) => {
                    console.log('✅ Turnstile CAPTCHA success, token received:', token.substring(0, 20) + '...');
                    setCaptchaToken(token);
                    setError('');
                  }}
                  onError={(error) => {
                    console.error('❌ Turnstile CAPTCHA error:', error);
                    setCaptchaToken(null);
                    setError('CAPTCHA verification failed. Please try again.');
                  }}
                  onExpire={() => {
                    console.warn('⚠️ Turnstile CAPTCHA expired');
                    setCaptchaToken(null);
                  }}
                  theme="auto"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !supabase || (isSignUp && import.meta.env.VITE_TURNSTILE_SITE_KEY && !captchaToken)}
              className="w-full py-2 px-4 rounded-md focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold flex items-center justify-center"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-inverse)',
                borderRadius: 'var(--border-radius-md)',
              }}
              title={!supabase ? 'Authentication is not configured. Please update .env.local' : (isSignUp && import.meta.env.VITE_TURNSTILE_SITE_KEY && !captchaToken) ? 'Please complete the CAPTCHA verification' : ''}
            >
              {isLoading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              )}
              {isLoading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          {/* Show warning if Supabase is not configured */}
          {!supabase && (
            <div 
              className="mt-4 p-4 rounded-lg border-2"
              style={{
                backgroundColor: '#fef3c7',
                borderColor: '#f59e0b',
                color: '#92400e'
              }}
            >
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold mb-1">⚠️ Authentication Not Configured</p>
                  <p className="text-sm mb-2">
                    Supabase API key is missing or invalid. Sign-in will not work until you update your configuration.
                  </p>
                  <ol className="text-sm list-decimal list-inside space-y-1 ml-2">
                    <li>Get your Supabase anon key from the dashboard</li>
                    <li>Update <code className="bg-amber-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> in <code className="bg-amber-100 px-1 rounded">.env.local</code></li>
                    <li>Restart the dev server</li>
                  </ol>
                  <a
                    href="https://supabase.com/dashboard/project/pbfipmvtkbivnwwgukpw/settings/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm underline mt-2 inline-block font-semibold"
                    style={{ color: '#92400e' }}
                  >
                    → Get Supabase API Key
                  </a>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full" style={{ borderTop: '1px solid var(--color-border)' }} />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-secondary)' }}>Or continue with</span>
              </div>
            </div>

            <button
              onClick={handleGoogleAuth}
              disabled={isLoading || !supabase}
              className="mt-4 w-full flex items-center justify-center px-4 py-2 rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
                borderRadius: 'var(--border-radius-md)',
              }}
              title={!supabase ? 'Authentication is not configured. Please update .env.local' : ''}
            >
              {isLoading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
              )}
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
                setSuccessMessage('');
                setCaptchaToken(null);
              }}
              className="text-sm focus:outline-none focus:underline"
              style={{ color: 'var(--color-primary)' }}
            >
              {isSignUp 
                ? 'Already have an account? Sign In' 
                : "Don't have an account? Sign Up"
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}