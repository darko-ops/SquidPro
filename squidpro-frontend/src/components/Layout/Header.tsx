import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { User, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';

interface HeaderProps {
  currentRoute: 'catalog' | 'profile';
  navigate: (route: 'catalog' | 'profile') => void;
}

const Header: React.FC<HeaderProps> = ({ currentRoute, navigate }) => {
  const { authState, logout } = useAuth();

  // Check API health
  const { data: apiHealth } = useQuery({
    queryKey: ['api-health'],
    queryFn: apiService.checkHealth,
    refetchInterval: 30000,
  });

  // Get the primary user name for display
  const getUserDisplayName = () => {
    if (authState.userRoles?.supplier) {
      return authState.userRoles.supplier.name;
    }
    if (authState.userRoles?.reviewer) {
      return authState.userRoles.reviewer.name;
    }
    return 'User';
  };

  const handleLogout = () => {
    logout();
    navigate('catalog');
  };

  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          {/* Logo */}
          <div className="flex items-center">
            <button
              onClick={() => navigate('catalog')}
              className="text-2xl font-bold text-black hover:text-gray-700 transition-colors"
            >
              SquidPro
            </button>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-8">
            <button
              onClick={() => navigate('catalog')}
              className={`text-sm font-medium transition-colors ${
                currentRoute === 'catalog'
                  ? 'text-blue-600 border-b-2 border-blue-600 pb-1'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Catalog
            </button>
            <button
              onClick={() => navigate('profile')}
              className={`text-sm font-medium transition-colors ${
                currentRoute === 'profile'
                  ? 'text-blue-600 border-b-2 border-blue-600 pb-1'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {authState.isAuthenticated ? 'Dashboard' : 'Profile'}
            </button>
          </nav>

          {/* Right side - Status and User Info */}
          <div className="flex items-center space-x-4">
            {/* API Status */}
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <div
                className={`w-2 h-2 rounded-full ${
                  apiHealth?.ok ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="hidden sm:inline">
                {apiHealth?.ok ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* User Info */}
            {authState.isAuthenticated ? (
              <div className="flex items-center space-x-3">
                <div className="hidden sm:flex items-center space-x-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700">{getUserDisplayName()}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate('profile')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Sign In
              </button>
            )}

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => navigate(currentRoute === 'catalog' ? 'profile' : 'catalog')}
                className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile navigation */}
        <div className="md:hidden pb-4">
          <div className="flex space-x-1 mb-3">
            <button
              onClick={() => navigate('catalog')}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md ${
                currentRoute === 'catalog'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              Catalog
            </button>
            <button
              onClick={() => navigate('profile')}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md ${
                currentRoute === 'profile'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {authState.isAuthenticated ? 'Dashboard' : 'Profile'}
            </button>
          </div>

          {/* Mobile user info */}
          {authState.isAuthenticated && (
            <div className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-md">
              <span>Signed in as {getUserDisplayName()}</span>
              <button
                onClick={handleLogout}
                className="text-red-600 hover:text-red-700"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;