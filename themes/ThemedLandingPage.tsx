import React, { useState } from 'react'
import { ArrowRight, Check, Star, BookOpen, Brain, Zap, Users, Shield, Award } from 'lucide-react'
import { useAppStore } from '../src/store/appStore'
import { useTheme } from './ThemeProvider'

interface PricingTier {
  name: string
  price: string
  period: string
  features: string[]
  color: string
  popular?: boolean
}

const ThemedLandingPage: React.FC = () => {
  const { isAuthenticated, user } = useAppStore()
  const { currentTheme } = useTheme()
  const [activePricing, setActivePricing] = useState<'monthly' | 'yearly'>('monthly')

  const pricingTiers: PricingTier[] = [
    {
      name: "STUDENT",
      price: "$0",
      period: "forever",
      color: "var(--color-accent-1)",
      features: [
        "5 documents per month",
        "Basic AI analysis",
        "Standard reading modes",
        "Community support",
        "100 credits included"
      ]
    },
    {
      name: "RESEARCHER",
      price: activePricing === 'monthly' ? "$19" : "$15",
      period: activePricing === 'monthly' ? "month" : "month (billed yearly)",
      color: "var(--color-primary)",
      popular: true,
      features: [
        "Unlimited documents",
        "Advanced AI analysis",
        "All reading modes",
        "Priority support",
        "1000 credits included",
        "Export capabilities",
        "Team collaboration"
      ]
    },
    {
      name: "INSTITUTION",
      price: "Custom",
      period: "contact us",
      color: "var(--color-accent-2)",
      features: [
        "Everything in Researcher",
        "Custom integrations",
        "Dedicated support",
        "Advanced analytics",
        "White-label options",
        "SLA guarantees"
      ]
    }
  ]

  const features = [
    {
      icon: <BookOpen className="w-8 h-8" />,
      title: "Intelligent Document Analysis",
      description: "AI-powered text extraction and analysis for academic papers, books, and research documents."
    },
    {
      icon: <Brain className="w-8 h-8" />,
      title: "Smart Annotation System",
      description: "Color-coded highlighting and note-taking with automatic categorization and cross-referencing."
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Voice Synthesis",
      description: "High-quality text-to-speech with multiple voice options for accessible reading."
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Collaborative Research",
      description: "Share documents and annotations with research teams and academic collaborators."
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Secure & Private",
      description: "Enterprise-grade security with end-to-end encryption for sensitive research data."
    },
    {
      icon: <Award className="w-8 h-8" />,
      title: "Academic Standards",
      description: "Built specifically for academic workflows with citation management and export capabilities."
    }
  ]

  return (
    <div 
      className="min-h-screen"
      style={{
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-family-sans)',
      }}
    >
      {/* Header */}
      <header 
        className="py-6 px-6"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <BookOpen 
              className="w-8 h-8"
              style={{ color: 'var(--color-primary)' }}
            />
            <h1 
              className="text-2xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Academic Reader Pro
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="flex items-center space-x-3">
                <span 
                  className="text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Welcome, {user?.email}
                </span>
                <button
                  className="px-4 py-2 rounded-lg font-medium transition-colors"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-text-inverse)',
                  }}
                  onClick={() => window.location.href = '/app'}
                >
                  Go to App
                </button>
              </div>
            ) : (
              <button
                className="px-6 py-2 rounded-lg font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text-inverse)',
                }}
                onClick={() => window.location.href = '/auth'}
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section 
        className="py-20 px-6"
        style={{
          background: 'linear-gradient(135deg, var(--color-background) 0%, var(--color-surface) 100%)',
        }}
      >
        <div className="max-w-7xl mx-auto text-center">
          <h1 
            className="text-5xl font-bold mb-6"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Transform Your Academic Research
          </h1>
          <p 
            className="text-xl mb-8 max-w-3xl mx-auto"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            The intelligent document reader designed specifically for researchers, 
            students, and academics. Analyze, annotate, and synthesize your research 
            with AI-powered tools.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              className="px-8 py-4 rounded-lg font-semibold text-lg transition-colors flex items-center justify-center space-x-2"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-inverse)',
              }}
            >
              <span>Start Free Trial</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              className="px-8 py-4 rounded-lg font-semibold text-lg transition-colors border-2"
              style={{
                borderColor: 'var(--color-primary)',
                color: 'var(--color-primary)',
                backgroundColor: 'transparent',
              }}
            >
              Watch Demo
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 
              className="text-4xl font-bold mb-4"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Built for Academic Excellence
            </h2>
            <p 
              className="text-xl max-w-3xl mx-auto"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Everything you need to streamline your research workflow and enhance your academic productivity.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="p-6 rounded-xl border"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                }}
              >
                <div 
                  className="mb-4"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {feature.icon}
                </div>
                <h3 
                  className="text-xl font-semibold mb-3"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {feature.title}
                </h3>
                <p 
                  className="text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section 
        className="py-20 px-6"
        style={{
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 
              className="text-4xl font-bold mb-4"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Choose Your Plan
            </h2>
            <p 
              className="text-xl mb-8"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Flexible pricing for every stage of your academic journey
            </p>
            
            {/* Pricing Toggle */}
            <div className="flex items-center justify-center space-x-4 mb-12">
              <span 
                className={`text-sm font-medium ${activePricing === 'monthly' ? 'opacity-100' : 'opacity-50'}`}
                style={{ color: 'var(--color-text-primary)' }}
              >
                Monthly
              </span>
              <button
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                style={{
                  backgroundColor: activePricing === 'yearly' ? 'var(--color-primary)' : 'var(--color-border)',
                }}
                onClick={() => setActivePricing(activePricing === 'monthly' ? 'yearly' : 'monthly')}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                    activePricing === 'yearly' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                  style={{ backgroundColor: 'white' }}
                />
              </button>
              <span 
                className={`text-sm font-medium ${activePricing === 'yearly' ? 'opacity-100' : 'opacity-50'}`}
                style={{ color: 'var(--color-text-primary)' }}
              >
                Yearly (Save 20%)
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {pricingTiers.map((tier, index) => (
              <div 
                key={index}
                className={`relative p-8 rounded-xl border-2 ${
                  tier.popular ? 'ring-2 ring-blue-500' : ''
                }`}
                style={{
                  backgroundColor: 'var(--color-background)',
                  borderColor: tier.popular ? 'var(--color-primary)' : 'var(--color-border)',
                }}
              >
                {tier.popular && (
                  <div 
                    className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-4 py-1 rounded-full text-sm font-semibold"
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-text-inverse)',
                    }}
                  >
                    Most Popular
                  </div>
                )}
                
                <div className="text-center mb-8">
                  <h3 
                    className="text-2xl font-bold mb-2"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {tier.name}
                  </h3>
                  <div className="flex items-baseline justify-center">
                    <span 
                      className="text-5xl font-bold"
                      style={{ color: tier.color }}
                    >
                      {tier.price}
                    </span>
                    <span 
                      className="text-lg ml-2"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      /{tier.period}
                    </span>
                  </div>
                </div>

                <ul className="space-y-4 mb-8">
                  {tier.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start space-x-3">
                      <Check 
                        className="w-5 h-5 mt-0.5 flex-shrink-0"
                        style={{ color: 'var(--color-primary)' }}
                      />
                      <span 
                        className="text-sm"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
                    tier.popular ? 'text-white' : ''
                  }`}
                  style={{
                    backgroundColor: tier.popular ? 'var(--color-primary)' : 'transparent',
                    color: tier.popular ? 'var(--color-text-inverse)' : 'var(--color-primary)',
                    borderColor: 'var(--color-primary)',
                    borderWidth: '2px',
                  }}
                >
                  {tier.name === 'INSTITUTION' ? 'Contact Sales' : 'Get Started'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer 
        className="py-12 px-6"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <BookOpen 
              className="w-6 h-6"
              style={{ color: 'var(--color-primary)' }}
            />
            <span 
              className="text-lg font-semibold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Academic Reader Pro
            </span>
          </div>
          <p 
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            © 2024 Academic Reader Pro. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default ThemedLandingPage
