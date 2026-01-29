import React, { useState, useEffect } from 'react';
import { AuthForm } from './AuthForm';
import { SavePage } from './SavePage';
import { QuickAccess } from './QuickAccess';
import { isAuthenticated, getCurrentUser, signOut } from '@shared/auth';
import { User } from '@shared/types';

type Tab = 'save' | 'library';

export function Popup() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('save');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const isAuth = await isAuthenticated();
    setAuthenticated(isAuth);
    if (isAuth) {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setAuthenticated(false);
    setUser(null);
  };

  // Loading state
  if (authenticated === null) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.spinner}>⏳</div>
          <p style={styles.loadingText}>Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show login
  if (!authenticated) {
    return (
      <div style={styles.container}>
        <AuthForm onSuccess={checkAuth} />
      </div>
    );
  }

  // Authenticated - show main interface
  return (
    <div style={styles.container}>
      {/* User Header */}
      <div style={styles.userHeader}>
        <div style={styles.userInfo}>
          <div style={styles.avatar}>
            {user?.full_name?.[0] || user?.email?.[0] || '?'}
          </div>
          <div style={styles.userDetails}>
            <span style={styles.userName}>
              {user?.full_name || user?.email?.split('@')[0]}
            </span>
            <span style={styles.userEmail}>{user?.email}</span>
          </div>
        </div>
        <button onClick={handleSignOut} style={styles.signOutButton}>
          Sign Out
        </button>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          onClick={() => setActiveTab('save')}
          style={{
            ...styles.tab,
            ...(activeTab === 'save' ? styles.tabActive : {}),
          }}
        >
          💾 Save Page
        </button>
        <button
          onClick={() => setActiveTab('library')}
          style={{
            ...styles.tab,
            ...(activeTab === 'library' ? styles.tabActive : {}),
          }}
        >
          📚 Library
        </button>
      </div>

      {/* Tab Content */}
      <div style={styles.tabContent}>
        {activeTab === 'save' && <SavePage />}
        {activeTab === 'library' && <QuickAccess />}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <a
          href="https://ryzomatic.net/settings"
          target="_blank"
          rel="noopener noreferrer"
          style={styles.footerLink}
        >
          Settings
        </a>
        <span style={styles.footerDivider}>•</span>
        <a
          href="https://ryzomatic.net/help"
          target="_blank"
          rel="noopener noreferrer"
          style={styles.footerLink}
        >
          Help
        </a>
        <span style={styles.footerDivider}>•</span>
        <span style={styles.footerVersion}>v1.0.0</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '400px',
    display: 'flex',
    flexDirection: 'column',
    background: '#0f0f0f',
  },
  loading: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
  },
  spinner: {
    fontSize: '32px',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '14px',
    color: '#9ca3af',
    margin: 0,
  },
  userHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #1f2937',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
  },
  userDetails: {
    display: 'flex',
    flexDirection: 'column',
  },
  userName: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#ffffff',
  },
  userEmail: {
    fontSize: '11px',
    color: '#6b7280',
  },
  signOutButton: {
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid #374151',
    background: 'transparent',
    color: '#9ca3af',
    fontSize: '11px',
    cursor: 'pointer',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #1f2937',
  },
  tab: {
    flex: 1,
    padding: '12px',
    border: 'none',
    background: 'transparent',
    color: '#6b7280',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    borderBottom: '2px solid transparent',
  },
  tabActive: {
    color: '#10b981',
    borderBottomColor: '#10b981',
  },
  tabContent: {
    flex: 1,
    overflow: 'auto',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '8px',
    borderTop: '1px solid #1f2937',
    fontSize: '11px',
  },
  footerLink: {
    color: '#6b7280',
    textDecoration: 'none',
  },
  footerDivider: {
    color: '#374151',
  },
  footerVersion: {
    color: '#4b5563',
  },
};

