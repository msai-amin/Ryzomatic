import React from 'react'
import ReactDOM from 'react-dom/client'
import '@shared/index.css'

const SimpleLandingApp = () => {
  const [error, setError] = React.useState<string | null>(null)

  // Error boundary effect
  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error)
      setError(event.error?.message || 'Unknown error occurred')
    }

    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])

  if (error) {
    return (
      <div style={{
        padding: '40px',
        fontFamily: 'Inter, sans-serif',
        backgroundColor: 'var(--color-background, #000000)',
        color: 'var(--color-text, #ffffff)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center'
      }}>
        <h1 style={{ color: 'var(--color-primary, #9ca3af)', marginBottom: '20px' }}>
          ⚠️ Error Detected
        </h1>
        <p style={{ color: 'var(--color-text-secondary, #d1d5db)', marginBottom: '20px' }}>
          {error}
        </p>
        <button 
          onClick={() => setError(null)}
          style={{
            backgroundColor: 'var(--color-primary, #9ca3af)',
            color: 'var(--color-background, #000000)',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--color-background, #000000)',
      color: 'var(--color-text, #ffffff)',
      fontFamily: 'Inter, sans-serif',
      padding: '20px'
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '40px',
        padding: '20px 0',
        borderBottom: '1px solid var(--color-primary, #9ca3af)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ fontSize: '2rem' }}>📚</div>
          <h1 style={{ 
            fontSize: '1.8rem', 
            color: 'var(--color-primary, #9ca3af)',
            margin: 0 
          }}>
            Smart Reader
          </h1>
        </div>
        <button style={{
          backgroundColor: 'var(--color-primary, #9ca3af)',
          color: 'var(--color-background, #000000)',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '8px',
          cursor: 'pointer'
        }}>
          Sign In
        </button>
      </header>

      {/* Hero Section */}
      <section style={{ textAlign: 'center', marginBottom: '60px' }}>
        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🎓</div>
        <h1 style={{
          fontSize: '3rem',
          fontWeight: '700',
          color: 'var(--color-text, #ffffff)',
          marginBottom: '20px',
          lineHeight: '1.2'
        }}>
          For Researchers,<br/>
          <span style={{ color: 'var(--color-primary, #9ca3af)' }}>
            by Researchers
          </span>
        </h1>
        
        <p style={{
          fontSize: '1.3rem',
          color: 'var(--color-text-secondary, #d1d5db)',
          marginBottom: '40px',
          maxWidth: '600px',
          margin: '0 auto 40px auto',
          lineHeight: '1.6'
        }}>
          Reading Reimagined for Academics. Streamline your literature reviews, 
          manage citations, and collaborate with peers—all optimized for iPad Pro.
        </p>
        
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={{
            backgroundColor: 'var(--color-primary, #9ca3af)',
            color: 'var(--color-background, #000000)',
            border: 'none',
            padding: '16px 32px',
            borderRadius: '12px',
            fontSize: '1.2rem',
            fontWeight: '600',
            cursor: 'pointer'
          }}>
            Start Your Free Trial
          </button>
          <button style={{
            backgroundColor: 'transparent',
            color: 'var(--color-primary, #9ca3af)',
            border: '2px solid var(--color-primary, #9ca3af)',
            padding: '16px 32px',
            borderRadius: '12px',
            fontSize: '1.2rem',
            fontWeight: '600',
            cursor: 'pointer'
          }}>
            Watch Demo
          </button>
        </div>
      </section>

      {/* Features Grid */}
      <section style={{ marginBottom: '60px' }}>
        <h2 style={{
          fontSize: '2.5rem',
          color: 'var(--color-text, #ffffff)',
          textAlign: 'center',
          marginBottom: '40px'
        }}>
          iPad-Optimized Features
        </h2>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '30px'
        }}>
          <div style={{
            backgroundColor: 'var(--color-background-secondary, #111827)',
            padding: '30px',
            borderRadius: '12px',
            border: '1px solid var(--color-primary, #9ca3af)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '20px' }}>✏️</div>
            <h3 style={{
              fontSize: '1.5rem',
              color: 'var(--color-primary, #9ca3af)',
              marginBottom: '15px'
            }}>
              Apple Pencil Ready
            </h3>
            <p style={{
              color: 'var(--color-text-secondary, #d1d5db)',
              lineHeight: '1.6'
            }}>
              Highlight, annotate, and take notes with precision using your Apple Pencil.
            </p>
          </div>

          <div style={{
            backgroundColor: 'var(--color-background-secondary, #111827)',
            padding: '30px',
            borderRadius: '12px',
            border: '1px solid var(--color-primary, #9ca3af)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '20px' }}>📱</div>
            <h3 style={{
              fontSize: '1.5rem',
              color: 'var(--color-primary, #9ca3af)',
              marginBottom: '15px'
            }}>
              Split-Screen Multitasking
            </h3>
            <p style={{
              color: 'var(--color-text-secondary, #d1d5db)',
              lineHeight: '1.6'
            }}>
              Work alongside other apps. Read papers while taking notes.
            </p>
          </div>

          <div style={{
            backgroundColor: 'var(--color-background-secondary, #111827)',
            padding: '30px',
            borderRadius: '12px',
            border: '1px solid var(--color-primary, #9ca3af)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '20px' }}>☁️</div>
            <h3 style={{
              fontSize: '1.5rem',
              color: 'var(--color-primary, #9ca3af)',
              marginBottom: '15px'
            }}>
              Offline Access
            </h3>
            <p style={{
              color: 'var(--color-text-secondary, #d1d5db)',
              lineHeight: '1.6'
            }}>
              Download papers for offline reading. Sync when back online.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" style={{ marginBottom: '60px' }}>
        <h2 style={{
          fontSize: '2.5rem',
          color: 'var(--color-text, #ffffff)',
          textAlign: 'center',
          marginBottom: '20px'
        }}>
          Clear Pricing for the Academic Community
        </h2>
        
        <p style={{
          fontSize: '1.2rem',
          color: 'var(--color-text-secondary, #d1d5db)',
          textAlign: 'center',
          marginBottom: '40px'
        }}>
          Focus on your research, not your budget. Choose a plan that fits your needs.
        </p>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '30px',
          maxWidth: '1000px',
          margin: '0 auto'
        }}>
          {/* Free Plan */}
          <div style={{
            backgroundColor: 'var(--color-background-secondary, #111827)',
            padding: '40px 30px',
            borderRadius: '16px',
            border: '1px solid var(--color-primary, #9ca3af)',
            textAlign: 'center',
            position: 'relative'
          }}>
            <h3 style={{
              fontSize: '1.8rem',
              color: 'var(--color-text, #ffffff)',
              marginBottom: '10px'
            }}>
              Explorer
            </h3>
            <div style={{
              fontSize: '3rem',
              fontWeight: '700',
              color: 'var(--color-primary, #9ca3af)',
              marginBottom: '5px'
            }}>
              Free
            </div>
            <div style={{
              color: 'var(--color-text-secondary, #d1d5db)',
              marginBottom: '30px'
            }}>
              per forever
            </div>
            
            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: '0 0 30px 0',
              textAlign: 'left'
            }}>
              <li style={{
                padding: '8px 0',
                color: 'var(--color-text-secondary, #d1d5db)',
                borderBottom: '1px solid rgba(156, 163, 175, 0.2)'
              }}>
                ✓ 5 documents per month
              </li>
              <li style={{
                padding: '8px 0',
                color: 'var(--color-text-secondary, #d1d5db)',
                borderBottom: '1px solid rgba(156, 163, 175, 0.2)'
              }}>
                ✓ 20 AI chats per month
              </li>
              <li style={{
                padding: '8px 0',
                color: 'var(--color-text-secondary, #d1d5db)',
                borderBottom: '1px solid rgba(156, 163, 175, 0.2)'
              }}>
                ✓ Basic PDF viewing
              </li>
              <li style={{
                padding: '8px 0',
                color: 'var(--color-text-secondary, #d1d5db)',
                borderBottom: '1px solid rgba(156, 163, 175, 0.2)'
              }}>
                ✓ 1GB storage
              </li>
              <li style={{
                padding: '8px 0',
                color: 'var(--color-text-secondary, #d1d5db)',
                borderBottom: '1px solid rgba(156, 163, 175, 0.2)'
              }}>
                ✓ Community support
              </li>
            </ul>
            
            <button style={{
              backgroundColor: 'transparent',
              color: 'var(--color-primary, #9ca3af)',
              border: '2px solid var(--color-primary, #9ca3af)',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '1.1rem',
              fontWeight: '600',
              cursor: 'pointer',
              width: '100%'
            }}>
              Get Started Free
            </button>
          </div>

          {/* Scholar Plan - Most Popular */}
          <div style={{
            backgroundColor: 'var(--color-background, #000000)',
            padding: '40px 30px',
            borderRadius: '16px',
            border: '2px solid var(--color-primary, #9ca3af)',
            textAlign: 'center',
            position: 'relative',
            transform: 'scale(1.05)'
          }}>
            <div style={{
              position: 'absolute',
              top: '-15px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'var(--color-primary, #9ca3af)',
              color: 'var(--color-background, #000000)',
              padding: '8px 20px',
              borderRadius: '20px',
              fontSize: '0.9rem',
              fontWeight: '600'
            }}>
              Most Popular
            </div>
            
            <h3 style={{
              fontSize: '1.8rem',
              color: 'var(--color-text, #ffffff)',
              marginBottom: '10px'
            }}>
              Scholar
            </h3>
            <div style={{
              fontSize: '3rem',
              fontWeight: '700',
              color: 'var(--color-primary, #9ca3af)',
              marginBottom: '5px'
            }}>
              $4.99
            </div>
            <div style={{
              color: 'var(--color-text-secondary, #d1d5db)',
              marginBottom: '30px'
            }}>
              per month, billed annually
            </div>
            
            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: '0 0 30px 0',
              textAlign: 'left'
            }}>
              <li style={{
                padding: '8px 0',
                color: 'var(--color-text-secondary, #d1d5db)',
                borderBottom: '1px solid rgba(156, 163, 175, 0.2)'
              }}>
                ✓ 25 documents per month
              </li>
              <li style={{
                padding: '8px 0',
                color: 'var(--color-text-secondary, #d1d5db)',
                borderBottom: '1px solid rgba(156, 163, 175, 0.2)'
              }}>
                ✓ 100 AI chats per month
              </li>
              <li style={{
                padding: '8px 0',
                color: 'var(--color-text-secondary, #d1d5db)',
                borderBottom: '1px solid rgba(156, 163, 175, 0.2)'
              }}>
                ✓ Advanced PDF features
              </li>
              <li style={{
                padding: '8px 0',
                color: 'var(--color-text-secondary, #d1d5db)',
                borderBottom: '1px solid rgba(156, 163, 175, 0.2)'
              }}>
                ✓ 10GB storage
              </li>
              <li style={{
                padding: '8px 0',
                color: 'var(--color-text-secondary, #d1d5db)',
                borderBottom: '1px solid rgba(156, 163, 175, 0.2)'
              }}>
                ✓ Priority support
              </li>
              <li style={{
                padding: '8px 0',
                color: 'var(--color-text-secondary, #d1d5db)',
                borderBottom: '1px solid rgba(156, 163, 175, 0.2)'
              }}>
                ✓ Apple Pencil optimization
              </li>
            </ul>
            
            <button style={{
              backgroundColor: 'var(--color-primary, #9ca3af)',
              color: 'var(--color-background, #000000)',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '1.1rem',
              fontWeight: '600',
              cursor: 'pointer',
              width: '100%'
            }}>
              Choose Scholar
            </button>
          </div>

          {/* Professional Plan */}
          <div style={{
            backgroundColor: 'var(--color-background-secondary, #111827)',
            padding: '40px 30px',
            borderRadius: '16px',
            border: '1px solid var(--color-primary, #9ca3af)',
            textAlign: 'center',
            position: 'relative'
          }}>
            <h3 style={{
              fontSize: '1.8rem',
              color: 'var(--color-text, #ffffff)',
              marginBottom: '10px'
            }}>
              Professional
            </h3>
            <div style={{
              fontSize: '3rem',
              fontWeight: '700',
              color: 'var(--color-primary, #9ca3af)',
              marginBottom: '5px'
            }}>
              $9.99
            </div>
            <div style={{
              color: 'var(--color-text-secondary, #d1d5db)',
              marginBottom: '30px'
            }}>
              per month, billed annually
            </div>
            
            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: '0 0 30px 0',
              textAlign: 'left'
            }}>
              <li style={{
                padding: '8px 0',
                color: 'var(--color-text-secondary, #d1d5db)',
                borderBottom: '1px solid rgba(156, 163, 175, 0.2)'
              }}>
                ✓ Unlimited documents
              </li>
              <li style={{
                padding: '8px 0',
                color: 'var(--color-text-secondary, #d1d5db)',
                borderBottom: '1px solid rgba(156, 163, 175, 0.2)'
              }}>
                ✓ Unlimited AI chats
              </li>
              <li style={{
                padding: '8px 0',
                color: 'var(--color-text-secondary, #d1d5db)',
                borderBottom: '1px solid rgba(156, 163, 175, 0.2)'
              }}>
                ✓ All PDF features
              </li>
              <li style={{
                padding: '8px 0',
                color: 'var(--color-text-secondary, #d1d5db)',
                borderBottom: '1px solid rgba(156, 163, 175, 0.2)'
              }}>
                ✓ 100GB storage
              </li>
              <li style={{
                padding: '8px 0',
                color: 'var(--color-text-secondary, #d1d5db)',
                borderBottom: '1px solid rgba(156, 163, 175, 0.2)'
              }}>
                ✓ 24/7 support
              </li>
              <li style={{
                padding: '8px 0',
                color: 'var(--color-text-secondary, #d1d5db)',
                borderBottom: '1px solid rgba(156, 163, 175, 0.2)'
              }}>
                ✓ Team collaboration
              </li>
            </ul>
            
            <button style={{
              backgroundColor: 'transparent',
              color: 'var(--color-primary, #9ca3af)',
              border: '2px solid var(--color-primary, #9ca3af)',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '1.1rem',
              fontWeight: '600',
              cursor: 'pointer',
              width: '100%'
            }}>
              Choose Professional
            </button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        textAlign: 'center',
        backgroundColor: 'var(--color-background-secondary, #111827)',
        padding: '40px',
        borderRadius: '16px',
        border: '1px solid var(--color-primary, #9ca3af)'
      }}>
        <h2 style={{
          fontSize: '2.5rem',
          color: 'var(--color-text, #ffffff)',
          marginBottom: '20px'
        }}>
          Ready to Transform Your Research?
        </h2>
        
        <p style={{
          fontSize: '1.2rem',
          color: 'var(--color-text-secondary, #d1d5db)',
          marginBottom: '30px'
        }}>
          Join thousands of researchers who have streamlined their workflow.
        </p>
        
        <button style={{
          backgroundColor: 'var(--color-primary, #9ca3af)',
          color: 'var(--color-background, #000000)',
          border: 'none',
          padding: '18px 36px',
          borderRadius: '12px',
          fontSize: '1.3rem',
          fontWeight: '600',
          cursor: 'pointer'
        }}>
          Get Started Free
        </button>
      </section>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        marginTop: '60px',
        padding: '20px 0',
        borderTop: '1px solid var(--color-primary, #9ca3af)'
      }}>
        <p style={{
          color: 'var(--color-text-secondary, #d1d5db)',
          fontSize: '1rem'
        }}>
          © 2024 Smart Reader by VStyle. Built for iPad Pro.
        </p>
      </footer>
    </div>
  )
}

console.log('📱 Simple landing app starting...')

// Add error boundary
try {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <SimpleLandingApp />
    </React.StrictMode>,
  )
} catch (error) {
  console.error('React render error:', error)
  document.getElementById('root')!.innerHTML = `
    <div style="padding: 40px; font-family: Arial, sans-serif; background: #000; color: #fff; text-align: center;">
      <h1>Error Loading App</h1>
      <p>${error}</p>
    </div>
  `
}
