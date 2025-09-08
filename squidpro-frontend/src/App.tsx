import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import Header from './components/Layout/Header';
import DataCatalog from './components/DataCatalog/DataCatalog';
import Profile from './components/Profile/Profile';

type Route = 'catalog' | 'profile';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const [currentRoute, setCurrentRoute] = useState<Route>('catalog');

  const navigate = (route: Route) => {
    setCurrentRoute(route);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50">
          <Header currentRoute={currentRoute} navigate={navigate} />
          
          <main>
            {currentRoute === 'catalog' && <DataCatalog />}
            {currentRoute === 'profile' && <Profile onBack={() => navigate('catalog')} />}
          </main>
        </div>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;