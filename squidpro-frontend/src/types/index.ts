// Core interfaces
export interface User {
  id: number;
  name: string;
  email?: string;
  type: 'supplier' | 'reviewer';
  stellar_address: string;
  balance: number;
  status?: string;
  created_at?: string;
  package_count?: number;
  reputation_level?: string;
  specializations?: string[];
  stats?: ReviewerStats;
}

export interface DataPackage {
  id: number;
  name: string;
  description: string;
  category: string;
  supplier: string;
  price_per_query: number;
  sample_data?: any;
  schema_definition?: any;
  tags: string[];
  rate_limit: number;
  status?: string;
  package_type?: string;
  created_at: string;
  updated_at?: string;
}

export interface QualityScore {
  package_id: number;
  package_name: string;
  supplier: string;
  scores: {
    overall_rating: number;
    quality: number;
    timeliness: number;
    schema_compliance: number;
  };
  total_reviews: number;
  last_reviewed: string | null;
  trend: string;
  recent_reviews?: ReviewSummary[];
}

export interface ReviewSummary {
  rating: number;
  reviewer: string;
  findings: string;
  date: string;
}

export interface ReviewerStats {
  total_reviews: number;
  consensus_rate: number;
  accuracy_score: number;
  total_earned: number;
  avg_review_time_minutes: number;
}

export interface ReviewTask {
  task_id: number;
  package_name: string;
  supplier: string;
  category: string;
  task_type: string;
  reward_pool: number;
  spots_remaining: number;
  current_rating: number;
  reference_query?: any;
  expires_at: string;
}

export interface ReviewSubmission {
  quality_score: number;
  timeliness_score: number;
  schema_compliance_score: number;
  overall_rating: number;
  findings: string;
  evidence?: Record<string, any>;
}

export interface ApiHealth {
  ok: boolean;
  message?: string;
}

export interface Balance {
  user_type: string;
  user_id: string;
  balance: number;
  payout_threshold?: number;
}

export interface PayoutHistory {
  tx_hash: string;
  amount: number;
  date: string;
}

export interface QueryHistory {
  date: string;
  agent_id: string;
  package_name: string;
  revenue: number;
  trace_id: string;
}

export interface UploadedDataset {
  package_id: number;
  package_name: string;
  filename: string;
  original_filename: string;
  file_size: number;
  row_count: number;
  upload_date: string;
}

// API Response types
export interface MintTokenResponse {
  token: string;
  trace_id: string;
  expires_in_s: number;
  demo_credits: number;
}

export interface DataQueryResponse {
  trace_id: string;
  package_id?: number;
  package_name?: string;
  data: any;
  cost: number;
  payout: {
    supplier: number;
    reviewer_pool: number;
    squidpro: number;
  };
}

export interface RegistrationResponse {
  supplier_id?: number;
  reviewer_id?: number;
  api_key: string;
  status: string;
  message: string;
}

// Form types
export interface SupplierRegistration {
  name: string;
  email: string;
  stellar_address: string;
}

export interface ReviewerRegistration {
  name: string;
  stellar_address: string;
  email?: string;
  specializations: string[];
}

export interface DatasetUpload {
  name: string;
  description: string;
  category: string;
  price_per_query: number;
  tags: string;
  file: File;
}

// Error types
export interface ApiError {
  error: string;
  message: string;
  details?: any;
}

// Chart data types
export interface ChartDataPoint {
  month: string;
  earnings?: number;
  revenue?: number;
  queries?: number;
  reviews?: number;
}

// Navigation types
export type Route = 'catalog' | 'profile' | 'dashboard' | 'settings';

// Auth types
export interface AuthState {
  user: User | null;
  token?: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  error?: string;
}