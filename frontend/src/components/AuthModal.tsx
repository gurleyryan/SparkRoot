'use client';

import { useState } from 'react';
import type { User } from '@/types';

interface AuthModalProps {
  onClose: () => void;
  onAuth: (userData: User) => void;
}

export default function AuthModal({ onClose, onAuth }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // For now, simulate successful auth
      // TODO: Replace with actual API call
      setTimeout(() => {
        const userData: User = {
          id: 'dummy-id-' + Date.now(),
          email: formData.email || `${formData.username}@example.com`,
          full_name: formData.username,
          avatar_url: undefined,
          created_at: new Date().toISOString()
        };
        
        const token = 'dummy-token-' + Date.now();
        localStorage.setItem('auth_token', token);
        onAuth(userData);
        setIsLoading(false);
      }, 1000);

    } catch {
      setError('Authentication failed. Please try again.');
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-40 flex items-center justify-center">
      <div className="sleeve-morphism p-8 rounded-xl shadow-xl max-w-md w-full z-50">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-mtg text-mtg-white">
            {isLogin ? 'Sign In' : 'Create Account'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-300 mb-2 font-mtg-body">Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-mtg-blue focus:outline-none"
              required
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-gray-300 mb-2 font-mtg-body">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-mtg-blue focus:outline-none"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-gray-300 mb-2 font-mtg-body">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-mtg-blue focus:outline-none"
              required
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-gray-300 mb-2 font-mtg-body">Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-mtg-blue focus:outline-none"
                required
              />
            </div>
          )}

          {error && (
            <div className="bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-mtg-blue hover:bg-blue-600 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {isLoading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-mtg-blue hover:text-blue-400 font-mtg-body"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-gray-400 text-sm font-mtg-body">
            Demo mode - Authentication simulated locally
          </p>
        </div>
      </div>
    </div>
  );
}
