import React, { useState, createContext, useContext } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import DataCatalog from './components/DataCatalog/DataCatalog';
import Profile from './components/Profile/Profile';
import Header from './components/Layout/Header';
import type { User } from './types/index';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Auth Context
interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
});

export const useAuth = () => useContext(AuthContext);

// Simple Router Component
type Route = 'catalog' | 'profile';

interface RouterProps {
  children: React.ReactNode;
}

const Router: React.FC<RouterProps> = ({ children }) => {
  const [currentRoute, setCurrentRoute] = useState<Route>('catalog');

  React.useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.includes('profile')) {
        setCurrentRoute('profile');
      } else {
        setCurrentRoute('catalog');
      }
    };

    window.addEventListener('popstate', handlePopState);
    handlePopState(); // Check initial route

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (route: Route) => {
    setCurrentRoute(route);
    const path = route === 'catalog' ? '/' : `/${route}`;
    window.history.pushState(null, '', path);
  };

  return (
    <div className="router-context">
      {React.cloneElement(children as React.ReactElement, { currentRoute, navigate })}
    </div>
  );
};

// Main App Component
interface AppContentProps {
  currentRoute?: Route;
  navigate?: (route: Route) => void;
}

const AppContent: React.FC<AppContentProps> = ({ currentRoute = 'catalog', navigate = () => {} }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = (userData: User) => {
    setUser(userData);
  };

  const logout = () => {
    setUser(null);
    navigate('catalog');
  };

  const authValue: AuthContextType = {
    user,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={authValue}>
      <div className="min-h-screen bg-white">
        <Header currentRoute={currentRoute} navigate={navigate} />
        
        <main className="main">
          {currentRoute === 'catalog' && <DataCatalog />}
          {currentRoute === 'profile' && <Profile />}
        </main>
      </div>
    </AuthContext.Provider>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AppContent />
      </Router>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;