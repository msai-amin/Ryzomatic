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
  highlight?: boolean;
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
    { name: "Pricing", href: "#pricing" },
  ];

  const featureCards: FeatureCard[] = [
    // 1. Discovery - Start with the big picture value proposition
    {
      title: "Your Research, Mapped",
      description: "Don't just store files; connect ideas. The AI analyzes the semantic relationships between papers to generate a dynamic network graph. It doesn't just draw lines—it writes summaries explaining the specific intellectual link between any two documents.",
      icon: "🕸️",
      highlight: true
    },
    // 2. Reading Experience - How you interact with documents
    {
      title: "Highlights That Think",
      description: "Highlight a concept once, and watch as related ideas across your library light up. Your notes aren't just annotations—they're building blocks of a searchable knowledge graph that grows smarter with every paper.",
      icon: "📝"
    },
    {
      title: "Papers That Speak",
      description: "Your morning commute just became productive. Natural voices read your papers while highlighting each word. Adjust speed, pitch, and voice to match your learning style. Research doesn't have to mean sitting at a desk.",
      icon: "🎧"
    },
    // 3. Understanding - Get help analyzing and understanding
    {
      title: "Your AI Co-Researcher",
      description: "Stuck on a complex methodology? Ask your question right there in the document. Your AI doesn't just search—it understands context, remembers what you've read, and explains concepts using examples from your own library.",
      icon: "🤖"
    },
    // 4. Workflow Tools - Professional review capabilities
    {
      title: "Deep Methodological Critique",
      description: "Go beyond surface-level summaries. Our AI acts as a critical co-reviewer, identifying gaps in logic, evaluating statistical approaches, and assessing contributions to the field. Generate a comprehensive, professional review report instantly.",
      icon: "📐",
      highlight: true
    },
    // 5. Insights - Self-reflection and learning tracking
    {
      title: "Watch Yourself Learn",
      description: "Ever wonder how your research interests evolved? See your cognitive journey mapped out: which papers led to breakthroughs, how concepts connected over time, and where your thinking took unexpected turns.",
      icon: "🧠",
      highlight: true
    },
    // 6. Organization - How everything stays organized
    {
      title: "A Library That Organizes Itself",
      description: "Stop spending hours filing papers. Smart collections auto-organize by topic, methodology, or citation network. Search by concept, not just keywords. Your library becomes a living knowledge base.",
      icon: "📁"
    }
  ];


  const pricingTiers: PricingTier[] = [
    {
      name: "Free",
      price: "Free",
      period: "forever",
      features: [
        "50 documents per month",
        "200 AI chats per month",
        "50 OCR processing per month",
        "100 vision extraction pages per month",
        "10GB storage",
        "All features enabled",
        "Highlights, notes, TTS, Pomodoro",
        "Document relationships",
        "Community support"
      ]
    },
    {
      name: "Custom",
      price: "Contact Us",
      period: "Custom plans",
      popular: true,
      features: [
        "Unlimited or custom limits",
        "Priority support",
        "Custom integrations",
        "Team features",
        "SLA guarantees",
        "No credit restrictions",
        "Dedicated account manager",
        "Custom pricing"
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
      <section id="features" className="relative overflow-hidden">
        {/* Gradual transition from hero */}
        <div className="h-24 bg-gradient-to-b from-white via-slate-50 to-slate-100" />
        
        {/* Softened Dark Banner Section */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-700 via-slate-600 to-slate-700">
          {/* Decorative background elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/15 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-400/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-blue-400/8 via-purple-400/8 to-indigo-400/8 rounded-full blur-3xl" />
          </div>

          {/* Grid pattern overlay */}
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }} />

          <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32">
          {/* Header */}
          <div className="flex flex-col gap-6 text-center mb-20">
            <div className="inline-flex items-center gap-2 mx-auto mb-2">
              <div className="h-px w-16 bg-gradient-to-r from-transparent via-blue-300 to-transparent" />
              <span className="text-xs font-semibold uppercase tracking-widest text-blue-200">Research Made Simple</span>
              <div className="h-px w-16 bg-gradient-to-l from-transparent via-purple-300 to-transparent" />
            </div>
            <h2 className="text-4xl md:text-6xl font-bold text-white max-w-5xl mx-auto leading-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
              <span className="bg-gradient-to-r from-blue-300 via-cyan-300 to-blue-300 bg-clip-text text-transparent font-extrabold">Clarify</span> complex topics,{' '}
              <span className="bg-gradient-to-r from-purple-300 via-pink-300 to-purple-300 bg-clip-text text-transparent font-extrabold">generate peer reviews</span>, and{' '}
              <span className="bg-gradient-to-r from-indigo-300 via-blue-300 to-indigo-300 bg-clip-text text-transparent font-extrabold">listen</span> to your research on the go.
            </h2>
            <p className="mx-auto max-w-2xl text-lg md:text-xl text-slate-200 leading-relaxed mt-6">
              Stop fighting with your tools. Start discovering connections, insights, and breakthroughs.
            </p>
          </div>
          </div>
          
          {/* Longer, smoother transition gradient from dark to light */}
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-b from-transparent via-slate-100/80 via-slate-50/60 to-white" />
        </div>

        {/* Light Cards Section */}
        <div className="relative mx-auto max-w-7xl px-6 -mt-24 pb-24 sm:pb-32 bg-white">
          {/* Creative Grid Layout - Staggered and Varied Sizes */}
          <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-3 pt-16">
            {featureCards.map((feature, index) => {
              const isHighlight = feature.highlight;
              const isLarge = index === 0 || index === 2 || index === 5; // First, third, and sixth cards are larger
              
              return (
                <div
                  key={feature.title}
                  className={`group relative overflow-hidden rounded-2xl transition-all duration-500 ${
                    isHighlight 
                      ? 'md:col-span-2 lg:col-span-1 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-2 border-slate-700 shadow-2xl' 
                      : isLarge
                      ? 'bg-white border-2 border-slate-200 shadow-lg'
                      : 'bg-white border border-slate-200 shadow-sm'
                  } hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.02]`}
                  style={{
                    animationDelay: `${index * 100}ms`
                  }}
                >
                  {/* Decorative corner accent for highlighted cards */}
                  {isHighlight && (
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-bl-full" />
                  )}
                  
                  <div className={`relative p-6 md:p-8 flex flex-col h-full ${isHighlight ? 'min-h-[280px]' : isLarge ? 'min-h-[240px]' : 'min-h-[200px]'}`}>
                    {/* Icon with creative styling */}
                    <div className={`mb-4 ${isHighlight ? 'text-5xl' : 'text-4xl'} transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}>
                      {feature.icon}
                    </div>
                    
                    {/* Title */}
                    <h3 className={`text-xl md:text-2xl font-bold mb-4 leading-tight ${isHighlight ? 'text-white' : 'text-slate-900'}`} style={{ fontFamily: "'Inter', sans-serif" }}>
                      {feature.title}
                    </h3>
                    
                    {/* Description */}
                    <p className={`text-sm md:text-base leading-relaxed flex-grow ${isHighlight ? 'text-slate-200' : 'text-slate-600'}`}>
                      {feature.description}
                    </p>

                    {/* Hover effect indicator */}
                    {!isHighlight && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
                    )}
                  </div>

                  {/* Shine effect on hover */}
                  <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${
                    isHighlight 
                      ? 'bg-gradient-to-r from-transparent via-white/10 to-transparent' 
                      : 'bg-gradient-to-br from-blue-50/50 via-transparent to-purple-50/50'
                  }`} />
                </div>
              );
            })}
          </div>

          {/* Three Pillars Section - More Creative */}
          <div className="mt-32 relative">
            <div className="text-center mb-16">
              <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4" style={{ fontFamily: "'Inter', sans-serif" }}>
                Why Researchers Choose ryzomatic
              </h3>
              <p className="text-slate-600 max-w-2xl mx-auto">
                Three principles that guide everything we build
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3 relative">
              {/* Connecting line (desktop only) */}
              <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
              
              {[
                {
                  icon: "🌐",
                  title: "Research That Remembers",
                  description: "Every paper, every highlight, every note becomes part of your permanent knowledge network. Years later, ask 'What did I read about fMRI studies?' and get instant, contextual answers.",
                  gradient: "from-blue-500 to-cyan-500"
                },
                {
                  icon: "⚡",
                  title: "AI That Gets Context",
                  description: "Your AI doesn't just answer questions—it understands what you're reading, remembers your previous conversations, and connects dots across your entire library in real-time.",
                  gradient: "from-purple-500 to-pink-500"
                },
                {
                  icon: "🎯",
                  title: "Built by Researchers",
                  description: "Every feature comes from real pain points. We're academics who got tired of juggling tools, so we built one workspace that handles everything from reading to reviewing.",
                  gradient: "from-indigo-500 to-purple-500"
                }
              ].map((pillar, index) => (
                <div
                  key={pillar.title}
                  className="relative group"
                >
                  {/* Animated background circle */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${pillar.gradient} opacity-0 group-hover:opacity-10 rounded-3xl blur-2xl transition-opacity duration-500`} />
                  
                  <div className="relative bg-white/80 backdrop-blur-sm border-2 border-slate-200 rounded-2xl p-8 text-center transition-all duration-300 group-hover:border-slate-300 group-hover:shadow-xl">
                    {/* Icon with gradient background */}
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 bg-gradient-to-br from-slate-50 to-slate-100 group-hover:scale-110 transition-transform duration-300">
                      <span className="text-4xl">{pillar.icon}</span>
                    </div>
                    
                    <h4 className="text-xl font-bold text-slate-900 mb-3" style={{ fontFamily: "'Inter', sans-serif" }}>
                      {pillar.title}
                    </h4>
                    
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {pillar.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
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
                    onClick={tier.name === 'Custom' ? () => window.location.href = 'mailto:info@ryzomatic.net?subject=Custom Plan Inquiry' : handleGetStarted}
                    className={`w-full rounded-full px-4 py-3 text-sm font-semibold transition ${
                      tier.popular
                        ? 'bg-slate-800 text-white shadow-lg shadow-slate-800/20 hover:bg-slate-700'
                        : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {tier.name === 'Free' ? 'Get Started Free' : tier.name === 'Custom' ? 'Contact Us' : `Choose ${tier.name}`}
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
            <a href="#pricing" className="transition hover:text-slate-900">Pricing</a>
            <a href="mailto:info@ryzomatic.net" className="transition hover:text-slate-900">info@ryzomatic.net</a>
          </div>
          
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} ryzomatic. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
