"use client";
import React, { useEffect, useRef, useState } from "react";
import Recovery from "./Recovery";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from '@/store/authStore';
import { useToast } from "./ToastProvider";

interface AuthModalProps {
  onClose: () => void;
}

export default function AuthModal({ onClose }: AuthModalProps) {
  const router = useRouter();
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
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
          // ...existing code...
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
        // Enhanced registration flow
        const result = await register({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          full_name: formData.fullName,
        });
        const authError = useAuthStore.getState().error;
        // If error, show error as before
        if (authError) {
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
        } else {
          // Show a clear success message after registration and switch to login after a delay
          showToast('Registration successful! Please check your email to confirm your account before logging in.', 'success');
          setIsLoading(false);
          setError('');
          setFormData({
            username: '',
            fullName: '',
            email: '',
            password: '',
            confirmPassword: ''
          });
          setShowSignupSuccess(true);
          let countdown = 3;
          setSignupCountdown(countdown);
          const interval = setInterval(() => {
            countdown -= 1;
            setSignupCountdown(countdown);
            if (countdown <= 0) {
              clearInterval(interval);
              setShowSignupSuccess(false);
              setIsLogin(true);
            }
          }, 1000);
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
  // Signup success state and countdown
  const [showSignupSuccess, setShowSignupSuccess] = useState(false);
  const [signupCountdown, setSignupCountdown] = useState(3);
  // Recovery mode: show password reset form
  // Recovery state: 'none' | 'request' | 'reset'
  const [recoveryState, setRecoveryState] = useState<'none' | 'request' | 'reset'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('type') === 'recovery' || params.get('recovery') === '1') {
        return 'reset';
      }
    }
    return 'none';
  });
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
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const { name, value, type, checked } = event.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError('');
  }

  // Password reset request form state
  const [resetEmail, setResetEmail] = useState("");
  const [resetRequestLoading, setResetRequestLoading] = useState(false);
  const [resetRequestError, setResetRequestError] = useState("");
  const [resetRequestSent, setResetRequestSent] = useState(false);
  // Supabase client for password reset
  const { createClient } = require("@supabase/supabase-js");

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    setResetRequestError("");
    setResetRequestLoading(true);
    setResetRequestSent(false);
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail);
      if (error) {
        setResetRequestError(error.message);
        showToast(error.message, "error");
      } else {
        setResetRequestSent(true);
        showToast("Password reset email sent! Please check your inbox.", "success");
      }
    } catch (err: any) {
      setResetRequestError(err.message || "Failed to send reset email.");
      showToast(err.message || "Failed to send reset email.", "error");
    } finally {
      setResetRequestLoading(false);
    }
  }

  return (
    <div className="modal-backdrop fixed inset-0 z-40 flex items-center justify-center">
      <div
        className="sleeve-morphism p-8 rounded-xl shadow-xl max-w-md w-full z-50"
        style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb), 0.95)" }}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-mtg text-mtg-white">
            {recoveryState === 'reset' ? 'Reset Password' : recoveryState === 'request' ? 'Request Password Reset' : isLogin ? 'Sign In' : 'Create Account'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-mtg-white text-2xl"
          >
            ×
          </button>
        </div>
        {/* Render modal content */}
        {showSignupSuccess ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="text-mtg-green text-xl font-semibold mb-4">Registration successful!</div>
            <div className="text-mtg-white mb-2">Please check your email to confirm your account before logging in.</div>
            <div className="text-mtg-blue mb-4">Switching to login in {signupCountdown}...</div>
          </div>
        ) : recoveryState === 'reset' ? (
          <Recovery onSuccess={() => {
            setRecoveryState('none');
            setIsLogin(true);
          }} />
        ) : recoveryState === 'request' ? (
          <>
            <form onSubmit={handleResetRequest} className="space-y-4">
              <div>
                <label className="block text-rarity-uncommon mb-2 font-mtg-body">Email</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  className="w-full bg-rarity-common border border-rarity-uncommon rounded-lg px-4 py-3 text-mtg-white focus:border-mtg-blue focus:outline-none"
                  required
                />
              </div>
              {resetRequestError && (
                <div className="bg-mtg-black border border-mtg-red text-mtg-red px-4 py-3 rounded-lg">{resetRequestError}</div>
              )}
              {resetRequestSent && (
                <div className="bg-mtg-black border border-mtg-green text-mtg-green px-4 py-3 rounded-lg">Password reset email sent! Please check your inbox.</div>
              )}
              <button
                type="submit"
                disabled={resetRequestLoading}
                className="w-full bg-rarity-rare hover:bg-rarity-mythic text-rarity-common hover:text-rarity-uncommon disabled:bg-rarity-common font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                {resetRequestLoading ? 'Please wait...' : 'Send Password Reset Email'}
              </button>
            </form>
            <div className="mt-6 text-center">
              <button
                onClick={() => setRecoveryState('none')}
                className="w-full bg-rarity-common hover:bg-rarity-uncommon text-rarity-rare hover:text-rarity-common font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          </>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Sign In: Only email and password. Sign Up: All fields. */}
              {isLogin ? (
                <>
                  <div>
                    <label className="block text-rarity-uncommon mb-2 font-mtg-body">Email</label>
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
                  <div className="flex justify-between items-center mt-2">
                    <button
                      type="button"
                      className="text-sm text-mtg-blue hover:underline"
                      onClick={() => setRecoveryState('request')}
                    >
                      Forgot password?
                    </button>
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
          </>
        )}
      </div>
    </div>
  );
}