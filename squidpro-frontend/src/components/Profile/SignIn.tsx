import React, { useState } from 'react';
import { Key, Loader } from 'lucide-react';

interface SignInProps {
  onSignIn: (apiKeys: Record<string, string>) => void;
  onSwitchToRegister: () => void;
}

const SignIn: React.FC<SignInProps> = ({ onSignIn, onSwitchToRegister }) => {
  const [loginMethod, setLoginMethod] = useState<'credentials' | 'apikey'>('credentials');
  const [form, setForm] = useState({
    username: '',
    password: '',
    apiKey: '',
    isLoading: false,
    error: ''
  });

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setForm(prev => ({ ...prev, isLoading: true, error: '' }));

    try {
      // For now, since the backend endpoint doesn't exist yet, let's simulate the login
      // TODO: Replace this with actual API call when backend is ready
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For demo purposes, return mock API keys
      // In real implementation, this would come from the backend
      const mockApiKeys = {
        supplier: `sup_${Math.random().toString(36).substr(2, 20)}`,
        reviewer: `rev_${Math.random().toString(36).substr(2, 20)}`
      };
      
      // TODO: Uncomment when backend is ready
      /*
      const response = await fetch('http://localhost:8100/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: form.username,
          password: form.password
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Invalid credentials');
      }

      const data = await response.json();
      onSignIn(data.api_keys || {});
      */
      
      // For now, use mock data
      onSignIn(mockApiKeys);
      
    } catch (error) {
      setForm(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: (error as Error).message
      }));
    }
  };

  const handleApiKeyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setForm(prev => ({ ...prev, isLoading: true, error: '' }));

    try {
      // Try supplier first
      let response = await fetch('http://localhost:8100/suppliers/me', {
        headers: { 'X-API-Key': form.apiKey }
      });

      let apiKeys: Record<string, string> = {};
      
      if (response.ok) {
        apiKeys.supplier = form.apiKey;
      } else {
        // Try reviewer
        response = await fetch('http://localhost:8100/reviewers/me', {
          headers: { 'X-API-Key': form.apiKey }
        });
        
        if (response.ok) {
          apiKeys.reviewer = form.apiKey;
        } else {
          throw new Error('Invalid API key');
        }
      }

      onSignIn(apiKeys);
      
    } catch (error) {
      setForm(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Invalid API key. Please check your credentials.' 
      }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome Back</h3>
        <p className="text-sm text-gray-600">Sign in to your SquidPro account</p>
      </div>

      {/* Login Method Toggle */}
      <div className="flex bg-gray-100 rounded-lg p-1">
        <button
          type="button"
          onClick={() => setLoginMethod('credentials')}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
            loginMethod === 'credentials'
              ? 'bg-white text-gray-900 shadow'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Username & Password
        </button>
        <button
          type="button"
          onClick={() => setLoginMethod('apikey')}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
            loginMethod === 'apikey'
              ? 'bg-white text-gray-900 shadow'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          API Key
        </button>
      </div>

      {/* Credentials Login Form */}
      {loginMethod === 'credentials' && (
        <div className="space-y-4">
          <form onSubmit={handleCredentialsLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm(prev => ({ ...prev, username: e.target.value }))}
                placeholder="Enter your username"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Enter your password"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {form.error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {form.error}
              </div>
            )}

            <button
              type="submit"
              disabled={form.isLoading}
              className="w-full bg-gray-900 text-white py-2 px-4 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {form.isLoading ? (
                <>
                  <Loader className="animate-spin h-4 w-4 mr-2" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      )}

      {/* API Key Login Form */}
      {loginMethod === 'apikey' && (
        <div className="space-y-4">
          <form onSubmit={handleApiKeyLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key
              </label>
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="sup_... or rev_..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Use your supplier (sup_...) or reviewer (rev_...) API key
              </p>
            </div>

            {form.error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {form.error}
              </div>
            )}

            <button
              type="submit"
              disabled={form.isLoading}
              className="w-full bg-gray-900 text-white py-2 px-4 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {form.isLoading ? (
                <>
                  <Loader className="animate-spin h-4 w-4 mr-2" />
                  Signing in...
                </>
              ) : (
                <>
                  <Key className="h-4 w-4 mr-2" />
                  Sign In with API Key
                </>
              )}
            </button>
          </form>
        </div>
      )}

      <div className="text-center">
        <p className="text-sm text-gray-600">
          Don't have an account?{' '}
          <button
            onClick={onSwitchToRegister}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Create one here
          </button>
        </p>
      </div>
    </div>
  );
};

export default SignIn;