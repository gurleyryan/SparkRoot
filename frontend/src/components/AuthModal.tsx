"use client";
import React, { useEffect, useRef, useState } from "react";
import { useAuthStore } from '@/store/authStore';
import { useToast } from "./ToastProvider";

interface AuthModalProps {
  onClose: () => void;
}

export default function AuthModal({ onClose }: AuthModalProps) {
  const showToast = useToast();
  // Accessible form submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      if (!isLogin && formData.password !== formData.confirmPassword) {
        setError('Passwords do not match.');
        showToast('Passwords do not match.', 'error');
        setIsLoading(false);
        return;
      }
      if (isLogin) {
        await login({
          email: formData.email || formData.username,
          password: formData.password,
        }, rememberMe);
        const authError = useAuthStore.getState().error;
        if (!authError) {
          showToast('Login successful!', 'success');
          setIsLoading(false);
          onClose();
        } else {
          // Show error from authStore
          let msg = authError;
          if (msg && typeof msg === 'string') {
            if (msg.match(/unique.*email/i)) {
              msg = 'An account with this email already exists.';
            } else if (msg.match(/unique.*username/i)) {
              msg = 'This username is already taken.';
            } else if (msg.match(/password.*too short/i)) {
              msg = 'Password is too short.';
            } else if (msg.match(/invalid.*email/i)) {
              msg = 'Please enter a valid email address.';
            } else if (msg.match(/incorrect.*password/i)) {
              msg = 'Incorrect password.';
            } else if (msg.match(/user.*not found/i)) {
              msg = 'No account found with that email or username.';
            } else if (msg.match(/login failed|authentication failed/i)) {
              msg = 'Incorrect email/username or password.';
            }
          } else {
            msg = 'Authentication failed. Please try again.';
          }
          setError(msg);
          showToast(msg, 'error');
          setIsLoading(false);
        }
      } else {
        await register({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          full_name: formData.fullName,
        });
        const authError = useAuthStore.getState().error;
        if (!authError) {
          showToast('Registration successful! You are now logged in.', 'success');
          setIsLoading(false);
          onClose();
        } else {
          // Show error from authStore
          let msg = authError;
          if (msg && typeof msg === 'string') {
            if (msg.match(/unique.*email/i)) {
              msg = 'An account with this email already exists.';
            } else if (msg.match(/unique.*username/i)) {
              msg = 'This username is already taken.';
            } else if (msg.match(/password.*too short/i)) {
              msg = 'Password is too short.';
            } else if (msg.match(/invalid.*email/i)) {
              msg = 'Please enter a valid email address.';
            } else if (msg.match(/incorrect.*password/i)) {
              msg = 'Incorrect password.';
            } else if (msg.match(/user.*not found/i)) {
              msg = 'No account found with that email or username.';
            } else if (msg.match(/login failed|authentication failed/i)) {
              msg = 'Incorrect email/username or password.';
            }
          } else {
            msg = 'Authentication failed. Please try again.';
          }
          setError(msg);
          showToast(msg, 'error');
          setIsLoading(false);
        }
      }
    } catch (error: unknown) {
      let msg = 'Authentication failed. Please try again.';
      if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
        msg = (error as { message: string }).message;
      }
      // Custom handling for common Supabase/SQL errors
      if (msg.match(/unique.*email/i)) {
        msg = 'An account with this email already exists.';
      } else if (msg.match(/unique.*username/i)) {
        msg = 'This username is already taken.';
      } else if (msg.match(/password.*too short/i)) {
        msg = 'Password is too short.';
      } else if (msg.match(/invalid.*email/i)) {
        msg = 'Please enter a valid email address.';
      } else if (msg.match(/incorrect.*password/i)) {
        msg = 'Incorrect password.';
      } else if (msg.match(/user.*not found/i)) {
        msg = 'No account found with that email or username.';
      }
      setError(msg);
      showToast(msg, 'error');
      setIsLoading(false);
    }
  };
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
  const [rememberMe, setRememberMe] = useState(false);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);

  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus trap and ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      // Focus trap
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'input, button, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    // Focus first input
    setTimeout(() => {
      firstInputRef.current?.focus();
    }, 0);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);



  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-40 flex items-center justify-center">
      <div
        className="sleeve-morphism p-8 rounded-xl shadow-xl max-w-md w-full z-50"
        style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb), 0.95)" }}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-mtg text-mtg-white">
            {isLogin ? 'Sign In' : 'Create Account'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-mtg-white text-2xl"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sign In: Only email/username and password. Sign Up: All fields. */}
          {isLogin ? (
            <>
              <div>
                <label className="block text-rarity-uncommon mb-2 font-mtg-body">Email or Username</label>
                <input
                  type="text"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-rarity-common border border-rarity-uncommon rounded-lg px-4 py-3 text-mtg-white focus:border-mtg-blue focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-rarity-uncommon mb-2 font-mtg-body">Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full bg-rarity-common border border-rarity-uncommon rounded-lg px-4 py-3 text-mtg-white focus:border-mtg-blue focus:outline-none"
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-rarity-uncommon mb-2 font-mtg-body">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-rarity-common border border-rarity-uncommon rounded-lg px-4 py-3 text-mtg-white focus:border-mtg-blue focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-rarity-uncommon mb-2 font-mtg-body">Username</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full bg-rarity-common border border-rarity-uncommon rounded-lg px-4 py-3 text-mtg-white focus:border-mtg-blue focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-rarity-uncommon mb-2 font-mtg-body">Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="w-full bg-rarity-common border border-rarity-uncommon rounded-lg px-4 py-3 text-mtg-white focus:border-mtg-blue focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-rarity-uncommon mb-2 font-mtg-body">Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full bg-rarity-common border border-rarity-uncommon rounded-lg px-4 py-3 text-mtg-white focus:border-mtg-blue focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-rarity-uncommon mb-2 font-mtg-body">Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full bg-rarity-common border border-rarity-uncommon rounded-lg px-4 py-3 text-mtg-white focus:border-mtg-blue focus:outline-none"
                  required
                />
              </div>
            </>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              className="form-checkbox"
            />
            <label htmlFor="rememberMe" className="text-sm text-slate-300">Remember Me</label>
          </div>

          {error && (
            <div className="bg-mtg-black border border-mtg-red text-mtg-red px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-rarity-rare hover:bg-rarity-mythic text-rarity-common hover:text-rarity-uncommon disabled:bg-rarity-common font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            <i className="ms ms-w text-mtg-white mr-2"></i>
            {isLoading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="w-full bg-rarity-common hover:bg-rarity-uncommon text-rarity-rare hover:text-rarity-common disabled:bg-rarity-common font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            <i className="ms ms-g text-mtg-green mr-2"></i>
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