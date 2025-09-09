import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import SignIn from './SignIn';
import CreateAccount from './CreateAccount';
import Dashboard from './Dashboard';
import Welcome from './Welcome';

interface ProfileProps {
  onBack?: () => void;
}

type ProfileView = 'signin' | 'create-account' | 'welcome' | 'dashboard';

const Profile: React.FC<ProfileProps> = ({ onBack }) => {
  const { authState, login, logout, updateUserRoles, isLoading } = useAuth();
  const [currentView, setCurrentView] = useState<ProfileView>('signin');
  const [userRoles, setUserRoles] = useState<Record<string, any>>({});
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);

  // Debug logging
  console.log('Profile render - authState:', authState);
  console.log('Profile render - userRoles:', userRoles);

  // Load user data when authenticated
  useEffect(() => {
    const loadUserData = async () => {
      if (authState.isAuthenticated && authState.sessionToken) {
        console.log('Loading user data with session token:', authState.sessionToken);
        setIsLoadingUserData(true);
        
        try {
          // Get detailed user profile using session token
          const response = await fetch('http://localhost:8100/users/me', {
            headers: { 
              'Authorization': authState.sessionToken
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            console.log('User profile loaded:', userData);
            
            // Organize user data by roles
            const roles: Record<string, any> = {};
            
            // Create unified user object for all roles
            const baseUserData = {
              id: userData.id,
              name: userData.name,
              email: userData.email,
              stellar_address: userData.stellar_address,
              created_at: userData.created_at,
              session_token: authState.sessionToken
            };
            
            // Check if user has supplier role
            if (userData.roles.includes('supplier')) {
              roles.supplier = {
                ...baseUserData,
                balance: userData.supplier_stats?.balance || 0,
                package_count: userData.supplier_stats?.package_count || 0,
                type: 'supplier'
              };
            }
            
            // Check if user has reviewer role  
            if (userData.roles.includes('reviewer')) {
              roles.reviewer = {
                ...baseUserData,
                balance: userData.reviewer_stats?.balance || 0,
                reputation_level: userData.reviewer_stats?.reputation_level || 'novice',
                stats: userData.reviewer_stats || {},
                type: 'reviewer'
              };
            }

            // Check if user has buyer role (everyone should have this)
            if (userData.roles.includes('buyer')) {
              roles.buyer = {
                ...baseUserData,
                type: 'buyer'
              };
            }
            
            console.log('Organized user roles:', roles);
            setUserRoles(roles);
            updateUserRoles(roles);
            
            // Show welcome screen for first-time sign in, or dashboard if returning
            setCurrentView('welcome');
            
          } else {
            console.error('Failed to load user profile:', response.status);
            throw new Error('Failed to load user profile');
          }
          
        } catch (error) {
          console.error('Failed to load user data:', error);
          // If session is invalid, logout
          handleLogout();
        } finally {
          setIsLoadingUserData(false);
        }
      }
    };

    loadUserData();
  }, [authState.isAuthenticated, authState.sessionToken, updateUserRoles]);

  // Handle successful account creation
  const handleAccountCreated = (authData: { sessionToken: string; user: any }) => {
    console.log('Account created with session data:', authData);
    login(authData);
  };

  // Handle successful username/password sign in
  const handleSignInSuccess = (authData: { sessionToken: string; user: any }) => {
    console.log('Session login successful:', authData);
    login(authData);
  };

  // Navigate to dashboard role
  const handleNavigateToRole = (role: 'buying' | 'supplying' | 'reviewing') => {
    console.log('Navigating to role:', role);
    setCurrentView('dashboard');
  };

  // Handle logout
  const handleLogout = async () => {
    console.log('Logging out...');
    
    // Call logout endpoint if we have a session token
    if (authState.sessionToken) {
      try {
        await fetch('http://localhost:8100/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': authState.sessionToken
          }
        });
      } catch (error) {
        console.warn('Logout request failed:', error);
      }
    }
    
    logout();
    setUserRoles({});
    setCurrentView('signin');
  };

  // Loading state
  if (isLoading || isLoadingUserData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {isLoading ? 'Loading...' : 'Loading your dashboard...'}
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated - show auth flows
  if (!authState.isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto px-4 py-12">
          {/* Header */}
          <div className="text-center mb-8">
            {onBack && (
              <button
                onClick={onBack}
                className="absolute top-6 left-6 text-gray-600 hover:text-gray-900 text-sm"
              >
                ← Back to Catalog
              </button>
            )}
            <h1 className="text-3xl font-bold text-gray-900 mb-2">SquidPro</h1>
            <p className="text-gray-600">Quality-verified data marketplace</p>
          </div>

          {/* Auth Content */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            {currentView === 'signin' && (
              <>
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign In</h2>
                  <p className="text-sm text-gray-600">Access your SquidPro account</p>
                </div>
                <SignIn 
                  onSignInSuccess={handleSignInSuccess}
                  onSwitchToCreateAccount={() => setCurrentView('create-account')}
                />
              </>
            )}

            {currentView === 'create-account' && (
              <>
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Create Account</h2>
                  <p className="text-sm text-gray-600">Join the SquidPro marketplace</p>
                </div>
                <CreateAccount 
                  onAccountCreated={handleAccountCreated}
                  onSwitchToSignIn={() => setCurrentView('signin')}
                />
              </>
            )}
          </div>

          {/* Information Section */}
          <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">How It Works</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-0.5">1</div>
                <div>
                  <strong>Create Account:</strong> Choose your username, password, and roles (supplier, reviewer, or buyer)
                </div>
              </div>
              <div className="flex items-start">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-0.5">2</div>
                <div>
                  <strong>Sign In:</strong> Use your username and password to access your personalized dashboard
                </div>
              </div>
              <div className="flex items-start">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-0.5">3</div>
                <div>
                  <strong>Get Started:</strong> Browse data, upload datasets, or review quality based on your roles
                </div>
              </div>
            </div>
          </div>

          {/* Debug Info for Development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">Debug Info</h4>
              <div className="text-xs text-yellow-700 space-y-1">
                <p><strong>Current View:</strong> {currentView}</p>
                <p><strong>Is Authenticated:</strong> {authState.isAuthenticated.toString()}</p>
                <p><strong>Session Token:</strong> {authState.sessionToken ? 'Present' : 'None'}</p>
                <p><strong>User Roles:</strong> {Object.keys(userRoles).join(', ') || 'None'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Authenticated - show appropriate view
  return (
    <div className="min-h-screen bg-gray-50">
      {currentView === 'welcome' && (
        <Welcome 
          userRoles={userRoles}
          onNavigateToRole={handleNavigateToRole}
          onLogout={handleLogout}
        />
      )}

      {currentView === 'dashboard' && (
        <Dashboard 
          userRoles={userRoles}
          apiKeys={{ session: authState.sessionToken || '' }}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
};

export default Profile;