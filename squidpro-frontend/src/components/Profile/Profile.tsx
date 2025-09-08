import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import SignIn from './SignIn';
import CreateAccount from './CreateAccount';
import Dashboard from './Dashboard';

interface ProfileProps {
  onBack: () => void;
}

type ViewMode = 'signin' | 'register';

const Profile: React.FC<ProfileProps> = ({ onBack }) => {
  const { authState, login, logout, updateUserRoles, isLoading: authLoading } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('signin');
  
  // Use ref to track last updated user roles to prevent infinite loops
  const lastUserRolesRef = useRef<string>('');

  // Debug logging
  useEffect(() => {
    console.log('Profile - Auth state updated:', authState);
  }, [authState]);

  // Fetch user data for all roles when authenticated
  const { data: userData, isLoading, error, refetch } = useQuery({
    queryKey: ['unified-user-profile', authState.apiKeys],
    queryFn: async () => {
      console.log('🔍 FETCH DEBUG - Starting fetch with API keys:', authState.apiKeys);
      
      if (!authState.isAuthenticated || Object.keys(authState.apiKeys).length === 0) {
        console.log('❌ FETCH DEBUG - Not authenticated or no API keys, skipping fetch');
        return null;
      }

      const userRoles: Record<string, any> = {};
      const fetchResults: Record<string, any> = {};

      // Fetch supplier data if supplier API key exists
      if (authState.apiKeys.supplier) {
        try {
          console.log('🏪 FETCH DEBUG - Attempting to fetch supplier data with key:', authState.apiKeys.supplier.substring(0, 10) + '...');
          const response = await fetch('http://localhost:8100/suppliers/me', {
            headers: { 'X-API-Key': authState.apiKeys.supplier }
          });
          
          console.log('🏪 FETCH DEBUG - Supplier response status:', response.status);
          
          if (response.ok) {
            const supplierData = await response.json();
            console.log('✅ FETCH DEBUG - Supplier data fetched successfully:', supplierData);
            userRoles.supplier = supplierData;
            fetchResults.supplier = { success: true, data: supplierData };
          } else {
            const errorText = await response.text();
            console.error('❌ FETCH DEBUG - Supplier fetch failed:', response.status, response.statusText, errorText);
            fetchResults.supplier = { success: false, status: response.status, error: errorText };
          }
        } catch (error) {
          console.error('💥 FETCH DEBUG - Supplier fetch exception:', error);
          fetchResults.supplier = { success: false, error: (error as Error).message };
        }
      } else {
        console.log('⏭️ FETCH DEBUG - No supplier API key found');
      }

      // Fetch reviewer data if reviewer API key exists
      if (authState.apiKeys.reviewer) {
        try {
          console.log('⭐ FETCH DEBUG - Attempting to fetch reviewer data with key:', authState.apiKeys.reviewer.substring(0, 10) + '...');
          const response = await fetch('http://localhost:8100/reviewers/me', {
            headers: { 'X-API-Key': authState.apiKeys.reviewer }
          });
          
          console.log('⭐ FETCH DEBUG - Reviewer response status:', response.status);
          
          if (response.ok) {
            const reviewerData = await response.json();
            console.log('✅ FETCH DEBUG - Reviewer data fetched successfully:', reviewerData);
            userRoles.reviewer = reviewerData;
            fetchResults.reviewer = { success: true, data: reviewerData };
          } else {
            const errorText = await response.text();
            console.error('❌ FETCH DEBUG - Reviewer fetch failed:', response.status, response.statusText, errorText);
            fetchResults.reviewer = { success: false, status: response.status, error: errorText };
          }
        } catch (error) {
          console.error('💥 FETCH DEBUG - Reviewer fetch exception:', error);
          fetchResults.reviewer = { success: false, error: (error as Error).message };
        }
      } else {
        console.log('⏭️ FETCH DEBUG - No reviewer API key found');
      }

      console.log('📊 FETCH DEBUG - Final fetch results:', fetchResults);
      console.log('👤 FETCH DEBUG - Final user roles:', userRoles);
      
      // Store fetch results for debugging
      (window as any).debugFetchResults = fetchResults;
      
      return userRoles;
    },
    enabled: authState.isAuthenticated && Object.keys(authState.apiKeys).length > 0,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Update user roles in auth context when data is fetched
  // But only if the data actually changed to prevent infinite loops
  useEffect(() => {
    if (userData) {
      const userDataString = JSON.stringify(userData);
      
      // Only update if the data actually changed
      if (userDataString !== lastUserRolesRef.current) {
        console.log('🔄 CONTEXT UPDATE - User roles changed, updating context:', userData);
        lastUserRolesRef.current = userDataString;
        updateUserRoles(userData);
      } else {
        console.log('⏭️ CONTEXT UPDATE - User roles unchanged, skipping update');
      }
    }
  }, [userData]); // Remove updateUserRoles from dependencies to prevent infinite loop

  const handleSignIn = (apiKeys: Record<string, string>) => {
    console.log('Handling sign in with API keys:', apiKeys);
    // Reset the ref when logging in
    lastUserRolesRef.current = '';
    login(apiKeys);
  };

  const handleAccountCreated = (apiKeys: Record<string, string> | string, userType?: 'supplier' | 'reviewer') => {
    console.log('Handling account created:', apiKeys, userType);
    
    let finalApiKeys: Record<string, string>;
    
    if (typeof apiKeys === 'string') {
      // Single API key
      finalApiKeys = userType ? { [userType]: apiKeys } : { supplier: apiKeys };
    } else {
      // Multiple API keys
      finalApiKeys = apiKeys;
    }
    
    console.log('Final API keys for new account:', finalApiKeys);
    // Reset the ref when creating account
    lastUserRolesRef.current = '';
    login(finalApiKeys);
  };

  const handleLogout = () => {
    console.log('Logging out');
    // Reset the ref when logging out
    lastUserRolesRef.current = '';
    logout();
    setViewMode('signin');
  };

  const handleSwitchToRegister = () => {
    setViewMode('register');
  };

  const handleSwitchToSignIn = () => {
    setViewMode('signin');
  };

  // Debug error logging
  useEffect(() => {
    if (error) {
      console.error('❌ QUERY ERROR:', error);
    }
  }, [error]);

  // Show loading while auth context is initializing
  if (authLoading) {
    return (
      <div className="py-12">
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
              <span className="text-gray-600">Initializing...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If authenticated, show unified dashboard
  if (authState.isAuthenticated) {
    console.log('🎯 RENDER DEBUG - Rendering dashboard:', {
      isLoading,
      userData,
      authStateUserRoles: authState.userRoles,
      error
    });
    
    if (isLoading) {
      return (
        <div className="py-12">
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-lg border border-gray-200 p-8">
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                <div className="text-center">
                  <span className="text-gray-600 block">Loading your dashboard...</span>
                  <span className="text-xs text-gray-500 mt-2 block">
                    API Keys: {Object.keys(authState.apiKeys).join(', ')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="py-12">
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-lg border border-gray-200 p-8">
              <div className="text-center py-12">
                <div className="text-red-600 mb-4">
                  <p className="font-medium">Failed to load dashboard</p>
                  <p className="text-sm">{(error as Error).message}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-4 text-left">
                  <p className="text-xs text-gray-600 mb-2"><strong>Debug Info:</strong></p>
                  <p className="text-xs text-gray-600">API Keys: {Object.keys(authState.apiKeys).join(', ')}</p>
                  <p className="text-xs text-gray-600">
                    Check browser console for detailed fetch results
                  </p>
                </div>
                <div className="space-y-3">
                  <button
                    onClick={() => refetch()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 mr-3"
                  >
                    Retry
                  </button>
                  <button
                    onClick={handleLogout}
                    className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <Dashboard 
        userRoles={userData || authState.userRoles}
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