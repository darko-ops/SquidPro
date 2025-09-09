// useAuth.ts - Custom React hook for SquidPro authentication

import { useState, useEffect, useCallback } from 'react';
// Fix: Import from the correct location
import { 
  User, 
  LoginCredentials, 
  UserRegistration, 
  AuthResponse, 
  RegisterResponse,
  ValidationResponse,
  UseAuthReturn,
  UserRole 
} from '../../context/auth.types';

const API_BASE = 'http://localhost:8100';
const SESSION_KEY = 'squidpro_session';

// API service class
class AuthService {
  private static async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || `HTTP error! status: ${response.status}`);
    }

    return data;
  }

  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  static async register(userData: UserRegistration): Promise<RegisterResponse> {
    return this.request<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  static async logout(sessionToken: string): Promise<{ message: string }> {
    return this.request('/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': sessionToken,
      },
    });
  }

  static async getSession(sessionToken: string): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/session', {
      headers: {
        'Authorization': sessionToken,
      },
    });
  }

  static async checkUsername(username: string): Promise<ValidationResponse> {
    return this.request<ValidationResponse>(
      `/auth/check-username?username=${encodeURIComponent(username)}`
    );
  }

  static async checkEmail(email: string): Promise<ValidationResponse> {
    return this.request<ValidationResponse>(
      `/auth/check-email?email=${encodeURIComponent(email)}`
    );
  }

  static async getUserProfile(authHeader: string, isApiKey = false): Promise<User> {
    const headers = isApiKey 
      ? { 'X-API-Key': authHeader }
      : { 'Authorization': authHeader };
    
    return this.request<User>('/users/me', { headers });
  }
}

// Storage utilities
class StorageService {
  static getSessionToken(): string | null {
    try {
      return localStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  }

  static setSessionToken(token: string): void {
    try {
      localStorage.setItem(SESSION_KEY, token);
    } catch (error) {
      console.warn('Failed to save session token:', error);
    }
  }

  static removeSessionToken(): void {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      console.warn('Failed to remove session token:', error);
    }
  }
}

// Main authentication hook
export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(
    StorageService.getSessionToken()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = Boolean(user && sessionToken);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Check session validity on mount
  const checkSession = useCallback(async () => {
    if (!sessionToken) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await AuthService.getSession(sessionToken);
      setUser(response.user);
      setError(null);
    } catch (err) {
      console.warn('Session check failed:', err);
      // Invalid session - clear it
      setSessionToken(null);
      setUser(null);
      StorageService.removeSessionToken();
      setError(null); // Don't show error for expired sessions
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Login function
  const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await AuthService.login(credentials);
      
      setSessionToken(response.session_token);
      setUser(response.user);
      StorageService.setSessionToken(response.session_token);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Registration function
  const register = useCallback(async (userData: UserRegistration): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await AuthService.register(userData);
      
      // Auto-login after successful registration
      await login({
        username: userData.username,
        password: userData.password,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [login]);

  // Logout function
  const logout = useCallback(async (): Promise<void> => {
    if (sessionToken) {
      try {
        await AuthService.logout(sessionToken);
      } catch (err) {
        console.warn('Logout request failed:', err);
        // Continue with local logout even if server request fails
      }
    }

    setUser(null);
    setSessionToken(null);
    setError(null);
    StorageService.removeSessionToken();
  }, [sessionToken]);

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    checkSession,
    error,
  };
};

// Validation hook for form fields
export const useValidation = () => {
  const [usernameState, setUsernameState] = useState({
    message: '',
    status: 'idle' as const,
  });
  
  const [emailState, setEmailState] = useState({
    message: '',
    status: 'idle' as const,
  });

  const validateUsername = useCallback(async (username: string) => {
    if (username.length < 3) {
      setUsernameState({
        message: 'Username must be at least 3 characters',
        status: 'error',
      });
      return false;
    }

    setUsernameState({
      message: 'Checking availability...',
      status: 'checking',
    });

    try {
      const result = await AuthService.checkUsername(username);
      setUsernameState({
        message: result.message,
        status: result.available ? 'available' : 'taken',
      });
      return result.available;
    } catch (error) {
      setUsernameState({
        message: 'Error checking username',
        status: 'error',
      });
      return false;
    }
  }, []);

  const validateEmail = useCallback(async (email: string) => {
    if (!email.includes('@')) {
      setEmailState({ message: '', status: 'idle' });
      return true;
    }

    setEmailState({
      message: 'Checking availability...',
      status: 'checking',
    });

    try {
      const result = await AuthService.checkEmail(email);
      setEmailState({
        message: result.message,
        status: result.available ? 'available' : 'taken',
      });
      return result.available;
    } catch (error) {
      setEmailState({
        message: 'Error checking email',
        status: 'error',
      });
      return false;
    }
  }, []);

  return {
    usernameState,
    emailState,
    validateUsername,
    validateEmail,
  };
};

// Role utilities hook
export const useRoles = (user: User | null) => {
  const hasRole = useCallback((role: UserRole): boolean => {
    return user?.roles.includes(role) ?? false;
  }, [user]);

  const canBuyData = hasRole('buyer');
  const canSellData = hasRole('supplier');
  const canReviewData = hasRole('reviewer');

  const permissions = {
    canBuyData,
    canSellData,
    canReviewData,
    canAccessSupplierDashboard: canSellData,
    canAccessReviewerDashboard: canReviewData,
  };

  return {
    hasRole,
    permissions,
    roles: user?.roles ?? [],
  };
};

// Form handling hook
export const useAuthForm = <T extends Record<string, any>>(
  initialData: T,
  onSubmit: (data: T) => Promise<void>
) => {
  const [formData, setFormData] = useState<T>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = useCallback((field: keyof T, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field as string]) {
      setErrors(prev => ({ ...prev, [field as string]: '' }));
    }
  }, [errors]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      await onSubmit(formData);
    } catch (error) {
      if (error instanceof Error) {
        setErrors({ general: error.message });
      }
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSubmit]);

  const resetForm = useCallback(() => {
    setFormData(initialData);
    setErrors({});
    setIsSubmitting(false);
  }, [initialData]);

  return {
    formData,
    errors,
    isSubmitting,
    updateField,
    handleSubmit,
    resetForm,
    setErrors,
  };
};

// Export the service for direct use if needed
export { AuthService, StorageService };

// Default export
export default useAuth;