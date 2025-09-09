// auth.types.ts - TypeScript types for SquidPro authentication system

// User and Authentication Types
export interface User {
    id: number;
    username: string;
    name: string;
    email: string;
    roles: UserRole[];
    api_key: string;
    stellar_address: string;
    created_at?: string;
    updated_at?: string;
  }
  
  export interface UserSession extends User {
    session_token: string;
    expires_at: string;
  }
  
  export type UserRole = 'buyer' | 'supplier' | 'reviewer';
  
  // Form Types
  export interface LoginCredentials {
    username: string;
    password: string;
  }
  
  export interface UserRegistration {
    username: string;
    name: string;
    email: string;
    password: string;
    repeat_password: string;
    stellar_address: string;
    roles: UserRole[];
  }
  
  // API Response Types
  export interface AuthResponse {
    session_token: string;
    user: User;
  }
  
  export interface RegisterResponse {
    user_id: number;
    username: string;
    api_key: string;
    roles: UserRole[];
    message: string;
  }
  
  export interface ValidationResponse {
    available: boolean;
    message: string;
  }
  
  // Validation State Types
  export type ValidationStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error';
  
  export interface ValidationState {
    username: {
      message: string;
      status: ValidationStatus;
    };
    email: {
      message: string;
      status: ValidationStatus;
    };
  }
  
  // Message Types
  export type MessageType = 'success' | 'error' | 'warning' | 'info';
  
  export interface Message {
    text: string;
    type: MessageType;
  }
  
  // Role-specific Data Types
  export interface SupplierStats {
    package_count: number;
    balance: number;
    total_revenue?: number;
    total_queries?: number;
  }
  
  export interface ReviewerStats {
    total_reviews: number;
    consensus_rate: number;
    accuracy_score: number;
    total_earned: number;
    balance: number;
    reputation_level?: string;
  }
  
  export interface UserProfile extends User {
    supplier_stats?: SupplierStats;
    reviewer_stats?: ReviewerStats;
  }
  
  // Data Package Types (for role content)
  export interface DataPackage {
    id: number;
    name: string;
    description: string;
    category: string;
    supplier: string;
    price_per_query: number;
    sample_data?: any;
    tags?: string[];
    created_at: string;
  }
  
  // Review Task Types
  export interface ReviewTask {
    task_id: number;
    package_name: string;
    supplier: string;
    category: string;
    task_type: string;
    reward_pool: number;
    spots_remaining: number;
    current_rating?: number;
    expires_at: string;
  }
  
  // API Error Types
  export interface ApiError {
    detail: string;
    status_code?: number;
  }
  
  // Authentication Hook Types
  export interface UseAuthReturn {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (credentials: LoginCredentials) => Promise<void>;
    register: (userData: UserRegistration) => Promise<void>;
    logout: () => Promise<void>;
    checkSession: () => Promise<void>;
    error: string | null;
  }
  
  // Form Validation Types
  export interface FormErrors {
    [key: string]: string;
  }
  
  export interface FormState<T> {
    data: T;
    errors: FormErrors;
    isSubmitting: boolean;
    isDirty: boolean;
  }
  
  // Role Permission Types
  export interface RolePermissions {
    canBuyData: boolean;
    canSellData: boolean;
    canReviewData: boolean;
    canAccessSupplierDashboard: boolean;
    canAccessReviewerDashboard: boolean;
  }
  
  // Auth Context Types
  export interface AuthContextType {
    user: User | null;
    sessionToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (credentials: LoginCredentials) => Promise<AuthResponse>;
    register: (userData: UserRegistration) => Promise<RegisterResponse>;
    logout: () => Promise<void>;
    updateUser: (userData: Partial<User>) => void;
    checkUsernameAvailability: (username: string) => Promise<ValidationResponse>;
    checkEmailAvailability: (email: string) => Promise<ValidationResponse>;
    hasRole: (role: UserRole) => boolean;
    getPermissions: () => RolePermissions;
  }
  
  // Component Props Types
  export interface AuthFormProps {
    onSubmit: (data: LoginCredentials | UserRegistration) => Promise<void>;
    isLoading?: boolean;
    error?: string | null;
  }
  
  export interface DashboardProps {
    user: User;
    onLogout: () => void;
  }
  
  export interface RoleTabsProps {
    roles: UserRole[];
    activeRole: UserRole;
    onRoleChange: (role: UserRole) => void;
  }
  
  // API Configuration Types
  export interface ApiConfig {
    baseUrl: string;
    timeout: number;
    retries: number;
  }
  
  // Storage Types
  export interface StorageService {
    getSessionToken: () => string | null;
    setSessionToken: (token: string) => void;
    removeSessionToken: () => void;
    getUserPreferences: () => any;
    setUserPreferences: (preferences: any) => void;
  }
  
  // Utility Types
  export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
  export type Partial<T> = { [P in keyof T]?: T[P] };
  
  // API Endpoint Types
  export type AuthEndpoint = 
    | '/auth/login'
    | '/auth/register'
    | '/auth/logout'
    | '/auth/session'
    | '/auth/check-username'
    | '/auth/check-email';
  
  export type UserEndpoint = 
    | '/users/me'
    | '/users/me/detailed'
    | '/users/me/payout-history';
  
  // HTTP Method Types
  export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  
  // Request Types
  export interface ApiRequest<T = any> {
    endpoint: string;
    method: HttpMethod;
    data?: T;
    headers?: Record<string, string>;
    requiresAuth?: boolean;
  }
  
  export interface ApiResponse<T = any> {
    data: T;
    status: number;
    message?: string;
    error?: string;
  }
  
  // Constants
  export const USER_ROLES: UserRole[] = ['buyer', 'supplier', 'reviewer'];
  
  export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
    buyer: 'Purchase data from suppliers',
    supplier: 'Sell your data',
    reviewer: 'Earn by reviewing data quality'
  };
  
  export const VALIDATION_RULES = {
    username: {
      minLength: 3,
      maxLength: 50,
      pattern: /^[a-zA-Z0-9_]+$/,
    },
    password: {
      minLength: 8,
      maxLength: 128,
    },
    name: {
      minLength: 1,
      maxLength: 255,
    },
    stellar_address: {
      length: 56,
      pattern: /^G[A-Z2-7]{55}$/,
    },
  } as const;
  
  // Error Messages
  export const AUTH_ERROR_MESSAGES = {
    INVALID_CREDENTIALS: 'Invalid username or password',
    USERNAME_TAKEN: 'Username is already taken',
    EMAIL_TAKEN: 'Email is already registered',
    PASSWORDS_DONT_MATCH: 'Passwords do not match',
    INVALID_SESSION: 'Invalid or expired session',
    NETWORK_ERROR: 'Network error. Please try again.',
    VALIDATION_ERROR: 'Please fix validation errors',
    REGISTRATION_FAILED: 'Registration failed',
    LOGIN_FAILED: 'Login failed',
    LOGOUT_FAILED: 'Logout failed',
  } as const;
  
  // Success Messages
  export const AUTH_SUCCESS_MESSAGES = {
    REGISTRATION_SUCCESS: 'Account created successfully!',
    LOGIN_SUCCESS: 'Login successful!',
    LOGOUT_SUCCESS: 'Logged out successfully',
    USERNAME_AVAILABLE: 'Username is available',
    EMAIL_AVAILABLE: 'Email is available',
  } as const;