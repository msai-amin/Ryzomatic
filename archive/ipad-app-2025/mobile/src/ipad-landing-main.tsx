import React from 'react'
import ReactDOM from 'react-dom/client'
import '@shared/index.css'

const iPadLandingApp = () => {
  const [isLoaded, setIsLoaded] = React.useState(false)

  React.useEffect(() => {
    // Simulate app loading
    const timer = setTimeout(() => setIsLoaded(true), 1000)
    return () => clearTimeout(timer)
  }, [])

  if (!isLoaded) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'var(--color-background, #000000)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}>
        <div style={{
          textAlign: 'center',
          color: 'var(--color-text, #ffffff)'
        }}>
          <div style={{
            fontSize: '3rem',
            marginBottom: '20px',
            animation: 'pulse 2s infinite'
          }}>
            📚
          </div>
          <h1 style={{
            fontSize: '2rem',
            color: 'var(--color-primary, #9ca3af)',
            marginBottom: '10px'
          }}>
            Smart Reader
          </h1>
          <p style={{
            color: 'var(--color-text-secondary, #d1d5db)',
            fontSize: '1.1rem'
          }}>
            Loading your intelligent reading platform...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--color-background, #000000)',
      color: 'var(--color-text, #ffffff)',
      fontFamily: 'Inter, sans-serif',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--color-primary, #9ca3af)',
        padding: '20px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          <div style={{
            fontSize: '2rem'
          }}>
            📚
          </div>
          <h1 style={{
            fontSize: '1.8rem',
            color: 'var(--color-primary, #9ca3af)',
            margin: 0
          }}>
            Smart Reader
          </h1>
        </div>
        
        <nav style={{
          display: 'flex',
          gap: '30px',
          alignItems: 'center'
        }}>
          <a href="#features" style={{
            color: 'var(--color-text-secondary, #d1d5db)',
            textDecoration: 'none',
            fontSize: '1.1rem',
            padding: '10px 20px',
            borderRadius: '8px',
            transition: 'all 0.3s ease'
          }}>
            Features
          </a>
          <a href="#pricing" style={{
            color: 'var(--color-text-secondary, #d1d5db)',
            textDecoration: 'none',
            fontSize: '1.1rem',
            padding: '10px 20px',
            borderRadius: '8px',
            transition: 'all 0.3s ease'
          }}>
            Pricing
          </a>
          <button style={{
            backgroundColor: 'var(--color-primary, #9ca3af)',
            color: 'var(--color-background, #000000)',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '12px',
            fontSize: '1.1rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}>
            Sign In
          </button>
        </nav>
      </header>

      {/* Hero Section */}
      <section style={{
        paddingTop: '120px',
        paddingBottom: '80px',
        paddingLeft: '40px',
        paddingRight: '40px',
        textAlign: 'center',
        background: 'linear-gradient(135deg, var(--color-background, #000000) 0%, var(--color-background-secondary, #111827) 100%)'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <div style={{
            fontSize: '4rem',
            marginBottom: '30px',
            animation: 'bounce 2s infinite'
          }}>
            🎓
          </div>
          
          <h1 style={{
            fontSize: '4rem',
            fontWeight: '700',
            color: 'var(--color-text, #ffffff)',
            marginBottom: '20px',
            lineHeight: '1.1'
          }}>
            For Researchers,<br/>
            <span style={{ color: 'var(--color-primary, #9ca3af)' }}>
              by Researchers
            </span>
          </h1>
          
          <p style={{
            fontSize: '1.5rem',
            color: 'var(--color-text-secondary, #d1d5db)',
            marginBottom: '40px',
            maxWidth: '800px',
            margin: '0 auto 40px auto',
            lineHeight: '1.6'
          }}>
            Reading Reimagined for Academics. Streamline your literature reviews, 
            manage citations, draft manuscripts, and collaborate with peers—all in one 
            immersive workspace optimized for iPad Pro.
          </p>
          
          <div style={{
            display: 'flex',
            gap: '20px',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: '60px'
          }}>
            <button style={{
              backgroundColor: 'var(--color-primary, #9ca3af)',
              color: 'var(--color-background, #000000)',
              border: 'none',
              padding: '18px 36px',
              borderRadius: '16px',
              fontSize: '1.3rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 8px 32px rgba(156, 163, 175, 0.3)'
            }}>
              Start Your Free Trial
            </button>
            <button style={{
              backgroundColor: 'transparent',
              color: 'var(--color-primary, #9ca3af)',
              border: '2px solid var(--color-primary, #9ca3af)',
              padding: '18px 36px',
              borderRadius: '16px',
              fontSize: '1.3rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}>
              Watch Demo
            </button>
          </div>

          {/* iPad-specific features */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '30px',
            marginTop: '60px'
          }}>
            <div style={{
              backgroundColor: 'var(--color-background-secondary, #111827)',
              padding: '30px',
              borderRadius: '16px',
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
                Pressure sensitivity and palm rejection included.
              </p>
            </div>

            <div style={{
              backgroundColor: 'var(--color-background-secondary, #111827)',
              padding: '30px',
              borderRadius: '16px',
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
                Work alongside other apps. Read papers while taking notes, 
                or compare multiple documents side by side.
              </p>
            </div>

            <div style={{
              backgroundColor: 'var(--color-background-secondary, #111827)',
              padding: '30px',
              borderRadius: '16px',
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
                Download papers for offline reading. Sync your highlights and notes 
                when you're back online.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" style={{
        padding: '80px 40px',
        backgroundColor: 'var(--color-background-secondary, #111827)'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          textAlign: 'center'
        }}>
          <h2 style={{
            fontSize: '3rem',
            color: 'var(--color-text, #ffffff)',
            marginBottom: '20px'
          }}>
            A Toolkit Engineered for<br/>
            <span style={{ color: 'var(--color-primary, #9ca3af)' }}>
              Academic Excellence
            </span>
          </h2>
          
          <p style={{
            fontSize: '1.3rem',
            color: 'var(--color-text-secondary, #d1d5db)',
            marginBottom: '60px',
            maxWidth: '800px',
            margin: '0 auto 60px auto'
          }}>
            Immersive Reader transforms scattered notes and sources into a clear, 
            actionable research workflow.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '40px',
            textAlign: 'left'
          }}>
            <div style={{
              backgroundColor: 'var(--color-background, #000000)',
              padding: '40px',
              borderRadius: '20px',
              border: '1px solid var(--color-primary, #9ca3af)'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '20px' }}>📝</div>
              <h3 style={{
                fontSize: '1.8rem',
                color: 'var(--color-primary, #9ca3af)',
                marginBottom: '20px'
              }}>
                Research Composer
              </h3>
              <p style={{
                color: 'var(--color-text-secondary, #d1d5db)',
                lineHeight: '1.6',
                fontSize: '1.1rem'
              }}>
                Draft articles, grant proposals, and lecture notes with AI-assisted 
                templates that organize sources and structure arguments.
              </p>
            </div>

            <div style={{
              backgroundColor: 'var(--color-background, #000000)',
              padding: '40px',
              borderRadius: '20px',
              border: '1px solid var(--color-primary, #9ca3af)'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '20px' }}>📚</div>
              <h3 style={{
                fontSize: '1.8rem',
                color: 'var(--color-primary, #9ca3af)',
                marginBottom: '20px'
              }}>
                Literature Synthesizer
              </h3>
              <p style={{
                color: 'var(--color-text-secondary, #d1d5db)',
                lineHeight: '1.6',
                fontSize: '1.1rem'
              }}>
                Turn dense papers into concise summaries, annotated bibliographies, 
                and thematic notes for your literature review.
              </p>
            </div>

            <div style={{
              backgroundColor: 'var(--color-background, #000000)',
              padding: '40px',
              borderRadius: '20px',
              border: '1px solid var(--color-primary, #9ca3af)'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '20px' }}>📊</div>
              <h3 style={{
                fontSize: '1.8rem',
                color: 'var(--color-primary, #9ca3af)',
                marginBottom: '20px'
              }}>
                Project Tracker
              </h3>
              <p style={{
                color: 'var(--color-text-secondary, #d1d5db)',
                lineHeight: '1.6',
                fontSize: '1.1rem'
              }}>
                Monitor research progress, track publication timelines, and manage 
                collaborative projects with clear, visual dashboards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        padding: '80px 40px',
        textAlign: 'center',
        background: 'linear-gradient(135deg, var(--color-background-secondary, #111827) 0%, var(--color-background, #000000) 100%)'
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto'
        }}>
          <h2 style={{
            fontSize: '3rem',
            color: 'var(--color-text, #ffffff)',
            marginBottom: '30px'
          }}>
            Ready to Transform Your Research?
          </h2>
          
          <p style={{
            fontSize: '1.3rem',
            color: 'var(--color-text-secondary, #d1d5db)',
            marginBottom: '40px',
            lineHeight: '1.6'
          }}>
            Join thousands of researchers who have streamlined their workflow with Smart Reader.
          </p>
          
          <button style={{
            backgroundColor: 'var(--color-primary, #9ca3af)',
            color: 'var(--color-background, #000000)',
            border: 'none',
            padding: '20px 40px',
            borderRadius: '16px',
            fontSize: '1.4rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 8px 32px rgba(156, 163, 175, 0.3)'
          }}>
            Get Started Free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        backgroundColor: 'var(--color-background, #000000)',
        padding: '40px',
        textAlign: 'center',
        borderTop: '1px solid var(--color-primary, #9ca3af)'
      }}>
        <p style={{
          color: 'var(--color-text-secondary, #d1d5db)',
          fontSize: '1rem'
        }}>
          © 2024 Smart Reader by VStyle. Built for iPad Pro.
        </p>
      </footer>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
          60% { transform: translateY(-5px); }
        }
        
        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(156, 163, 175, 0.4) !important;
        }
        
        a:hover {
          color: var(--color-primary, #9ca3af) !important;
          background-color: rgba(156, 163, 175, 0.1);
        }
      `}</style>
    </div>
  )
}

console.log('📱 iPad landing app starting...')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <iPadLandingApp />
  </React.StrictMode>,
)
