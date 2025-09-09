import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface AuthState {
  isAuthenticated: boolean;
  apiKeys: Record<string, string>;
  userRoles: Record<string, any>;
  sessionToken?: string;
  user?: any;
}

interface AuthContextType {
  authState: AuthState;
  login: (authData: Record<string, string> | { sessionToken: string; user: any }) => void;
  logout: () => void;
  updateUserRoles: (userRoles: Record<string, any>) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    apiKeys: {},
    userRoles: {}
  });

  // Load authentication state from localStorage on mount
  useEffect(() => {
    try {
      const savedAuthState = localStorage.getItem('squidpro_auth');
      if (savedAuthState) {
        const parsedAuthState = JSON.parse(savedAuthState);
        console.log('Loaded saved auth state:', parsedAuthState);
        setAuthState(parsedAuthState);
      }
    } catch (error) {
      console.error('Failed to load saved auth state:', error);
      localStorage.removeItem('squidpro_auth');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save authentication state to localStorage whenever it changes
  useEffect(() => {
    if (!isLoading) {
      if (authState.isAuthenticated && (Object.keys(authState.apiKeys).length > 0 || authState.sessionToken)) {
        console.log('Saving auth state to localStorage:', authState);
        try {
          localStorage.setItem('squidpro_auth', JSON.stringify(authState));
        } catch (error) {
          console.error('Failed to save auth state:', error);
        }
      } else if (!authState.isAuthenticated) {
        console.log('Removing auth state from localStorage');
        localStorage.removeItem('squidpro_auth');
      }
    }
  }, [authState.isAuthenticated, authState.apiKeys, authState.sessionToken, isLoading]);

  // Login function - handles both API keys and session tokens
  const login = useCallback((authData: Record<string, string> | { sessionToken: string; user: any }) => {
    console.log('AuthContext: Logging in with auth data:', authData);
    
    // Check if this is session-based auth
    if ('sessionToken' in authData && 'user' in authData) {
      console.log('Session-based login');
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: true,
        sessionToken: authData.sessionToken,
        user: authData.user,
        apiKeys: {
          session: authData.sessionToken,
          // Include the user's API key if available
          ...(authData.user.api_key ? { unified: authData.user.api_key } : {})
        },
        userRoles: {} // Will be loaded later
      }));
    } else {
      // Legacy API key login
      console.log('API key-based login');
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: true,
        apiKeys: authData as Record<string, string>,
        userRoles: {} // Reset user roles, they'll be loaded fresh
      }));
    }
  }, []);

  const logout = useCallback(() => {
    console.log('AuthContext: Logging out');
    setAuthState({
      isAuthenticated: false,
      apiKeys: {},
      userRoles: {}
    });
    localStorage.removeItem('squidpro_auth');
  }, []);

  const updateUserRoles = useCallback((userRoles: Record<string, any>) => {
    console.log('AuthContext: Updating user roles:', userRoles);
    setAuthState(prev => {
      // Only update if userRoles actually changed to prevent unnecessary re-renders
      const currentRoles = JSON.stringify(prev.userRoles);
      const newRoles = JSON.stringify(userRoles);
      
      if (currentRoles !== newRoles) {
        return {
          ...prev,
          userRoles
        };
      }
      return prev;
    });
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const value = React.useMemo<AuthContextType>(() => ({
    authState,
    login,
    logout,
    updateUserRoles,
    isLoading
  }), [authState, login, logout, updateUserRoles, isLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};