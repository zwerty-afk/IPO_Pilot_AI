import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Loader2, User, Lock, Building2, AlertCircle, Mail, Eye, EyeOff } from 'lucide-react';

const roleContent = {
  issuer: {
    headline: 'Turn your business records into a disclosure-ready IPO draft',
    points: [
      'Answer plain-language questions — no legal jargon required',
      'Upload financials, cap tables, and resolutions for automatic extraction',
      'Get a SEBI ICDR-aligned draft with every sentence backed by your data',
      'Track reviewer feedback and resolve comments in one place'
    ]
  },
  reviewer: {
    headline: 'Review, certify, and export SME IPO drafts faster',
    points: [
      'Inspect AI-generated sections with confidence scores and source citations',
      'Flag inconsistencies between intake data and uploaded documents',
      'Lock and certify chapters section by section',
      'Export a watermarked draft that removes the watermark only after full certification'
    ]
  }
};

export default function LoginPage() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState('issuer');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const isSignup = mode === 'signup';

  const validateEmail = (emailVal) => {
    if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      setEmailError('Please enter a valid email address.');
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

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setEmailError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    // validateEmail passes on an empty string (it only rejects malformed input),
    // so without these checks a blank submit reached the server and came back as
    // "Invalid credentials", which reads as though correct details were rejected.
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    if (!password) { setError('Please enter your password.'); return; }
    if (isSignup && !name.trim()) { setError('Please enter your name.'); return; }
    if (isSignup && selectedRole === 'issuer' && !companyName.trim()) {
      setError('Please enter your company name.'); return;
    }
    if (!validateEmail(email)) return;
    setLoading(true);
    try {
      if (isSignup) {
        await register({ name: name.trim(), email: email.trim(), password, role: selectedRole, companyName: companyName.trim() });
      } else {
        await login(email.trim(), password);
      }
      // replace: true so the back button cannot return to the login form in an
      // already-authenticated session.
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const fallback = isSignup ? 'Could not create your account. Please try again.' : 'Invalid credentials. Please try again.';
      setError(err.response?.data?.message || fallback);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail, demoPass, role) => {
    setMode('signin');
    setEmail(demoEmail);
    setPassword(demoPass);
    setSelectedRole(role);
    setError('');
    setEmailError('');
  };

  const content = roleContent[selectedRole];

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-indigo-950 to-navy-950 flex flex-col lg:flex-row">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] max-w-full bg-indigo-600/5 rounded-full blur-3xl"></div>
      </div>

      {/* Left Panel — Role-specific messaging (desktop only) */}
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

      {/* Right Panel — Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 relative z-10 min-h-screen lg:min-h-0">
        <div className="w-full max-w-md animate-fade-in py-8">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-6 sm:p-8">
            <div className="text-center mb-6 lg:hidden">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-indigo-500/25">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-1">IPO Pilot AI</h1>
              <p className="text-slate-400 text-sm">AI-Powered IPO Document Platform</p>
            </div>

            <div className="hidden lg:block mb-6">
              <h2 className="text-xl font-bold text-white">{isSignup ? 'Create your account' : 'Sign in to your account'}</h2>
              <p className="text-slate-400 text-sm mt-1">{isSignup ? 'Set up your IPO document workspace' : 'Access your IPO document workspace'}</p>
            </div>

            {/* Sign In / Sign Up tabs */}
            <div className="flex gap-2 mb-6 p-1 bg-white/5 rounded-xl">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${!isSignup ? 'bg-white text-navy-900 shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${isSignup ? 'bg-white text-navy-900 shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                Sign Up
              </button>
            </div>

            {/* Role Selector */}
            <div className="flex gap-2 mb-5 p-1 bg-white/5 rounded-xl">
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

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignup && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 focus:border-indigo-500/50 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all text-sm"
                      placeholder="Your full name" required={isSignup} />
                  </div>
                </div>
              )}

              {isSignup && selectedRole === 'issuer' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Company Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 focus:border-indigo-500/50 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all text-sm"
                      placeholder="Your company's legal name" required={isSignup && selectedRole === 'issuer'} />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
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
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-11 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 outline-none transition-all text-sm"
                    placeholder={isSignup ? 'Create a password (min. 6 characters)' : 'Enter your password'}
                    minLength={isSignup ? 6 : undefined} required />
                  <button type="button" onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading || !!emailError}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-600/25 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {loading ? (<><Loader2 className="w-4 h-4 animate-spin" />{isSignup ? 'Creating Account...' : 'Signing In...'}</>) : (isSignup ? 'Create Account' : 'Sign In')}
              </button>
            </form>

            <p className="text-center text-slate-400 text-xs mt-4">
              {isSignup ? 'Already have an account? ' : "Don't have an account? "}
              <button type="button" onClick={() => switchMode(isSignup ? 'signin' : 'signup')}
                className="text-indigo-400 hover:text-indigo-300 font-semibold">
                {isSignup ? 'Sign in' : 'Sign up'}
              </button>
            </p>

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
