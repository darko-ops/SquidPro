import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import SignIn from './SignIn';
import CreateAccount from './CreateAccount';
import Dashboard from './Dashboard';

interface AuthState {
  isAuthenticated: boolean;
  apiKeys: Record<string, string>;
  userRoles: Record<string, any>;
}

interface ProfileProps {
  onBack: () => void;
}

type ViewMode = 'signin' | 'register';

const Profile: React.FC<ProfileProps> = ({ onBack }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    apiKeys: {},
    userRoles: {}
  });
  
  const [viewMode, setViewMode] = useState<ViewMode>('signin');

  // Fetch user data for all roles when authenticated
  const { data: userData, isLoading } = useQuery({
    queryKey: ['unified-user-profile', authState.apiKeys],
    queryFn: async () => {
      if (!authState.isAuthenticated || Object.keys(authState.apiKeys).length === 0) {
        return null;
      }

      const userRoles: Record<string, any> = {};

      // Fetch supplier data if supplier API key exists
      if (authState.apiKeys.supplier) {
        try {
          const response = await fetch('http://localhost:8100/suppliers/me', {
            headers: { 'X-API-Key': authState.apiKeys.supplier }
          });
          if (response.ok) {
            userRoles.supplier = await response.json();
          }
        } catch (error) {
          console.error('Failed to fetch supplier data:', error);
        }
      }

      // Fetch reviewer data if reviewer API key exists
      if (authState.apiKeys.reviewer) {
        try {
          const response = await fetch('http://localhost:8100/reviewers/me', {
            headers: { 'X-API-Key': authState.apiKeys.reviewer }
          });
          if (response.ok) {
            userRoles.reviewer = await response.json();
          }
        } catch (error) {
          console.error('Failed to fetch reviewer data:', error);
        }
      }

      return userRoles;
    },
    enabled: authState.isAuthenticated && Object.keys(authState.apiKeys).length > 0,
  });

  const handleSignIn = (apiKeys: Record<string, string>) => {
    setAuthState({
      isAuthenticated: true,
      apiKeys,
      userRoles: {}
    });
  };

  const handleAccountCreated = (apiKeys: Record<string, string>) => {
    setAuthState({
      isAuthenticated: true,
      apiKeys,
      userRoles: {}
    });
  };

  const handleLogout = () => {
    setAuthState({
      isAuthenticated: false,
      apiKeys: {},
      userRoles: {}
    });
    setViewMode('signin');
  };

  const handleSwitchToRegister = () => {
    setViewMode('register');
  };

  const handleSwitchToSignIn = () => {
    setViewMode('signin');
  };

  // If authenticated, show unified dashboard
  if (authState.isAuthenticated) {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
          <span className="text-gray-600">Loading your dashboard...</span>
        </div>
      );
    }

    return (
      <Dashboard 
        userRoles={userData || {}}
        apiKeys={authState.apiKeys}
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