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

interface Testimonial {
  quote: string;
  name: string;
  role: string;
}

interface PricingTier {
  name: string;
  price: string;
  period: string;
  features: string[];
  popular?: boolean;
}

const LandingPage: React.FC = () => {
  const { isAuthenticated, user } = useAppStore();

  const navigation: NavigationItem[] = [
    { name: "Features", href: "#features" },
    { name: "Use Cases", href: "#use-cases" },
    { name: "Testimonials", href: "#testimonials" },
    { name: "Pricing", href: "#pricing" },
  ];

  const featureCards: FeatureCard[] = [
    {
      title: "Research Composer",
      description: "Draft articles, grant proposals, and lecture notes with AI-assisted templates that organize sources and structure arguments.",
      icon: "📝"
    },
    {
      title: "Literature Synthesizer",
      description: "Turn dense papers into concise summaries, annotated bibliographies, and thematic notes for your literature review.",
      icon: "📚"
    },
    {
      title: "Project Tracker",
      description: "Monitor research progress, track publication timelines, and manage collaborative projects with clear, visual dashboards.",
      icon: "📊"
    }
  ];

  const useCases: UseCase[] = [
    {
      name: "For Students",
      description: "Manage coursework, organize research for your thesis, and seamlessly collaborate on group projects.",
      icon: "🎓"
    },
    {
      name: "For Professors",
      description: "Streamline your research pipeline, prepare engaging lectures, and mentor students effectively within one platform.",
      icon: "👤"
    },
    {
      name: "For Researchers",
      description: "Accelerate your literature review process, manage citations, and collaborate with co-authors across institutions.",
      icon: "🔬"
    }
  ];

  const testimonials: Testimonial[] = [
    {
      quote: "Immersive Reader transformed how I manage my literature reviews. I can synthesize papers in a fraction of the time, which is invaluable for my research.",
      name: "Dr. Eleanor Vance",
      role: "Postdoctoral Fellow, Department of History"
    },
    {
      quote: "Managing dissertation sources was overwhelming. Immersive Reader's workflow tools helped me organize everything and focus on writing. It's been a lifesaver.",
      name: "Ben Carter",
      role: "PhD Candidate, Sociology"
    }
  ];

  const pricingTiers: PricingTier[] = [
    {
      name: "Student",
      price: "$12",
      period: "month, billed annually",
      features: [
        "Up to 10 projects",
        "Literature Synthesizer",
        "Basic collaboration tools"
      ]
    },
    {
      name: "Researcher",
      price: "$25",
      period: "month, billed annually",
      popular: true,
      features: [
        "Unlimited projects & collaborators",
        "Advanced AI features",
        "Project Tracker & Analytics",
        "Priority support"
      ]
    },
    {
      name: "Institution",
      price: "Custom",
      period: "For departments & universities",
      features: [
        "Site-wide licensing",
        "Dedicated support & training",
        "Advanced security & SSO",
        "LMS integration"
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
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800">
              <span className="text-xl font-semibold text-white">IR</span>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900" style={{ fontFamily: "'DM Serif Display', serif" }}>Immersive Reader</p>
              <p className="text-xs uppercase tracking-widest text-slate-500">BY VSTYLE</p>
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
          
          <h1 className="max-w-4xl text-5xl font-semibold leading-tight text-slate-900 md:text-6xl" style={{ fontFamily: "'DM Serif Display', serif" }}>
            Reading Reimagined for Academics.
          </h1>
          
          <p className="max-w-2xl text-lg text-slate-600 md:text-xl">
            Immersive Reader is an intelligent reading platform for academics. Streamline your literature reviews, manage citations, draft manuscripts, and collaborate with peers—all in one immersive workspace.
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
            <button 
              onClick={handleGetStarted}
              className="rounded-full bg-slate-800 px-8 py-3 font-semibold text-white shadow-lg shadow-slate-800/30 transition hover:bg-slate-700"
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
                <source src="/videos/product-demo.mp4" type="video/mp4" />
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
      <section id="features" className="bg-slate-50 border-y border-slate-200">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="flex flex-col gap-6 text-center">
            <h2 className="text-4xl font-semibold text-slate-900" style={{ fontFamily: "'DM Serif Display', serif" }}>
              A Toolkit Engineered for Academic Excellence
            </h2>
            <p className="mx-auto max-w-2xl text-base text-slate-600">
              Immersive Reader transforms scattered notes and sources into a clear, actionable research workflow.
            </p>
          </div>
          
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {featureCards.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-slate-200 bg-white p-8 transition hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition group-hover:bg-slate-800 group-hover:text-white text-2xl">
                  {feature.icon}
                </div>
                <h3 className="mt-6 text-2xl font-semibold text-slate-900" style={{ fontFamily: "'DM Serif Display', serif" }}>
                  {feature.title}
                </h3>
                <p className="mt-4 text-sm text-slate-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="use-cases" className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="flex flex-col gap-6 text-center">
            <h2 className="text-4xl font-semibold text-slate-900" style={{ fontFamily: "'DM Serif Display', serif" }}>
              Built for Every Academic Role
            </h2>
            <p className="mx-auto max-w-2xl text-base text-slate-600">
              Whether you're working on a dissertation, preparing a syllabus, or collaborating on a groundbreaking study, Immersive Reader adapts to your workflow.
            </p>
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
                <h3 className="text-xl font-semibold text-slate-900" style={{ fontFamily: "'DM Serif Display', serif" }}>
                  {useCase.name}
                </h3>
                <p className="text-sm text-slate-600">{useCase.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="bg-slate-50 border-y border-slate-200">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="flex flex-col gap-6 text-center">
            <h2 className="text-4xl font-semibold text-slate-900" style={{ fontFamily: "'DM Serif Display', serif" }}>
              Trusted by Academics at Leading Institutions
            </h2>
          </div>
          
          <div className="mt-16 grid gap-8 md:grid-cols-2">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.name}
                className="rounded-2xl border border-slate-200 bg-white p-8 text-left shadow-sm"
              >
                <div className="text-4xl text-slate-300">"</div>
                <p className="mt-4 text-lg text-slate-700">{testimonial.quote}</p>
                <div className="mt-6 text-sm text-slate-500">
                  <p className="font-semibold text-slate-800">{testimonial.name}</p>
                  <p>{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="flex flex-col gap-6 text-center">
            <h2 className="text-4xl font-semibold text-slate-900" style={{ fontFamily: "'DM Serif Display', serif" }}>
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
                  <h3 className="mt-4 text-4xl font-semibold text-slate-900" style={{ fontFamily: "'DM Serif Display', serif" }}>
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
                    onClick={tier.name === 'Institution' ? () => window.location.href = 'mailto:support@vstyle.co' : handleGetStarted}
                    className={`w-full rounded-full px-4 py-3 text-sm font-semibold transition ${
                      tier.popular
                        ? 'bg-slate-800 text-white shadow-lg shadow-slate-800/20 hover:bg-slate-700'
                        : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {tier.name === 'Institution' ? 'Contact Sales' : `Choose ${tier.name}`}
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
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800">
              <span className="text-lg font-semibold text-white">IR</span>
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900" style={{ fontFamily: "'DM Serif Display', serif" }}>Immersive Reader</p>
              <p className="text-xs uppercase tracking-widest text-slate-500">by VStyle</p>
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
