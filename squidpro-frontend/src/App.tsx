import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import Header from './components/Layout/Header';
import DataCatalog from './components/DataCatalog/DataCatalog';
import Profile from './components/Profile/Profile';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

type Route = 'catalog' | 'profile';

function App() {
  const [currentRoute, setCurrentRoute] = useState<Route>('catalog');

  const navigate = (route: Route) => {
    setCurrentRoute(route);
  };

  const handleBackToCatalog = () => {
    setCurrentRoute('catalog');
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="App min-h-screen bg-gray-50">
        {/* Header Navigation */}
        <Header currentRoute={currentRoute} navigate={navigate} />
        
        {/* Main Content */}
        <main>
          {currentRoute === 'catalog' && <DataCatalog />}
          {currentRoute === 'profile' && <Profile onBack={handleBackToCatalog} />}
        </main>
      </div>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;