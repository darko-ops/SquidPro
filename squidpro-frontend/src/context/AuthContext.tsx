import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface AuthState {
  isAuthenticated: boolean;
  sessionToken?: string;
  user?: any;
  userRoles: Record<string, any>;
}

interface AuthContextType {
  authState: AuthState;
  login: (authData: { sessionToken: string; user: any }) => void;
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
    userRoles: {}
  });

  // Load authentication state from localStorage on mount
  useEffect(() => {
    try {
      const savedSessionToken = localStorage.getItem('squidpro_session_token');
      const savedUser = localStorage.getItem('squidpro_user');
      
      if (savedSessionToken && savedUser) {
        const parsedUser = JSON.parse(savedUser);
        console.log('Loaded saved session:', { sessionToken: savedSessionToken, user: parsedUser });
        
        setAuthState({
          isAuthenticated: true,
          sessionToken: savedSessionToken,
          user: parsedUser,
          userRoles: {}
        });
        
        // Validate session with backend
        validateSession(savedSessionToken);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Failed to load saved auth state:', error);
      localStorage.removeItem('squidpro_session_token');
      localStorage.removeItem('squidpro_user');
      setIsLoading(false);
    }
  }, []);

  // Validate session with backend
  const validateSession = async (sessionToken: string) => {
    try {
      const response = await fetch('http://localhost:8100/auth/session', {
        headers: {
          'Authorization': sessionToken
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Session validation successful:', data);
        setAuthState(prev => ({
          ...prev,
          user: data.user
        }));
      } else {
        console.warn('Session validation failed, clearing auth state');
        logout();
      }
    } catch (error) {
      console.error('Session validation error:', error);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  // Save authentication state to localStorage
  const saveAuthState = (sessionToken: string, user: any) => {
    try {
      localStorage.setItem('squidpro_session_token', sessionToken);
      localStorage.setItem('squidpro_user', JSON.stringify(user));
      console.log('Auth state saved to localStorage');
    } catch (error) {
      console.error('Failed to save auth state:', error);
    }
  };

  // Clear authentication state from localStorage
  const clearAuthState = () => {
    try {
      localStorage.removeItem('squidpro_session_token');
      localStorage.removeItem('squidpro_user');
      console.log('Auth state cleared from localStorage');
    } catch (error) {
      console.error('Failed to clear auth state:', error);
    }
  };

  // Login function - handles session-based auth
  const login = useCallback((authData: { sessionToken: string; user: any }) => {
    console.log('AuthContext: Logging in with session data:', authData);
    
    setAuthState({
      isAuthenticated: true,
      sessionToken: authData.sessionToken,
      user: authData.user,
      userRoles: {} // Will be loaded later
    });
    
    saveAuthState(authData.sessionToken, authData.user);
  }, []);

  const logout = useCallback(() => {
    console.log('AuthContext: Logging out');
    setAuthState({
      isAuthenticated: false,
      userRoles: {}
    });
    clearAuthState();
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