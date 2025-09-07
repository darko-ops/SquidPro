import axios from 'axios';
import type { 
  DataPackage, 
  QualityScore, 
  User, 
  ApiHealth, 
  ReviewTask,
  ReviewSubmission,
  MintTokenResponse,
  DataQueryResponse,
  RegistrationResponse,
  SupplierRegistration,
  ReviewerRegistration,
  Balance,
  PayoutHistory,
  UploadedDataset,
  ApiError
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8100';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

// Add request interceptor for auth
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('squidpro_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('squidpro_token');
      localStorage.removeItem('squidpro_api_key');
      window.location.href = '/profile';
    }
    return Promise.reject(error);
  }
);

export const apiService = {
  // Health & Status
  async checkHealth(): Promise<ApiHealth> {
    const response = await api.get('/health');
    return response.data;
  },

  // Data Packages
  async getPackages(category?: string, tag?: string): Promise<DataPackage[]> {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (tag) params.append('tag', tag);
    
    const response = await api.get(`/packages?${params.toString()}`);
    return response.data;
  },

  async getPackage(packageId: number): Promise<DataPackage> {
    const response = await api.get(`/packages/${packageId}`);
    return response.data;
  },

  async getQualityScores(packageIds: number[]): Promise<Record<number, QualityScore>> {
    const scores: Record<number, QualityScore> = {};
    
    await Promise.allSettled(
      packageIds.map(async (id) => {
        try {
          const response = await api.get(`/packages/${id}/quality`);
          scores[id] = response.data;
        } catch (error) {
          console.log(`No quality data for package ${id}`);
        }
      })
    );

    return scores;
  },

  async getPackageQuality(packageId: number): Promise<QualityScore> {
    const response = await api.get(`/packages/${packageId}/quality`);
    return response.data;
  },

  // Authentication & User Management
  async authenticateUser(apiKey: string): Promise<User> {
    const headers = { 'X-API-Key': apiKey };
    
    // Try supplier first
    if (apiKey.startsWith('sup_')) {
      try {
        const response = await api.get('/suppliers/me', { headers });
        return { ...response.data, type: 'supplier' as const };
      } catch (error) {
        // Fall through to try reviewer
      }
    }
    
    // Try reviewer
    if (apiKey.startsWith('rev_')) {
      try {
        const response = await api.get('/reviewers/me', { headers });
        return { ...response.data, type: 'reviewer' as const };
      } catch (error) {
        // Fall through to error
      }
    }
    
    throw new Error('Invalid API key');
  },

  async getUserProfile(apiKey: string): Promise<User> {
    const headers = { 'X-API-Key': apiKey };
    const response = await api.get('/users/me', { headers });
    return response.data;
  },

  // Registration
  async registerSupplier(data: SupplierRegistration): Promise<RegistrationResponse> {
    const response = await api.post('/suppliers/register', data);
    return response.data;
  },

  async registerReviewer(data: ReviewerRegistration): Promise<RegistrationResponse> {
    const response = await api.post('/reviewers/register', data);
    return response.data;
  },

  // Token Management
  async mintToken(agentId: string, credits: number): Promise<MintTokenResponse> {
    const response = await api.post('/mint', {
      agent_id: agentId,
      credits,
      scope: 'data.read.price'
    });
    return response.data;
  },

  // Data Queries
  async queryPackage(packageId: number, token: string): Promise<DataQueryResponse> {
    const response = await api.get(`/data/package/${packageId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  async queryUploadedData(filename: string, token: string, limit = 100, offset = 0): Promise<DataQueryResponse> {
    const response = await api.get(`/data/uploaded/${filename}`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit, offset }
    });
    return response.data;
  },

  async queryPriceData(pair: string, token: string): Promise<DataQueryResponse> {
    const response = await api.get('/data/price', {
      headers: { Authorization: `Bearer ${token}` },
      params: { pair }
    });
    return response.data;
  },

  // Supplier Operations
  async uploadDataset(formData: FormData, apiKey: string): Promise<any> {
    const response = await api.post('/suppliers/upload', formData, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  async getSupplierUploads(apiKey: string): Promise<UploadedDataset[]> {
    const response = await api.get('/suppliers/uploads', {
      headers: { 'X-API-Key': apiKey }
    });
    return response.data;
  },

  async createPackage(packageData: any, apiKey: string): Promise<any> {
    const response = await api.post('/suppliers/packages', packageData, {
      headers: { 'X-API-Key': apiKey }
    });
    return response.data;
  },

  // Review System
  async getAvailableReviewTasks(apiKey: string, category?: string, taskType?: string): Promise<ReviewTask[]> {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (taskType) params.append('task_type', taskType);

    const response = await api.get(`/review-tasks?${params.toString()}`, {
      headers: { 'X-API-Key': apiKey }
    });
    return response.data;
  },

  async submitReview(taskId: number, review: ReviewSubmission, apiKey: string): Promise<any> {
    const response = await api.post(`/review-tasks/${taskId}/submit`, review, {
      headers: { 'X-API-Key': apiKey }
    });
    return response.data;
  },

  async createReviewTask(packageId: number, taskType: string, rewardPool = 0.05, requiredReviews = 3): Promise<any> {
    const response = await api.post('/admin/create-review-task', null, {
      params: {
        package_id: packageId,
        task_type: taskType,
        reward_pool: rewardPool,
        required_reviews: requiredReviews
      }
    });
    return response.data;
  },

  // Balances & Payments
  async getBalances(): Promise<Balance[]> {
    const response = await api.get('/balances');
    return response.data;
  },

  async getUserBalance(userType: string, userId: string): Promise<Balance> {
    const response = await api.get(`/balances/${userType}/${userId}`);
    return response.data;
  },

  async getPayoutHistory(apiKey?: string): Promise<PayoutHistory[]> {
    const headers = apiKey ? { 'X-API-Key': apiKey } : {};
    const response = await api.get('/users/me/payout-history', { headers });
    return response.data;
  },

  async updatePayoutThreshold(threshold: number, apiKey: string): Promise<any> {
    const response = await api.post('/users/me/update-payout-threshold', 
      { threshold }, 
      { headers: { 'X-API-Key': apiKey } }
    );
    return response.data;
  },

  async processPayouts(): Promise<any> {
    const response = await api.post('/admin/process-payouts');
    return response.data;
  },

  // Stellar Integration
  async getStellarInfo(): Promise<any> {
    const response = await api.get('/stellar/info');
    return response.data;
  },

  // Analytics & Statistics
  async getDetailedProfile(apiKey: string): Promise<any> {
    const response = await api.get('/users/me/detailed', {
      headers: { 'X-API-Key': apiKey }
    });
    return response.data;
  },

  async getApiUsageStats(apiKey: string): Promise<any> {
    const response = await api.get('/users/me/api-usage', {
      headers: { 'X-API-Key': apiKey }
    });
    return response.data;
  },

  // Admin Operations
  async getPiiLogs(limit = 50): Promise<any[]> {
    const response = await api.get(`/admin/pii-logs?limit=${limit}`);
    return response.data;
  },

  // Error handling utility
  handleApiError(error: any): ApiError {
    if (error.response?.data) {
      return error.response.data;
    }
    return {
      error: 'NETWORK_ERROR',
      message: error.message || 'An unexpected error occurred'
    };
  },

  // Utility methods
  isApiKeyValid(apiKey: string): boolean {
    return apiKey.length > 0 && (apiKey.startsWith('sup_') || apiKey.startsWith('rev_'));
  },

  getTokenFromStorage(): string | null {
    return localStorage.getItem('squidpro_token');
  },

  getApiKeyFromStorage(): string | null {
    return localStorage.getItem('squidpro_api_key');
  },

  setTokenInStorage(token: string): void {
    localStorage.setItem('squidpro_token', token);
  },

  setApiKeyInStorage(apiKey: string): void {
    localStorage.setItem('squidpro_api_key', apiKey);
  },

  clearStorage(): void {
    localStorage.removeItem('squidpro_token');
    localStorage.removeItem('squidpro_api_key');
  }
};

export default apiService;