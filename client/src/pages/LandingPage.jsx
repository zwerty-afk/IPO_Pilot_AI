import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  ArrowRight, 
  ClipboardList, 
  FileText, 
  Cpu, 
  AlertTriangle, 
  ShieldCheck, 
  Download, 
  Bookmark, 
  Scale, 
  Users, 
  MessageSquare, 
  Bot, 
  Bell, 
  CheckCircle2 
} from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* 1. Top Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-navy-900/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-500" />
            <span className="text-white font-bold text-lg">IPO Pilot AI</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/login')}
              className="text-slate-300 hover:text-white px-4 py-2 text-sm font-medium transition-colors"
            >
              Login
            </button>
            <button 
              onClick={() => navigate('/login')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2 rounded-xl text-sm shadow-sm transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <section className="relative pt-32 pb-24 overflow-hidden bg-gradient-to-br from-navy-900 via-indigo-950 to-navy-950">
        {/* Decorative blur */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-10 -left-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-4xl mx-auto text-center px-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-600/20 rounded-full text-indigo-300 text-xs font-medium mb-6 border border-indigo-500/20">
            <Bot className="w-4 h-4" />
            <span>AI-Powered IPO Document Platform</span>
          </div>
          
          <h1 className="text-5xl font-bold text-white leading-tight">
            Draft your SME IPO offer document in days, not months
          </h1>
          
          <p className="text-xl text-slate-400 mt-4 max-w-2xl mx-auto">
            AI-assisted disclosure drafting aligned with SEBI ICDR framework. Built for SME promoters, merchant bankers, and legal counsel.
          </p>
          
          <button 
            onClick={() => navigate('/login')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-3.5 rounded-xl text-base shadow-lg shadow-indigo-600/25 mt-8 inline-flex items-center gap-2 transition-all active:scale-[0.98]"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </button>
          
          <div className="text-slate-500 text-sm mt-4 flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 opacity-70" />
            No credit card required · 14-day free trial
          </div>
        </div>
      </section>

      {/* 3. "How It Works" Section */}
      <section className="bg-slate-50 py-20 px-4 border-t border-slate-200/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center">How It Works</h2>
          <p className="text-slate-500 text-center text-sm mt-2 max-w-xl mx-auto">
            Six steps from raw business records to a disclosure-ready draft
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
            {[
              { num: 1, title: 'Guided Intake', desc: 'Answer interactive questions about your business, financials, and promoters.', icon: ClipboardList },
              { num: 2, title: 'Document Upload & OCR', desc: 'Securely upload MoA, AoA, audits, and material contracts for automated processing.', icon: FileText },
              { num: 3, title: 'AI Draft Generation', desc: 'Our engine generates a structured draft based on SEBI ICDR requirements.', icon: Cpu },
              { num: 4, title: 'Gap & Inconsistency Detection', desc: 'Identifies missing evidence, conflicting numbers, and compliance gaps.', icon: AlertTriangle },
              { num: 5, title: 'Reviewer Certification', desc: 'Merchant bankers review, comment, and sign off on specific sections.', icon: ShieldCheck },
              { num: 6, title: 'Export Prospectus', desc: 'Export to standard formats ready for final formatting and filing.', icon: Download },
            ].map((step) => (
              <div key={step.num} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-sm">
                    {step.num}
                  </div>
                  <step.icon className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-4">{step.title}</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Key Features Section */}
      <section className="bg-white py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center">Platform Capabilities</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
            {[
              { title: 'Evidence-Linked Drafting', desc: 'Every claim in the DRHP is hyperlinked back to the source document for easy verification.', icon: Bookmark },
              { title: 'Completeness Heatmap', desc: 'Visual dashboard showing drafting progress and missing SEBI ICDR required disclosures.', icon: Shield },
              { title: 'Gap & Inconsistency Detection', desc: 'Automated cross-referencing to ensure numbers match across MD&A, financials, and summary.', icon: Scale },
              { title: 'Reviewer Workspace', desc: 'Dedicated portal for Lead Managers and Legal Counsel to track sign-offs and pending items.', icon: Users },
              { title: 'Smart Notifications', desc: 'Automated alerts for missing information, new uploads, or required review actions.', icon: Bell },
              { title: 'AI Chatbot Assistant', desc: 'Query your own documents instantly. "What was our revenue growth in FY23?"', icon: MessageSquare },
            ].map((feature, i) => (
              <div key={i} className="bg-slate-50 p-6 rounded-2xl border border-slate-200/60 hover:border-indigo-200 transition-all">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mb-4">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-4">{feature.title}</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Trust/Compliance Section */}
      <section className="bg-slate-50 py-16 px-4 text-center border-y border-slate-200/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900">Assistive AI, Human Certified</h2>
          <p className="text-sm text-slate-500 mt-2 max-w-xl mx-auto">
            IPO Pilot AI is an assistive tool. Every disclosure requires certification by a registered merchant banker and legal counsel before filing.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 md:gap-6 mt-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200/80 shadow-sm text-xs font-medium text-slate-700">
              <Bookmark className="w-4 h-4 text-indigo-500" />
              Evidence-Linked
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200/80 shadow-sm text-xs font-medium text-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Human-Certified
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200/80 shadow-sm text-xs font-medium text-slate-700">
              <Scale className="w-4 h-4 text-amber-500" />
              SEBI ICDR Aligned
            </div>
          </div>
        </div>
      </section>

      {/* 6. "Who It's For" Section */}
      <section className="bg-white py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center">Built for the Ecosystem</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
            {/* Issuers */}
            <div className="bg-indigo-50/50 p-8 rounded-2xl border border-indigo-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-700">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">SME Promoters & CFOs</h3>
              </div>
              <ul className="space-y-4">
                {[
                  'Centralized repository for all IPO-related documents',
                  'Guided intake reduces back-and-forth with bankers',
                  'Real-time visibility into drafting progress',
                  'Secure data room with granular access controls'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Reviewers */}
            <div className="bg-emerald-50/50 p-8 rounded-2xl border border-emerald-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-700">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Merchant Bankers & Legal Counsel</h3>
              </div>
              <ul className="space-y-4">
                {[
                  'Accelerated first-draft generation (70-80% ready)',
                  'Automated internal consistency checks',
                  'One-click tracing from claim to source document',
                  'Streamlined review and comment workflows'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Final CTA Section */}
      <section className="bg-gradient-to-br from-navy-900 via-indigo-950 to-navy-950 py-20 px-4 text-center border-t border-white/10">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8">Ready to streamline your SME IPO process?</h2>
          <button 
            onClick={() => navigate('/login')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-3.5 rounded-xl text-base shadow-lg shadow-indigo-600/25 inline-flex items-center gap-2 transition-all active:scale-[0.98]"
          >
            Get Started Now
            <ArrowRight className="w-5 h-5" />
          </button>
          <p className="text-slate-400 text-sm mt-4">Join modern promoters and bankers building the future of capital markets.</p>
        </div>
      </section>

      {/* 8. Footer */}
      <footer className="bg-navy-950 border-t border-white/10 py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-slate-500 text-sm flex items-center gap-2">
            <Shield className="w-4 h-4" />
            © {new Date().getFullYear()} IPO Pilot AI. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="text-slate-600 hover:text-slate-400 text-xs transition-colors">About</a>
            <a href="#" className="text-slate-600 hover:text-slate-400 text-xs transition-colors">Contact</a>
            <a href="#" className="text-slate-600 hover:text-slate-400 text-xs transition-colors">Privacy Policy</a>
            <a href="#" className="text-slate-600 hover:text-slate-400 text-xs transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
