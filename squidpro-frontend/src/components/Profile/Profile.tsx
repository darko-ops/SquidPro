import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import SignIn from './SignIn';
import CreateAccount from './CreateAccount';
import Dashboard from './Dashboard';

interface AuthState {
  isAuthenticated: boolean;
  apiKey: string;
  userType: 'supplier' | 'reviewer' | null;
}

interface ProfileProps {
  onBack: () => void;
}

type ViewMode = 'signin' | 'register';

const Profile: React.FC<ProfileProps> = ({ onBack }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    apiKey: '',
    userType: null
  });
  
  const [viewMode, setViewMode] = useState<ViewMode>('signin');

  // Fetch user data when authenticated
  const { data: userData } = useQuery({
    queryKey: ['user-profile', authState.apiKey, authState.userType],
    queryFn: async () => {
      if (!authState.apiKey || !authState.userType) return null;
      
      const endpoint = authState.userType === 'supplier' ? '/suppliers/me' : '/reviewers/me';
      const response = await fetch(`http://localhost:8100${endpoint}`, {
        headers: {
          'X-API-Key': authState.apiKey
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }
      
      return response.json();
    },
    enabled: authState.isAuthenticated && !!authState.apiKey && !!authState.userType,
  });

  const handleSignIn = (apiKey: string, userType: 'supplier' | 'reviewer') => {
    setAuthState({
      isAuthenticated: true,
      apiKey,
      userType
    });
  };

  const handleAccountCreated = (apiKey: string, userType: 'supplier' | 'reviewer') => {
    setAuthState({
      isAuthenticated: true,
      apiKey,
      userType
    });
  };

  const handleLogout = () => {
    setAuthState({
      isAuthenticated: false,
      apiKey: '',
      userType: null
    });
    setViewMode('signin');
  };

  const handleSwitchToRegister = () => {
    setViewMode('register');
  };

  const handleSwitchToSignIn = () => {
    setViewMode('signin');
  };

  // If authenticated, show dashboard
  if (authState.isAuthenticated && authState.userType) {
    return (
      <Dashboard 
        userData={userData}
        userType={authState.userType}
        onLogout={handleLogout}
      />
    );
  }

  // If not authenticated, show auth forms
  return (
    <div className="py-12">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">SquidPro Account</h1>
            <p className="text-gray-600">
              {viewMode === 'signin' 
                ? 'Sign in to your account' 
                : 'Create your account and start earning'
              }
            </p>
          </div>

          {/* Auth Mode Toggle */}
          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button
              onClick={handleSwitchToSignIn}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'signin'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={handleSwitchToRegister}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'register'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Render appropriate component */}
          {viewMode === 'signin' ? (
            <SignIn 
              onSignIn={handleSignIn}
              onSwitchToRegister={handleSwitchToRegister}
            />
          ) : (
            <CreateAccount 
              onAccountCreated={handleAccountCreated}
              onSwitchToSignIn={handleSwitchToSignIn}
            />
          )}

          <div className="mt-8 text-center">
            <button
              onClick={onBack}
              className="text-gray-600 hover:text-gray-900 text-sm"
            >
              ← Back to Catalog
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;