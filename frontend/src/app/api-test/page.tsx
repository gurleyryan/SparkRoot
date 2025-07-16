"use client";
import React from 'react';

import { useState, useEffect } from 'react';

interface SampleCollection {
  stats?: {
    total_cards?: number;
    unique_cards?: number;
    source?: string;
  };
  collection?: Array<Record<string, unknown>>;
}
import { ApiClient } from '../../lib/api';
import { useAuthStore } from '@/store/authStore';

export default function ApiTestPage() {
  const [apiStatus, setApiStatus] = useState<string>('Testing...');
  const [sampleCollection, setSampleCollection] = useState<SampleCollection | null>(null);
  const [loading, setLoading] = useState(false);
  
  const { user, token, login, register, logout, isAuthenticated, error } = useAuthStore();
  
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ 
    email: '', 
    password: '', 
    full_name: ''  // This matches the User interface
  });

  useEffect(() => {
    testApiConnection();
  }, []);

  const testApiConnection = async () => {
    try {
      console.log('Testing API connection to:', process.env.NEXT_PUBLIC_API_URL);
      const apiClient = new ApiClient();
      const healthCheck = await apiClient.healthCheck() as { status: string; service: string };
      console.log('Health check response:', healthCheck);
      setApiStatus(`✅ API Connected: ${healthCheck.status} - ${healthCheck.service}`);
    } catch (error) {
      console.error('API connection error:', error);
      setApiStatus(`❌ API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const loadSampleCollection = async () => {
    setLoading(true);
    try {
      const apiClient = new ApiClient(token || undefined);
      const collection = await apiClient.loadSampleCollection();
      if (collection && typeof collection === 'object') {
        setSampleCollection(collection as SampleCollection);
      } else {
        setSampleCollection(null);
      }
    } catch (error) {
      console.error('Failed to load sample collection:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(loginForm);
      setLoginForm({ email: '', password: '' });
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(registerForm);  // This should now work correctly
      setRegisterForm({ email: '', password: '', full_name: '' });
    } catch (error) {
      console.error('Registration failed:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="sleeve-morphism rounded-xl p-8 mb-8 border border-gray-700">
        <h1 className="text-6xl font-mtg font-bold text-mtg-white mb-4 drop-shadow-lg">
          MTG Collection Optimizer
        </h1>
        <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8 font-mtg-body">
          Manage your Magic: The Gathering collection with advanced filtering, 
          real-time pricing, and powerful deck building tools
        </p>
      </div>
      
      <h1 className="text-3xl font-bold">MTG Deck Optimizer - API Test</h1>
      
      {/* API Status */}
      <div className="bg-black p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">API Status</h2>
        <p className="text-sm text-gray-600 mb-2">
          API URL: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}
        </p>
        <p>{apiStatus}</p>
        <button 
          onClick={testApiConnection}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Test Connection
        </button>
      </div>

      {/* Authentication Section */}
      <div className="bg-black p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Authentication</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {isAuthenticated ? (
          <div>
            <p className="text-green-600 font-semibold">✅ Authenticated as: {user?.email}</p>
            <p>User ID: {user?.id}</p>
            <p>Full Name: {user?.full_name || 'Not provided'}</p>
            <button 
              onClick={logout}
              className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-3">
              <h3 className="font-semibold">Login</h3>
              <input
                type="email"
                placeholder="Email"
                value={loginForm.email}
                onChange={(e) => setLoginForm(prev => ({...prev, email: e.target.value}))}
                className="w-full p-2 border rounded"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={loginForm.password}
                onChange={(e) => setLoginForm(prev => ({...prev, password: e.target.value}))}
                className="w-full p-2 border rounded"
                required
              />
              <button 
                type="submit"
                className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Login
              </button>
            </form>

            {/* Register Form */}
            <form onSubmit={handleRegister} className="space-y-3">
              <h3 className="font-semibold">Register</h3>
              <input
                type="email"
                placeholder="Email"
                value={registerForm.email}
                onChange={(e) => setRegisterForm(prev => ({...prev, email: e.target.value}))}
                className="w-full p-2 border rounded"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={registerForm.password}
                onChange={(e) => setRegisterForm(prev => ({...prev, password: e.target.value}))}
                className="w-full p-2 border rounded"
                required
              />
              <input
                type="text"
                placeholder="Full Name"
                value={registerForm.full_name}
                onChange={(e) => setRegisterForm(prev => ({...prev, full_name: e.target.value}))}
                className="w-full p-2 border rounded"
              />
              <button 
                type="submit"
                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Register
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Sample Collection Test */}
      <div className="bg-black p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Sample Collection</h2>
        <button 
          onClick={loadSampleCollection}
          disabled={loading}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Load Sample Collection'}
        </button>
        
        {sampleCollection && (
          <div className="mt-4">
            <h3 className="font-semibold">Collection Stats:</h3>
            <p>Total Cards: {sampleCollection.stats?.total_cards ?? 'N/A'}</p>
            <p>Unique Cards: {sampleCollection.stats?.unique_cards ?? 'N/A'}</p>
            <p>Source: {sampleCollection.stats?.source ?? 'N/A'}</p>
            {Array.isArray(sampleCollection.collection) && sampleCollection.collection.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold">First 5 Cards:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                  {sampleCollection.collection.slice(0, 5).map((card, index) => {
                    const name = typeof card === 'object' && card && 'name' in card ? (card as { name?: string }).name : '';
                    const setName = typeof card === 'object' && card && ('set_name' in card || 'Set' in card)
                      ? ((card as { set_name?: string; Set?: string }).set_name || (card as { Set?: string }).Set)
                      : '';
                    const qty = typeof card === 'object' && card && 'Quantity' in card ? (card as { Quantity?: number }).Quantity : 1;
                    return (
                      <div key={index} className="bg-black p-3 rounded border">
                        <p className="font-semibold">{name}</p>
                        <p className="text-sm text-gray-600">Set: {setName}</p>
                        <p className="text-sm text-gray-600">Qty: {qty}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
