import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Car,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Globe,
  ArrowRight
} from 'lucide-react';
import { api } from '../../services/api';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim() || !password) {
      setError('Please provide both username/email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await login(usernameOrEmail.trim(), password, rememberMe);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const setDemoAccount = (u: string, p: string) => {
    setUsernameOrEmail(u);
    setPassword(p);
    setError(null);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    setForgotMessage(null);
    try {
      const res = await api.forgotPassword(forgotEmail);
      setForgotMessage(res.message);
    } catch (err: any) {
      setForgotMessage(err.message || 'Error processing password reset request.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative transportation background patterns */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 shadow-xl border-b border-blue-900/50">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between pointer-events-none opacity-20">
          <Car className="w-96 h-96 text-blue-400 -translate-x-20 translate-y-10" />
          <Globe className="w-80 h-80 text-blue-300 translate-x-20" />
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3.5 bg-blue-600 rounded-2xl shadow-xl shadow-blue-600/30 ring-4 ring-white/20 mb-3">
            <Car className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2.5">
            GULF TAXIS
            <span className="text-xs bg-blue-500/30 text-blue-200 border border-blue-400/40 px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider">
              Cloud Dispatch
            </span>
          </h1>
          <p className="mt-1 text-[14.5px] text-blue-200 font-medium">
            Professional Transport Booking & Fleet Management System
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-200">
          <div className="mb-6 pb-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Sign In to Dashboard</h2>
              <p className="text-[13.5px] text-slate-500 mt-0.5">Enter your authorized staff credentials</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full font-semibold border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>TLS Encrypted</span>
            </div>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-700 text-sm animate-shake">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
              <div>
                <p className="font-semibold text-sm">Authentication Failed</p>
                <p className="text-xs text-rose-600 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">
                Username or Email Address
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder="e.g. admin or admin@gulftaxis.com"
                  className="block w-full pl-10 pr-3.5 py-2.5 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[13.5px] font-semibold text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs sm:text-[13px] font-medium text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your security password"
                  className="block w-full pl-10 pr-10 py-2.5 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="remember-me" className="ml-2 block text-[13px] text-slate-600 cursor-pointer">
                  Remember this workstation session
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 min-h-[44px] border border-transparent rounded-xl shadow-md text-sm sm:text-[15px] font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Gulf Taxis</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Panel */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-[13px] font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-blue-600" />
                Quick Role Tester (One-Click)
              </span>
              <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                Pre-seeded DB
              </span>
            </div>
            <p className="text-[13px] text-slate-500 mb-3">
              Click any role below to automatically fill in demo credentials:
            </p>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <button
                type="button"
                onClick={() => setDemoAccount('superadmin', 'Admin@123')}
                className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition-colors group cursor-pointer"
              >
                <div className="font-semibold text-slate-800 group-hover:text-blue-700 flex items-center justify-between text-[13.5px]">
                  <span>👑 Super Admin</span>
                  <span className="text-xs text-blue-600 font-mono">Fill</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">Full System Access</div>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount('dispatcher', 'Dispatch@123')}
                className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition-colors group cursor-pointer"
              >
                <div className="font-semibold text-slate-800 group-hover:text-blue-700 flex items-center justify-between text-[13.5px]">
                  <span>🚘 Dispatcher</span>
                  <span className="text-xs text-blue-600 font-mono">Fill</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">Trips & Fleet Control</div>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount('agent', 'Agent@123')}
                className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition-colors group cursor-pointer"
              >
                <div className="font-semibold text-slate-800 group-hover:text-blue-700 flex items-center justify-between text-[13.5px]">
                  <span>📅 Booking Agent</span>
                  <span className="text-xs text-blue-600 font-mono">Fill</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">Create & Manage Trips</div>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount('finance', 'Finance@123')}
                className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition-colors group cursor-pointer"
              >
                <div className="font-semibold text-slate-800 group-hover:text-blue-700 flex items-center justify-between text-[13.5px]">
                  <span>💳 Finance Exec</span>
                  <span className="text-xs text-blue-600 font-mono">Fill</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">Payments & Balances</div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-4">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Timezone: Asia/Riyadh (GMT+3)
          </span>
          <span>•</span>
          <span>Gulf Taxis Dispatch Cloud v2.6</span>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg sm:text-[19px] font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-600" />
              <span>Password Recovery</span>
            </h3>
            <p className="text-[13px] text-slate-500 mb-4 leading-relaxed">
              Enter your registered Gulf Taxis email address to receive password reset authorization from the system administrator.
            </p>

            {forgotMessage && (
              <div className="mb-4 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
                {forgotMessage}
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">
                  Registered Staff Email
                </label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="e.g. employee@gulftaxis.com"
                  className="w-full px-3.5 py-2.5 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotMessage(null);
                  }}
                  className="px-4 py-2 min-h-[38px] text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="px-5 py-2 min-h-[38px] text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {forgotLoading ? 'Submitting...' : 'Request Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
