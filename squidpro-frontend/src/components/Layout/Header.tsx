import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../App';
import { apiService } from '../../services/api';

interface HeaderProps {
  currentRoute: 'catalog' | 'profile';
  navigate: (route: 'catalog' | 'profile') => void;
}

const Header: React.FC<HeaderProps> = ({ currentRoute, navigate }) => {
  const { user, isAuthenticated } = useAuth();

  // Check API health
  const { data: apiHealth } = useQuery({
    queryKey: ['api-health'],
    queryFn: apiService.checkHealth,
    refetchInterval: 30000,
  });

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
              Profile
            </button>
          </nav>

          {/* Right side - User info and API status */}
          <div className="flex items-center space-x-4">
            {/* User info */}
            {isAuthenticated && user && (
              <div className="hidden md:flex items-center space-x-2 text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>{user.name}</span>
                </div>
                <span className="text-gray-400">•</span>
                <span className="capitalize">{user.type}</span>
              </div>
            )}

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
          <div className="flex space-x-1">
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
              Profile
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;