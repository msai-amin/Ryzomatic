import { useState } from 'react';
import { useAppStore } from '../store/appStore';

interface NavigationItem {
  name: string;
  href: string;
}

interface FeatureCard {
  title: string;
  description: string;
  icon: string;
}

interface UseCase {
  name: string;
  description: string;
  icon: string;
}


interface PricingTier {
  name: string;
  price: string;
  period: string;
  features: string[];
  popular?: boolean;
}

interface LandingPageProps {
  onShowAuthModal?: () => void;
}

const LandingPage: React.FC = () => {
  const { isAuthenticated, user } = useAppStore();

  const navigation: NavigationItem[] = [
    { name: "Features", href: "#features" },
    { name: "Use Cases", href: "#use-cases" },
    { name: "Pricing", href: "#pricing" },
  ];

  const featureCards: FeatureCard[] = [
    {
      title: "Intelligent Document Network",
      description: "Upload any paper and watch ryzomatic instantly map it to your entire collection. Discover surprising connections between theories, find contrasting views, and surface related research you didn't know you had.",
      icon: "🌐"
    },
    {
      title: "AI Reading Assistant",
      description: "Your AI reads alongside you, highlighting key concepts, explaining complex ideas, and answering questions in real-time. It remembers everything from every document—no more searching through old notes.",
      icon: "🤖"
    },
    {
      title: "Natural-Voice Reader",
      description: "Listen to papers with premium TTS voices while you multitask. Adjustable speed, pitch, and voice selection let you learn at your own pace—hands-free.",
      icon: "🎧"
    },
    {
      title: "Smart Document Organization",
      description: "Automatic tagging, smart collections, and intelligent search help you find exactly what you need from hundreds of papers. Your library becomes a searchable knowledge base.",
      icon: "📁"
    },
    {
      title: "Integrated Pomodoro Timer",
      description: "Stay focused during deep research sessions with built-in timing tools. Track productivity, take structured breaks, and maintain mental stamina.",
      icon: "⏱️"
    },
    {
      title: "Advanced Annotation Tools",
      description: "Highlight, annotate, and tag concepts across all documents. Create study notes that link to specific sections and build your personal research archive.",
      icon: "📝"
    },
    {
      title: "Universal Export Formats",
      description: "Export your research notes in Markdown, HTML, JSON, or plain text formats. Works seamlessly with Zotero, Notion, Obsidian, and other research platforms.",
      icon: "💾"
    }
  ];

  const useCases: UseCase[] = [
    {
      name: "Literature Review Made Easy",
      description: "Starting your thesis? Upload papers as you find them. ryzomatic tracks every citation, finds related studies you might have missed, and helps you synthesize arguments across documents automatically.",
      icon: "📚"
    },
    {
      name: "Compare Research Findings",
      description: "Found conflicting results? Ask ryzomatic to show all papers discussing the same methodology. Quickly identify patterns, contradictions, and emerging consensus across your entire library.",
      icon: "⚖️"
    },
    {
      name: "Hands-Free Learning",
      description: "Listen to papers during commutes or walks. Natural-voice TTS with highlighting lets you absorb complex material without staring at a screen. Perfect for busy researchers.",
      icon: "🎧"
    },
    {
      name: "Find Thematic Connections",
      description: "Is your new paper related to something you read months ago? ryzomatic's AI identifies recurring themes, overlapping concepts, and surprising connections you would have never spotted manually.",
      icon: "🔗"
    },
    {
      name: "Build Your Research Archive",
      description: "Every annotation, highlight, and note becomes part of a searchable knowledge base. Years later, query your entire history: 'Show me everything I've saved about fMRI studies' and get instant results.",
      icon: "🗄️"
    },
    {
      name: "Collaborative Research Made Simple",
      description: "Share document collections with lab members. Everyone's annotations are tracked, questions are answered across documents, and you maintain context across team discussions.",
      icon: "👥"
    }
  ];


  const pricingTiers: PricingTier[] = [
    {
      name: "Explorer",
      price: "Free",
      period: "forever",
      features: [
        "5 documents per month",
        "20 AI chats per month",
        "Basic PDF viewing",
        "1GB storage",
        "Community support"
      ]
    },
    {
      name: "Scholar",
      price: "$4.99",
      period: "month, billed annually",
      popular: true,
      features: [
        "25 documents per month",
        "100 AI chats per month",
        "OCR processing",
        "10GB storage",
        "Priority support",
        "Advanced highlighting",
        "Pomodoro tracking"
      ]
    },
    {
      name: "Academic",
      price: "$9.99",
      period: "month, billed annually",
      features: [
        "Unlimited documents",
        "300 AI chats per month",
        "Gemini-2.5-Pro AI",
        "50GB storage",
        "Export features",
        "Team collaboration (3 users)",
        "Priority support"
      ]
    }
  ];

  const handleSignIn = () => {
    window.location.href = '/?auth=true';
  };

  const handleGetStarted = () => {
    if (isAuthenticated) {
      window.location.href = '/';
    } else {
      window.location.href = '/?auth=true';
    }
  };

  const handleGoToApp = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen scroll-smooth" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#f8f9fa' }}>
      {/* Background Pattern */}
      <div 
        className="fixed inset-0 opacity-50 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #e0e0e0 1px, transparent 0)',
          backgroundSize: '2rem 2rem'
        }}
      />

      {/* Header */}
      <header className="relative z-20 bg-white/80 backdrop-blur-lg border-b border-slate-200 sticky top-0">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="#" className="flex items-center gap-3">
            <img src="/ryzomatic-logo.png" alt="ryzomatic" className="h-10 w-10" />
            <div>
              <p className="text-lg font-semibold text-slate-900" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.05em', fontWeight: '600' }}>ryzomatic</p>
            </div>
          </a>
          
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 lg:flex">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="transition hover:text-slate-900"
              >
                {item.name}
              </a>
            ))}
          </nav>
          
          <div className="flex items-center gap-4 text-sm">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-slate-600 hidden lg:inline-flex">
                  Welcome, {user?.email?.split('@')[0]}
                </span>
                <button
                  onClick={handleGoToApp}
                  className="rounded-full bg-slate-800 px-5 py-2 font-medium text-white shadow-lg shadow-slate-800/20 transition hover:bg-slate-700"
                >
                  Go to App
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={handleSignIn}
                  className="hidden rounded-full px-4 py-2 text-slate-600 transition hover:text-slate-900 lg:inline-flex"
                >
                  Sign in
                </button>
                <button 
                  onClick={handleGetStarted}
                  className="rounded-full bg-slate-800 px-5 py-2 font-medium text-white shadow-lg shadow-slate-800/20 transition hover:bg-slate-700"
                >
                  Start free trial
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="product" className="relative overflow-hidden bg-white">
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-12 px-6 pb-24 pt-20 text-center md:pt-32">
          <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs uppercase tracking-widest text-slate-600">
            <span>For Researchers, by Researchers</span>
          </div>
          
          <h1 className="max-w-4xl text-5xl md:text-7xl font-bold text-slate-900 leading-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
            Research is Not Linear,<br />your tools shouldn't be either.
          </h1>
          
          <p className="max-w-2xl text-xl md:text-2xl text-slate-700 leading-relaxed font-medium">
            The AI-powered research workspace that transforms your PDFs into an interconnected knowledge network.
          </p>
          
          <div className="flex flex-col items-center gap-3 text-center mt-8">
            <p className="text-lg text-slate-600 max-w-xl">
              Upload a paper. Instantly see how it connects to everything you've ever added.
            </p>
            <p className="text-2xl font-semibold text-slate-900 italic max-w-lg">
              "Stop just reading documents. Start connecting them."
            </p>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
            <button 
              onClick={handleGetStarted}
              className="rounded-full bg-slate-800 px-8 py-4 font-semibold text-white shadow-lg shadow-slate-800/30 transition hover:bg-slate-700 text-button"
            >
              Start Your Free Trial
            </button>
          </div>
          
          <div className="relative mt-8 w-full max-w-4xl">
            {/* Product Demo Video - Seamless Integration */}
            <div className="w-full rounded-2xl overflow-hidden shadow-2xl" style={{ backgroundColor: '#f8f9fa' }}>
              <video
                className="w-full h-auto"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  height: 'auto',
                  mixBlendMode: 'multiply',
                  opacity: 0.95,
                }}
              >
                <source src="/videos/hero-animation.mp4" type="video/mp4" />
                {/* Fallback for browsers that don't support video */}
                <div className="flex items-center justify-center h-full" style={{ minHeight: '400px' }}>
                  <div className="text-center">
                    <div className="text-6xl mb-4">📚</div>
                    <span className="text-slate-500 text-lg font-medium">Product Demo</span>
                    <p className="text-slate-400 text-sm mt-2">Your academic workspace awaits</p>
                  </div>
                </div>
              </video>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-gradient-to-b from-white to-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32">
          <div className="flex flex-col gap-4 text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-4 py-1.5 text-sm font-medium text-green-700 mb-4">
              <span>✨</span>
              <span>Powerful Features</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 max-w-3xl mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
              Connect Your Ideas, Not Just Your Documents
            </h2>
            <p className="mx-auto max-w-2xl text-lg md:text-xl text-slate-600 leading-relaxed mt-4">
              Everything you need to transform your PDF library into an intelligent research workspace.
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 mt-12">
            {featureCards.map((feature, index) => (
              <div
                key={feature.title}
                className="group relative rounded-xl border border-slate-200 bg-white p-8 transition-all duration-300 hover:border-slate-300 hover:shadow-xl hover:-translate-y-1"
              >
                {/* Number badge for visual interest */}
                <div className="absolute -top-4 -left-4 h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </div>
                
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 text-slate-700 transition-all duration-300 group-hover:from-slate-100 group-hover:to-slate-200 group-hover:scale-110 text-3xl mb-4">
                  {feature.icon}
                </div>
                
                <h3 className="text-xl font-bold text-slate-900 mb-3" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {feature.title}
                </h3>
                
                <p className="text-slate-600 leading-relaxed">
                  {feature.description}
                </p>
                
                {/* Hover accent line */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-green-400 to-blue-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="use-cases" className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="flex flex-col gap-6 text-center">
            <h2 className="text-4xl font-semibold text-slate-900" style={{ fontFamily: "'Inter', sans-serif" }}>
              Built for Every Academic Role
            </h2>
            <p className="mx-auto max-w-2xl text-base text-slate-600">
              Whether you're working on a dissertation, preparing a syllabus, or collaborating on a groundbreaking study, ryzomatic adapts to your workflow.
            </p>
          </div>

          <div className="relative mt-12 w-full max-w-5xl mx-auto">
            <div className="w-full rounded-2xl overflow-hidden shadow-2xl" style={{ backgroundColor: '#f8f9fa' }}>
              <video
                className="w-full h-auto"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  height: 'auto',
                  mixBlendMode: 'multiply',
                  opacity: 0.95,
                }}
              >
                <source src="/videos/features-showcase.mp4" type="video/mp4" />
                {/* Fallback for browsers that don't support video */}
                <div className="flex items-center justify-center h-full" style={{ minHeight: '400px' }}>
                  <div className="text-center">
                    <div className="text-6xl mb-4">📚</div>
                    <span className="text-slate-500 text-lg font-medium">Product Demo</span>
                    <p className="text-slate-400 text-sm mt-2">Your academic workspace awaits</p>
                  </div>
                </div>
              </video>
            </div>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {useCases.map((useCase) => (
              <div 
                key={useCase.name} 
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-8 text-center"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm text-2xl">
                  {useCase.icon}
                </div>
                <h3 className="text-xl font-semibold text-slate-900" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {useCase.name}
                </h3>
                <p className="text-sm text-slate-600">{useCase.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Pricing Section */}
      <section id="pricing" className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="flex flex-col gap-6 text-center">
            <h2 className="text-4xl font-semibold text-slate-900" style={{ fontFamily: "'Inter', sans-serif" }}>
              Clear Pricing for the Academic Community
            </h2>
            <p className="mx-auto max-w-xl text-base text-slate-600">
              Focus on your research, not your budget. Choose a plan that fits your needs.
            </p>
          </div>
          
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {pricingTiers.map((tier) => (
              <div 
                key={tier.name}
                className={`flex flex-col rounded-2xl p-8 text-left ${
                  tier.popular 
                    ? 'relative border-2 border-slate-800 shadow-2xl shadow-slate-200' 
                    : 'border-2 border-slate-200'
                }`}
              >
                {tier.popular && (
                  <div className="absolute right-6 top-6 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-700">
                    Most Popular
                  </div>
                )}
                
                <div className="flex-grow">
                  <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">{tier.name}</p>
                  <h3 className="mt-4 text-4xl font-semibold text-slate-900" style={{ fontFamily: "'Inter', sans-serif" }}>
                    {tier.price}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">per {tier.period}</p>
                  <ul className="mt-6 space-y-3 text-sm text-slate-600">
                    {tier.features.map((feature, index) => (
                      <li key={index}>• {feature}</li>
                    ))}
                  </ul>
                </div>
                
                <div className="pt-8">
                  <button
                    onClick={tier.name === 'Academic' ? () => window.location.href = 'mailto:support@vstyle.co' : handleGetStarted}
                    className={`w-full rounded-full px-4 py-3 text-sm font-semibold transition ${
                      tier.popular
                        ? 'bg-slate-800 text-white shadow-lg shadow-slate-800/20 hover:bg-slate-700'
                        : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {tier.name === 'Explorer' ? 'Get Started Free' : tier.name === 'Academic' ? 'Contact Sales' : `Choose ${tier.name}`}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-12 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img src="/ryzomatic-logo.png" alt="ryzomatic" className="h-10 w-10" />
            <div>
              <p className="text-base font-semibold text-slate-900" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.05em', fontWeight: '600' }}>ryzomatic</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-500">
            <a href="#features" className="transition hover:text-slate-900">Features</a>
            <a href="#use-cases" className="transition hover:text-slate-900">Use Cases</a>
            <a href="#pricing" className="transition hover:text-slate-900">Pricing</a>
            <a href="mailto:support@vstyle.co" className="transition hover:text-slate-900">support@vstyle.co</a>
          </div>
          
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} VStyle. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
