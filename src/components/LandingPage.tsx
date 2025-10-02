import { useState } from 'react';
import { useAppStore } from '../store/appStore';

interface PricingTier {
  name: string;
  price: string;
  period: string;
  features: string[];
  color: string;
  popular?: boolean;
}

const LandingPage: React.FC = () => {
  const { isAuthenticated, user } = useAppStore();
  const [activePricing, setActivePricing] = useState<'monthly' | 'yearly'>('monthly');

  const pricingTiers: PricingTier[] = [
    {
      name: "FREE",
      price: "$0",
      period: "forever",
      color: "#00ff88",
      features: [
        "5 documents per month",
        "Basic AI analysis",
        "Standard reading modes",
        "Community support",
        "100 credits included"
      ]
    },
    {
      name: "PROFESSIONAL",
      price: activePricing === 'monthly' ? "$19" : "$15",
      period: activePricing === 'monthly' ? "month" : "month (billed yearly)",
      color: "#ff0088",
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
      name: "ENTERPRISE",
      price: "Custom",
      period: "contact us",
      color: "#0088ff",
      features: [
        "Everything in Professional",
        "Custom AI models",
        "API access",
        "Dedicated support",
        "Custom integrations",
        "Advanced analytics",
        "White-label options"
      ]
    }
  ];

  const handleGetStarted = () => {
    if (isAuthenticated) {
      // Redirect to main app
      window.location.href = '/';
    } else {
      // Show auth modal or redirect to sign up
      window.location.href = '/?auth=true';
    }
  };

  return (
    <div className="landing-page min-h-screen bg-black text-white font-mono">
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-10">
        <div className="grid-pattern"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 flex justify-between items-center p-6 border-b border-gray-800">
        <div className="flex items-center space-x-4">
          <div className="bg-white text-black px-4 py-2 border border-gray-300 font-bold">
            VStyle
          </div>
          <nav className="hidden md:flex space-x-6">
            <a href="#features" className="hover:text-green-400 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-green-400 transition-colors">Pricing</a>
            <a href="#research" className="hover:text-green-400 transition-colors">Research</a>
            <a href="#dimensions" className="hover:text-green-400 transition-colors">Dimensions</a>
          </nav>
        </div>
        
        <div className="flex items-center space-x-4">
          {isAuthenticated ? (
            <div className="flex items-center space-x-4">
              <span className="text-sm">Welcome, {user?.full_name || user?.email}</span>
              <div className="flex items-center space-x-2">
                <span className="text-xs bg-green-400 text-black px-2 py-1 rounded">
                  {user?.tier?.toUpperCase() || 'FREE'}
                </span>
                <span className="text-xs text-gray-400">
                  {user?.credits || 0} credits
                </span>
              </div>
              <button 
                onClick={() => window.location.href = '/'}
                className="bg-green-400 text-black px-4 py-2 hover:bg-green-300 transition-colors"
              >
                Go to App
              </button>
            </div>
          ) : (
            <div className="flex space-x-3">
              <button 
                onClick={() => window.location.href = '/?auth=true'}
                className="border border-white px-4 py-2 hover:bg-white hover:text-black transition-colors"
              >
                Sign In
              </button>
              <button 
                onClick={handleGetStarted}
                className="bg-red-500 text-white px-4 py-2 hover:bg-red-400 transition-colors"
              >
                Get Started
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 px-6 py-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left Side - Main Content */}
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-6xl font-bold leading-tight">
                  <span className="text-white glow-text">READING,</span>
                  <br />
                  <span className="text-white glow-text">EVOLVED</span>
                </h1>
                <div className="border-l-2 border-white pl-6">
                  <p className="text-lg leading-relaxed">
                    NeoReader deconstructs academic material<br />
                    across multiple cognitive dimensions,<br />
                    revealing patterns and connections<br />
                    invisible to conventional reading methods.
                  </p>
                </div>
              </div>

              <div className="flex space-x-4">
                <button 
                  onClick={handleGetStarted}
                  className="border border-white px-8 py-3 hover:bg-white hover:text-black transition-colors"
                >
                  Start Free Trial
                </button>
                <button 
                  onClick={handleGetStarted}
                  className="bg-red-500 text-white px-8 py-3 hover:bg-red-400 transition-colors"
                >
                  VIEW RESEARCH
                </button>
              </div>
            </div>

            {/* Right Side - Feature Box */}
            <div className="space-y-8">
              <div className="bg-white text-black p-6 border border-gray-300 transform rotate-2">
                <h3 className="text-lg font-semibold mb-2">Academic comprehension</h3>
                <p className="text-sm">through multidimensional</p>
                <p className="text-sm font-semibold">AI analysis</p>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">2.4M+</div>
                  <div className="text-sm text-gray-400">Documents Processed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">47</div>
                  <div className="text-sm text-gray-400">Institutions Connected</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">87%</div>
                  <div className="text-sm text-gray-400">Comprehension Boost</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">24/7</div>
                  <div className="text-sm text-gray-400">AI Analysis</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Pricing Section */}
      <section id="pricing" className="relative z-10 px-6 py-16 bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Choose Your Cognitive Upgrade</h2>
            <p className="text-gray-400 mb-8">Unlock the full potential of academic reading</p>
            
            {/* Pricing Toggle */}
            <div className="flex justify-center mb-8">
              <div className="bg-gray-800 p-1 rounded-lg">
                <button
                  onClick={() => setActivePricing('monthly')}
                  className={`px-6 py-2 rounded-md transition-colors ${
                    activePricing === 'monthly' 
                      ? 'bg-green-400 text-black' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setActivePricing('yearly')}
                  className={`px-6 py-2 rounded-md transition-colors ${
                    activePricing === 'yearly' 
                      ? 'bg-green-400 text-black' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Yearly (Save 20%)
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pricingTiers.map((tier, index) => (
              <div
                key={tier.name}
                className={`relative p-8 border-2 rounded-lg transition-all hover:scale-105 ${
                  tier.popular 
                    ? 'border-green-400 bg-gray-800' 
                    : 'border-gray-700 bg-gray-900'
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-green-400 text-black px-4 py-1 rounded-full text-sm font-bold">
                      MOST POPULAR
                    </span>
                  </div>
                )}
                
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2" style={{ color: tier.color }}>
                    {tier.name}
                  </h3>
                  <div className="text-4xl font-bold mb-1">{tier.price}</div>
                  <div className="text-gray-400 text-sm">per {tier.period}</div>
                </div>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center">
                      <span className="text-green-400 mr-3">✓</span>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={handleGetStarted}
                  className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
                    tier.popular
                      ? 'bg-green-400 text-black hover:bg-green-300'
                      : 'border-2 border-gray-600 hover:border-green-400 hover:text-green-400'
                  }`}
                >
                  {tier.name === 'ENTERPRISE' ? 'Contact Sales' : 'Get Started'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 px-6 py-16">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Advanced Cognitive Features</h2>
            <p className="text-gray-400">Experience reading like never before</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-400 rounded-full flex items-center justify-center">
                <span className="text-black text-2xl font-bold">🧠</span>
              </div>
              <h3 className="text-xl font-bold mb-3">Neural Analysis</h3>
              <p className="text-gray-400">
                AI-powered pattern recognition and contextual understanding across multiple cognitive dimensions.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-2xl font-bold">⚡</span>
              </div>
              <h3 className="text-xl font-bold mb-3">Quantum Parse</h3>
              <p className="text-gray-400">
                Multi-dimensional text decomposition and semantic mapping for deeper comprehension.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-2xl font-bold">🔗</span>
              </div>
              <h3 className="text-xl font-bold mb-3">Synapse Synthesis</h3>
              <p className="text-gray-400">
                Knowledge network construction and cross-disciplinary linking for comprehensive understanding.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-800 px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="bg-white text-black px-4 py-2 border border-gray-300 font-bold mb-4 inline-block">
                VStyle
              </div>
              <p className="text-gray-400 text-sm">
                Revolutionizing academic reading through advanced AI analysis.
              </p>
            </div>
            
            <div>
              <h4 className="font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#features" className="hover:text-green-400">Features</a></li>
                <li><a href="#pricing" className="hover:text-green-400">Pricing</a></li>
                <li><a href="#" className="hover:text-green-400">API</a></li>
                <li><a href="#" className="hover:text-green-400">Integrations</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-green-400">Documentation</a></li>
                <li><a href="#" className="hover:text-green-400">Research</a></li>
                <li><a href="#" className="hover:text-green-400">Support</a></li>
                <li><a href="#" className="hover:text-green-400">Community</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-green-400">About</a></li>
                <li><a href="#" className="hover:text-green-400">Blog</a></li>
                <li><a href="#" className="hover:text-green-400">Careers</a></li>
                <li><a href="#" className="hover:text-green-400">Contact</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2024 VStyle. All rights reserved. | Privacy Policy | Terms of Service</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
