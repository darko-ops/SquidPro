import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User, DollarSign, Package, Star, LogOut, Loader } from 'lucide-react';

interface AuthState {
  isAuthenticated: boolean;
  apiKey: string;
  userType: 'supplier' | 'reviewer' | null;
  userData: any;
}

interface ProfileProps {
  onBack: () => void;
}

const Profile: React.FC<ProfileProps> = ({ onBack }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    apiKey: '',
    userType: null,
    userData: null
  });
  const [loginForm, setLoginForm] = useState({
    apiKey: '',
    isLoading: false,
    error: ''
  });

  // Fetch user data when authenticated
  const { data: userData, refetch } = useQuery({
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginForm(prev => ({ ...prev, isLoading: true, error: '' }));

    try {
      // Try supplier first
      let response = await fetch('http://localhost:8100/suppliers/me', {
        headers: { 'X-API-Key': loginForm.apiKey }
      });

      let userType: 'supplier' | 'reviewer' = 'supplier';
      
      if (!response.ok) {
        // Try reviewer
        response = await fetch('http://localhost:8100/reviewers/me', {
          headers: { 'X-API-Key': loginForm.apiKey }
        });
        userType = 'reviewer';
      }

      if (!response.ok) {
        throw new Error('Invalid API key');
      }

      const userData = await response.json();
      
      setAuthState({
        isAuthenticated: true,
        apiKey: loginForm.apiKey,
        userType,
        userData
      });
      
      setLoginForm(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      setLoginForm(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Invalid API key. Please check your credentials.' 
      }));
    }
  };

  const handleLogout = () => {
    setAuthState({
      isAuthenticated: false,
      apiKey: '',
      userType: null,
      userData: null
    });
    setLoginForm({ apiKey: '', isLoading: false, error: '' });
  };

  const SupplierDashboard = ({ user }: { user: any }) => (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Current Balance</p>
              <p className="text-2xl font-bold text-gray-900">${(user.balance || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Data Packages</p>
              <p className="text-2xl font-bold text-gray-900">{user.package_count || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <User className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Account Status</p>
              <p className="text-2xl font-bold text-gray-900">{user.status || 'Active'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Account Details */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600">Name</label>
            <p className="text-gray-900">{user.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Email</label>
            <p className="text-gray-900">{user.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Stellar Address</label>
            <p className="text-gray-900 font-mono text-sm">{user.stellar_address}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Member Since</label>
            <p className="text-gray-900">{new Date(user.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="space-y-3">
          <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
            Upload New Dataset
          </button>
          <button className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors">
            View Analytics
          </button>
          <button className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors">
            Request Payout
          </button>
        </div>
      </div>
    </div>
  );

  const ReviewerDashboard = ({ user }: { user: any }) => (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Current Balance</p>
              <p className="text-2xl font-bold text-gray-900">${(user.balance || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <Star className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Reviews Completed</p>
              <p className="text-2xl font-bold text-gray-900">{user.stats?.total_reviews || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <User className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Consensus Rate</p>
              <p className="text-2xl font-bold text-gray-900">{((user.stats?.consensus_rate || 0) * 100).toFixed(0)}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <Star className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Reputation</p>
              <p className="text-2xl font-bold text-gray-900 capitalize">{user.reputation_level || 'Novice'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Account Details */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600">Name</label>
            <p className="text-gray-900">{user.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Email</label>
            <p className="text-gray-900">{user.email || 'Not provided'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Specializations</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {user.specializations?.map((spec: string) => (
                <span key={spec} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                  {spec}
                </span>
              )) || <span className="text-gray-500">None specified</span>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Stellar Address</label>
            <p className="text-gray-900 font-mono text-sm">{user.stellar_address}</p>
          </div>
        </div>
      </div>

      {/* Available Tasks */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Review Tasks</h3>
        <div className="text-center py-8 text-gray-500">
          <Star className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No review tasks available at the moment.</p>
          <p className="text-sm">Check back later for new opportunities!</p>
        </div>
      </div>
    </div>
  );

  if (!authState.isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center gap-6">
                <button onClick={onBack} className="text-2xl font-bold text-gray-900">SquidPro</button>
                <nav className="flex gap-6">
                  <button onClick={onBack} className="text-gray-600 hover:text-gray-900">Catalog</button>
                  <span className="text-blue-600 font-medium">Profile</span>
                </nav>
              </div>
            </div>
          </div>
        </header>

        {/* Auth Form */}
        <main className="py-12">
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-lg border border-gray-200 p-8">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Your Account</h1>
                <p className="text-gray-600">Sign in to manage your SquidPro business</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API Key / Token
                  </label>
                  <input
                    type="password"
                    value={loginForm.apiKey}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="Enter your API key (sup_... or rev_...)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Enter your supplier API key (sup_...) or reviewer key (rev_...)
                  </p>
                </div>

                {loginForm.error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                    {loginForm.error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loginForm.isLoading}
                  className="w-full bg-gray-900 text-white py-2 px-4 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loginForm.isLoading ? (
                    <>
                      <Loader className="animate-spin h-4 w-4 mr-2" />
                      Signing in...
                    </>
                  ) : (
                    'Access Dashboard'
                  )}
                </button>
              </form>

              <div className="mt-8 text-center">
                <p className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <a href="http://localhost:8100/static/demo.html" className="text-blue-600 hover:text-blue-700">
                    Register here
                  </a>
                </p>
                <button
                  onClick={onBack}
                  className="mt-4 text-gray-600 hover:text-gray-900 text-sm"
                >
                  ← Back to Catalog
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-6">
              <button onClick={onBack} className="text-2xl font-bold text-gray-900">SquidPro</button>
              <nav className="flex gap-6">
                <button onClick={onBack} className="text-gray-600 hover:text-gray-900">Catalog</button>
                <span className="text-blue-600 font-medium">Profile</span>
              </nav>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Dashboard */}
      <main className="py-8">
        <div className="max-w-6xl mx-auto px-4">
          {/* User Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">{userData?.name || authState.userData?.name}</h1>
            <p className="text-gray-600 capitalize">{authState.userType} Account</p>
          </div>

          {/* Dashboard Content */}
          {userData ? (
            authState.userType === 'supplier' ? (
              <SupplierDashboard user={userData} />
            ) : (
              <ReviewerDashboard user={userData} />
            )
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader className="animate-spin h-8 w-8 text-gray-400" />
              <span className="ml-2 text-gray-600">Loading your dashboard...</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Profile;