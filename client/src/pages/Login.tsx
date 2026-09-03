import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [demoLoading, setDemoLoading] = useState(false);
  const { login, guestLogin, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      // Error handled in store
    }
  };

  const handleGuestLogin = async () => {
    clearError();
    try {
      setDemoLoading(true);
      await guestLogin();
      navigate('/');
    } catch (err) {
      console.error('Guest login failed:', err);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="bg-[#FFFFFF] border border-[#E5E5E3] rounded-2xl p-7 sm:p-9 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
          Welcome back
        </h1>
        <p className="text-xs text-[#737373] mt-1">
          Sign in to your account.
        </p>
      </div>

      {error && (
        <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-semibold text-[#0A0A0A] mb-1.5 uppercase tracking-wider"
          >
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E5E5E3] rounded-lg text-sm text-[#0A0A0A] placeholder-[#A1A1AA] focus:outline-none focus:border-[#0A0A0A] transition-colors"
            placeholder="name@example.com"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-[#0A0A0A] uppercase tracking-wider"
            >
              Password
            </label>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E5E5E3] rounded-lg text-sm text-[#0A0A0A] placeholder-[#A1A1AA] focus:outline-none focus:border-[#0A0A0A] transition-colors"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-lg bg-[#0A0A0A] hover:bg-[#262626] text-white text-xs font-semibold tracking-wide transition-colors disabled:opacity-50 mt-2"
        >
          {isLoading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      {/* Subtle Divider */}
      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#E5E5E3]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[#FFFFFF] px-2.5 text-[#737373] text-[11px]">or</span>
        </div>
      </div>

      {/* Instant Demo / Test Login button (strictly NO emoji) */}
      <button
        type="button"
        onClick={handleGuestLogin}
        disabled={demoLoading}
        className="w-full py-2.5 px-4 rounded-lg bg-[#F9F9F8] hover:bg-[#F4F4F2] border border-[#E5E5E3] text-[#0A0A0A] text-xs font-semibold tracking-wide transition-colors disabled:opacity-50"
      >
        {demoLoading ? 'Starting demo...' : 'Instant Demo / Test Login'}
      </button>

      <div className="mt-6 text-center text-xs text-[#737373]">
        Don't have an account?{' '}
        <Link to="/register" className="font-semibold text-[#0A0A0A] hover:underline">
          Create account
        </Link>
      </div>
    </div>
  );
};

export default Login;