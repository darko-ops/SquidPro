import React, { useState } from 'react';
import { 
  User, 
  Lock,
  Loader,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';

interface SignInProps {
  onSignInSuccess: (authData: { sessionToken: string; user: any }) => void;
  onSwitchToCreateAccount: () => void;
}

const SignIn: React.FC<SignInProps> = ({ onSignInSuccess, onSwitchToCreateAccount }) => {
  const [form, setForm] = useState({
    username: '',
    password: '',
    isLoading: false,
    error: '',
    showPassword: false
  });

  const handleUsernamePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.username || !form.password) {
      setForm(prev => ({ ...prev, error: 'Please enter both username and password' }));
      return;
    }

    setForm(prev => ({ ...prev, isLoading: true, error: '' }));

    try {
      console.log('Attempting username/password sign in...');
      
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
      
      if (response.ok) {
        const data = await response.json();
        console.log('Sign in successful:', data);
        
        // Call the success handler with session data
        onSignInSuccess({
          sessionToken: data.session_token,
          user: data.user
        });
        
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Invalid username or password');
      }
      
    } catch (error) {
      console.error('Sign in failed:', error);
      setForm(prev => ({ 
        ...prev, 
        error: (error as Error).message 
      }));
    } finally {
      setForm(prev => ({ ...prev, isLoading: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Username/Password Sign In */}
      <form onSubmit={handleUsernamePasswordSignIn} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <User className="w-4 h-4 inline mr-2" />
            Username
          </label>
          <input
            type="text"
            value={form.username}
            onChange={(e) => setForm(prev => ({ ...prev, username: e.target.value }))}
            placeholder="Enter your username"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
            autoComplete="username"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Lock className="w-4 h-4 inline mr-2" />
            Password
          </label>
          <div className="relative">
            <input
              type={form.showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
              placeholder="Enter your password"
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, showPassword: !prev.showPassword }))}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              {form.showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {form.error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm flex items-start">
            <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
            {form.error}
          </div>
        )}

        <button
          type="submit"
          disabled={form.isLoading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center"
        >
          {form.isLoading ? (
            <>
              <Loader className="animate-spin h-4 w-4 mr-2" />
              Signing in...
            </>
          ) : (
            <>
              <User className="h-4 w-4 mr-2" />
              Sign In
            </>
          )}
        </button>
      </form>

      {/* Create Account Link */}
      <div className="text-center">
        <p className="text-sm text-gray-600">
          Don't have an account?{' '}
          <button
            onClick={onSwitchToCreateAccount}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Create one here
          </button>
        </p>
      </div>

      {/* Help Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
        <h4 className="font-medium text-gray-900 mb-2">Sign In Help</h4>
        <div className="text-sm text-gray-600 space-y-1">
          <p>• Use the username and password you created during registration</p>
          <p>• Your account can have multiple roles (supplier, reviewer, buyer)</p>
          <p>• After signing in, you'll access your unified dashboard</p>
        </div>
      </div>

      {/* Demo Accounts Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="font-medium text-blue-900 mb-2">New to SquidPro?</h4>
        <p className="text-sm text-blue-700 mb-3">
          Create a new account above to get started. You can choose multiple roles:
        </p>
        <div className="space-y-1 text-sm text-blue-700">
          <div className="flex items-center">
            <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
            <strong>Buyer:</strong> Purchase data for your AI agents
          </div>
          <div className="flex items-center">
            <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
            <strong>Supplier:</strong> Upload and sell your datasets
          </div>
          <div className="flex items-center">
            <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
            <strong>Reviewer:</strong> Review data quality and earn rewards
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;