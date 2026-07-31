import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Loader2, User, Lock, Building2, ChevronDown, Fingerprint, AlertCircle } from 'lucide-react';

const BLOCKED_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'protonmail.com', 'yahoo.co.in', 'rediffmail.com', 'aol.com', 'mail.com', 'zoho.com'];

const roleContent = {
  issuer: {
    headline: 'Turn your business records into a disclosure-ready IPO draft',
    points: [
      'Answer plain-language questions — no legal jargon required',
      'Upload financials, cap tables, and resolutions for automatic extraction',
      'Get a SEBI ICDR-aligned draft with every sentence backed by your data',
      'Track reviewer feedback and resolve comments in one place'
    ],
    accent: 'indigo'
  },
  reviewer: {
    headline: 'Review, certify, and export SME IPO drafts faster',
    points: [
      'Inspect AI-generated sections with confidence scores and source citations',
      'Flag inconsistencies between intake data and uploaded documents',
      'Lock and certify chapters section by section',
      'Export a watermarked draft that removes the watermark only after full certification'
    ],
    accent: 'emerald'
  }
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState('issuer');
  const [digilockerToast, setDigilockerToast] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const validateEmail = (emailVal) => {
    const domain = emailVal.split('@')[1]?.toLowerCase();
    if (domain && BLOCKED_DOMAINS.includes(domain)) {
      setEmailError('Please use your work/company email to sign in.');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    if (val.includes('@')) validateEmail(val);
    else setEmailError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateEmail(email)) return;
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDigilocker = () => {
    setDigilockerToast(true);
    setTimeout(() => setDigilockerToast(false), 3000);
  };

  const fillDemo = (demoEmail, demoPass, role) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setSelectedRole(role);
    setError('');
    setEmailError('');
  };

  const content = roleContent[selectedRole];

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-indigo-950 to-navy-950 flex">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-3xl"></div>
      </div>

      {/* Left Panel — Role-specific messaging */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 items-center justify-center p-12">
        <div className="max-w-md animate-fade-in">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-lg">IPO Pilot AI</span>
          </div>

          <h2 className="text-3xl font-bold text-white leading-tight mb-6">
            {content.headline}
          </h2>

          <div className="space-y-4">
            {content.points.map((point, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${selectedRole === 'reviewer' ? 'bg-emerald-600/20' : 'bg-indigo-600/20'}`}>
                  <span className={`text-xs font-bold ${selectedRole === 'reviewer' ? 'text-emerald-400' : 'text-indigo-400'}`}>{i + 1}</span>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed">{point}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Platform Status</p>
            <p className="text-xs text-slate-400">AI-assisted · SEBI ICDR aligned · Human-certified output</p>
          </div>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-md animate-fade-in">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-8">
            <div className="text-center mb-8 lg:hidden">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/25">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-1">IPO Pilot AI</h1>
              <p className="text-slate-400 text-sm">AI-Powered IPO Document Platform</p>
            </div>

            <div className="hidden lg:block mb-6">
              <h2 className="text-xl font-bold text-white">Sign in to your account</h2>
              <p className="text-slate-400 text-sm mt-1">Access your IPO document workspace</p>
            </div>

            {/* Role Selector */}
            <div className="flex gap-2 mb-6 p-1 bg-white/5 rounded-xl">
              <button
                type="button"
                onClick={() => setSelectedRole('issuer')}
                className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${selectedRole === 'issuer' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                Issuer / SME
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('reviewer')}
                className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${selectedRole === 'reviewer' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                Reviewer / Banker
              </button>
            </div>

            {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm text-center">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Work Email Address</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="email" value={email} onChange={handleEmailChange}
                    className={`w-full pl-11 pr-4 py-3 bg-white/5 border ${emailError ? 'border-red-500/50 focus:border-red-500/70' : 'border-white/10 focus:border-indigo-500/50'} rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all text-sm`}
                    placeholder="you@company.com" required />
                </div>
                {emailError && (
                  <div className="flex items-center gap-1.5 mt-2 text-red-400 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{emailError}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 outline-none transition-all text-sm"
                    placeholder="Enter your password" required />
                </div>
              </div>

              <button type="submit" disabled={loading || !!emailError}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-600/25 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {loading ? (<><Loader2 className="w-4 h-4 animate-spin" />Signing In...</>) : 'Sign In'}
              </button>
            </form>

            {/* DigiLocker Button */}
            <div className="mt-4 relative">
              <button type="button" onClick={handleDigilocker}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-300 font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm">
                <Fingerprint className="w-4 h-4" />
                Continue with DigiLocker
              </button>
              {digilockerToast && (
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-lg border border-slate-700 whitespace-nowrap animate-slide-up shadow-lg">
                  Coming soon — DigiLocker integration is under development
                </div>
              )}
            </div>

            <div className="my-6 flex items-center gap-4">
              <div className="flex-1 h-px bg-white/10"></div>
              <span className="text-xs text-slate-500 uppercase tracking-wider">Quick Demo Access</span>
              <div className="flex-1 h-px bg-white/10"></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => fillDemo('aarav@example.com', 'demo123', 'issuer')}
                className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/30 rounded-xl transition-all duration-200 text-left group">
                <div className="w-8 h-8 bg-indigo-600/20 rounded-lg flex items-center justify-center mb-2 group-hover:bg-indigo-600/30 transition-colors">
                  <span className="text-indigo-400 font-bold text-sm">AM</span>
                </div>
                <p className="text-white text-sm font-medium">Aarav Mehta</p>
                <p className="text-slate-500 text-xs mt-0.5">Issuer / Promoter</p>
              </button>
              <button type="button" onClick={() => fillDemo('priya@example.com', 'demo123', 'reviewer')}
                className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/30 rounded-xl transition-all duration-200 text-left group">
                <div className="w-8 h-8 bg-emerald-600/20 rounded-lg flex items-center justify-center mb-2 group-hover:bg-emerald-600/30 transition-colors">
                  <span className="text-emerald-400 font-bold text-sm">PS</span>
                </div>
                <p className="text-white text-sm font-medium">Priya Sharma</p>
                <p className="text-slate-500 text-xs mt-0.5">Reviewer / Banker</p>
              </button>
            </div>
          </div>
          <p className="text-center text-slate-600 text-xs mt-6">This is a demo prototype. Not for regulatory filing.</p>
        </div>
      </div>
    </div>
  );
}
