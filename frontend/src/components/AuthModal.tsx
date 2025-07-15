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
    fullName: '',
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
      if (!isLogin && formData.password !== formData.confirmPassword) {
        setError('Passwords do not match.');
        setIsLoading(false);
        return;
      }

      let response, data;
      if (isLogin) {
        // Allow sign in with email or username
        const identifier = formData.email || formData.username;
        response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: identifier,
            password: formData.password
          })
        });
      } else {
        // Sign up
        response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            username: formData.username,
            full_name: formData.fullName
          })
        });
      }

      data = await response.json();
      if (!response.ok) {
        setError(data.detail || data.error || 'Authentication failed.');
        setIsLoading(false);
        return;
      }

      // Save token if present
      if (data.access_token) {
        localStorage.setItem('auth_token', data.access_token);
      }

      // Use user data from response if available
      const userData: User = {
        id: data.id || data.user?.id || '',
        email: data.email || data.user?.email || formData.email,
        full_name: data.full_name || data.user?.full_name || formData.fullName || formData.username,
        avatar_url: data.avatar_url || undefined,
        created_at: data.created_at || new Date().toISOString()
      };
      onAuth(userData);
      setIsLoading(false);
    } catch (err: any) {
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
          {/* Sign In: Only email/username and password. Sign Up: All fields. */}
          {isLogin ? (
            <>
              <div>
                <label className="block text-gray-300 mb-2 font-mtg-body">Email or Username</label>
                <input
                  type="text"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-mtg-blue focus:outline-none"
                  required
                />
              </div>
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
            </>
          ) : (
            <>
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
              <div>
                <label className="block text-gray-300 mb-2 font-mtg-body">Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-mtg-blue focus:outline-none"
                  required
                />
              </div>
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
            </>
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

        {/*
        <div className="mt-4 text-center">
          <p className="text-gray-400 text-sm font-mtg-body">
            Demo mode - Authentication simulated locally
          </p>
        </div>
        */}
      </div>
    </div>
  );
}
