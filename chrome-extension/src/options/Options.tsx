import React, { useState, useEffect } from 'react';
import { isAuthenticated, getCurrentUser, signOut, signIn } from '@shared/auth';
import {
  getSettings,
  updateSettings,
  resetSettings,
  clearStorage,
} from '@shared/storage';
import {
  User,
  ExtensionSettings,
  HIGHLIGHT_COLORS,
  HighlightColorId,
} from '@shared/types';

export function Options() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Auth form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const isAuth = await isAuthenticated();
      setAuthenticated(isAuth);

      if (isAuth) {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      }

      const currentSettings = await getSettings();
      setSettings(currentSettings);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      const result = await signIn(email, password);
      if (result.error) {
        setAuthError(result.error);
      } else {
        setAuthenticated(true);
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        setEmail('');
        setPassword('');
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setAuthenticated(false);
    setUser(null);
    setMessage({ type: 'success', text: 'Signed out successfully' });
  };

  const handleSettingChange = async (
    key: keyof ExtensionSettings,
    value: ExtensionSettings[keyof ExtensionSettings]
  ) => {
    if (!settings) return;

    setSaving(true);
    try {
      const updated = await updateSettings({ [key]: value });
      setSettings(updated);
      setMessage({ type: 'success', text: 'Settings saved' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleResetSettings = async () => {
    if (!confirm('Reset all settings to defaults?')) return;

    setSaving(true);
    try {
      const defaultSettings = await resetSettings();
      setSettings(defaultSettings);
      setMessage({ type: 'success', text: 'Settings reset to defaults' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to reset settings' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleClearAllData = async () => {
    if (!confirm('This will sign you out and clear all extension data. Continue?')) return;

    try {
      await clearStorage();
      setAuthenticated(false);
      setUser(null);
      const defaultSettings = await getSettings();
      setSettings(defaultSettings);
      setMessage({ type: 'success', text: 'All data cleared' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to clear data' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <header style={styles.header}>
          <h1 style={styles.title}>Ryzomatic Extension Settings</h1>
          <p style={styles.subtitle}>Configure your research assistant</p>
        </header>

        {message && (
          <div
            style={{
              ...styles.message,
              ...(message.type === 'error' ? styles.messageError : styles.messageSuccess),
            }}
          >
            {message.text}
          </div>
        )}

        {/* Account Section */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Account</h2>

          {authenticated && user ? (
            <div style={styles.card}>
              <div style={styles.accountInfo}>
                <div style={styles.avatar}>
                  {user.full_name?.[0] || user.email?.[0] || '?'}
                </div>
                <div style={styles.accountDetails}>
                  <span style={styles.accountName}>
                    {user.full_name || user.email?.split('@')[0]}
                  </span>
                  <span style={styles.accountEmail}>{user.email}</span>
                </div>
              </div>
              <div style={styles.accountActions}>
                <button
                  onClick={() => chrome.tabs.create({ url: 'https://ryzomatic.net/settings' })}
                  style={styles.secondaryButton}
                >
                  Account Settings
                </button>
                <button onClick={handleSignOut} style={styles.dangerButton}>
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div style={styles.card}>
              <form onSubmit={handleSignIn} style={styles.authForm}>
                {authError && <div style={styles.authError}>{authError}</div>}
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={styles.input}
                    required
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={styles.input}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  style={styles.primaryButton}
                >
                  {authLoading ? 'Signing in...' : 'Sign In'}
                </button>
                <p style={styles.authHelp}>
                  Don't have an account?{' '}
                  <a
                    href="https://ryzomatic.net?auth=true"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.link}
                  >
                    Create one
                  </a>
                </p>
              </form>
            </div>
          )}
        </section>

        {/* Highlighting Settings */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Highlighting</h2>
          <div style={styles.card}>
            <div style={styles.settingRow}>
              <div style={styles.settingInfo}>
                <span style={styles.settingLabel}>Default Highlight Color</span>
                <span style={styles.settingDescription}>
                  Color used when saving highlights without selecting a specific color
                </span>
              </div>
              <div style={styles.colorPicker}>
                {HIGHLIGHT_COLORS.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => handleSettingChange('defaultHighlightColor', color.id as HighlightColorId)}
                    style={{
                      ...styles.colorButton,
                      backgroundColor: color.hex,
                      ...(settings?.defaultHighlightColor === color.id ? styles.colorButtonActive : {}),
                    }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <div style={styles.settingRow}>
              <div style={styles.settingInfo}>
                <span style={styles.settingLabel}>Show Selection Toolbar</span>
                <span style={styles.settingDescription}>
                  Display a toolbar when you select text on web pages
                </span>
              </div>
              <label style={styles.toggle}>
                <input
                  type="checkbox"
                  checked={settings?.showSelectionToolbar ?? true}
                  onChange={(e) => handleSettingChange('showSelectionToolbar', e.target.checked)}
                  style={styles.toggleInput}
                />
                <span style={styles.toggleSlider} />
              </label>
            </div>
          </div>
        </section>

        {/* Notifications Settings */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Notifications</h2>
          <div style={styles.card}>
            <div style={styles.settingRow}>
              <div style={styles.settingInfo}>
                <span style={styles.settingLabel}>Enable Notifications</span>
                <span style={styles.settingDescription}>
                  Show notifications when saving pages and highlights
                </span>
              </div>
              <label style={styles.toggle}>
                <input
                  type="checkbox"
                  checked={settings?.notificationsEnabled ?? true}
                  onChange={(e) => handleSettingChange('notificationsEnabled', e.target.checked)}
                  style={styles.toggleInput}
                />
                <span style={styles.toggleSlider} />
              </label>
            </div>
          </div>
        </section>

        {/* Data Management */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Data Management</h2>
          <div style={styles.card}>
            <div style={styles.settingRow}>
              <div style={styles.settingInfo}>
                <span style={styles.settingLabel}>Reset Settings</span>
                <span style={styles.settingDescription}>
                  Restore all settings to their default values
                </span>
              </div>
              <button onClick={handleResetSettings} style={styles.secondaryButton}>
                Reset
              </button>
            </div>

            <div style={styles.settingRow}>
              <div style={styles.settingInfo}>
                <span style={styles.settingLabel}>Clear All Data</span>
                <span style={styles.settingDescription}>
                  Sign out and remove all local extension data
                </span>
              </div>
              <button onClick={handleClearAllData} style={styles.dangerButton}>
                Clear Data
              </button>
            </div>
          </div>
        </section>

        {/* About */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>About</h2>
          <div style={styles.card}>
            <div style={styles.aboutInfo}>
              <p style={styles.aboutText}>
                <strong>Ryzomatic Extension</strong> v1.0.0
              </p>
              <p style={styles.aboutText}>
                Save web pages, PDFs, and highlights to your research library.
              </p>
              <div style={styles.aboutLinks}>
                <a
                  href="https://ryzomatic.net"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.link}
                >
                  Open Ryzomatic
                </a>
                <span style={styles.linkDivider}>•</span>
                <a
                  href="https://ryzomatic.net/help"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.link}
                >
                  Help Center
                </a>
                <span style={styles.linkDivider}>•</span>
                <a
                  href="https://ryzomatic.net/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.link}
                >
                  Privacy Policy
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#0f0f0f',
    color: '#e0e0e0',
  },
  content: {
    maxWidth: '640px',
    margin: '0 auto',
    padding: '32px 24px',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    fontSize: '16px',
    color: '#9ca3af',
  },
  header: {
    marginBottom: '32px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#ffffff',
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: '16px',
    color: '#9ca3af',
    margin: 0,
  },
  message: {
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '24px',
    fontSize: '14px',
  },
  messageSuccess: {
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    color: '#10b981',
  },
  messageError: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#f87171',
  },
  section: {
    marginBottom: '32px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    margin: '0 0 12px 0',
  },
  card: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '20px',
  },
  accountInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '16px',
  },
  avatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontSize: '20px',
    fontWeight: '600',
  },
  accountDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  accountName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
  },
  accountEmail: {
    fontSize: '14px',
    color: '#9ca3af',
  },
  accountActions: {
    display: 'flex',
    gap: '12px',
  },
  authForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  authError: {
    padding: '10px 12px',
    borderRadius: '8px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#f87171',
    fontSize: '13px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#d1d5db',
  },
  input: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #374151',
    background: '#0f0f0f',
    color: '#ffffff',
    fontSize: '14px',
    outline: 'none',
  },
  authHelp: {
    fontSize: '13px',
    color: '#9ca3af',
    textAlign: 'center',
    margin: 0,
  },
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid #2a2a2a',
  },
  settingInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
  },
  settingLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#ffffff',
  },
  settingDescription: {
    fontSize: '12px',
    color: '#6b7280',
  },
  colorPicker: {
    display: 'flex',
    gap: '6px',
  },
  colorButton: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '2px solid transparent',
    cursor: 'pointer',
    transition: 'transform 0.15s, border-color 0.15s',
  },
  colorButtonActive: {
    borderColor: '#ffffff',
    transform: 'scale(1.1)',
  },
  toggle: {
    position: 'relative',
    display: 'inline-block',
    width: '44px',
    height: '24px',
  },
  toggleInput: {
    opacity: 0,
    width: 0,
    height: 0,
  },
  toggleSlider: {
    position: 'absolute',
    cursor: 'pointer',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#374151',
    borderRadius: '24px',
    transition: 'background-color 0.2s',
  },
  primaryButton: {
    padding: '12px 20px',
    borderRadius: '8px',
    border: 'none',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: '1px solid #374151',
    background: 'transparent',
    color: '#d1d5db',
    fontSize: '13px',
    cursor: 'pointer',
  },
  dangerButton: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#f87171',
    fontSize: '13px',
    cursor: 'pointer',
  },
  aboutInfo: {
    textAlign: 'center',
  },
  aboutText: {
    fontSize: '14px',
    color: '#9ca3af',
    margin: '0 0 8px 0',
  },
  aboutLinks: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '12px',
  },
  link: {
    color: '#10b981',
    textDecoration: 'none',
    fontSize: '13px',
  },
  linkDivider: {
    color: '#374151',
  },
};

