import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { register, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await register(name, email, password);
      navigate('/');
    } catch (err) {
      // Handled in store
    }
  };

  return (
    <div className="bg-[#FFFFFF] border border-[#E5E5E3] rounded-2xl p-7 sm:p-9 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
          Create an account
        </h1>
        <p className="text-xs text-[#737373] mt-1">
          Start understanding your money with precision.
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
            htmlFor="name"
            className="block text-xs font-semibold text-[#0A0A0A] mb-1.5 uppercase tracking-wider"
          >
            Full Name
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E5E5E3] rounded-lg text-sm text-[#0A0A0A] placeholder-[#A1A1AA] focus:outline-none focus:border-[#0A0A0A] transition-colors"
            placeholder="Jane Doe"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-xs font-semibold text-[#0A0A0A] mb-1.5 uppercase tracking-wider"
          >
            Email Address
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E5E5E3] rounded-lg text-sm text-[#0A0A0A] placeholder-[#A1A1AA] focus:outline-none focus:border-[#0A0A0A] transition-colors"
            placeholder="name@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-semibold text-[#0A0A0A] mb-1.5 uppercase tracking-wider"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
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
          {isLoading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <div className="mt-6 text-center text-xs text-[#737373]">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-[#0A0A0A] hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
};

export default Register;