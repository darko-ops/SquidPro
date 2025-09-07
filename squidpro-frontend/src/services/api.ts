import axios from 'axios';
import type { DataPackage, QualityScore, ApiHealth } from '../types';

const API_BASE = 'http://localhost:8100';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`, response.data);
    return response;
  },
  (error) => {
    console.error('❌ API Response Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url,
      message: error.message
    });
    return Promise.reject(error);
  }
);

export const apiService = {
  async checkHealth(): Promise<ApiHealth> {
    try {
      console.log('🏥 Checking API health...');
      const response = await api.get('/health');
      console.log('✅ Health check successful:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return { ok: false };
    }
  },

  async getPackages(): Promise<DataPackage[]> {
    try {
      console.log('📦 Fetching packages...');
      const response = await api.get('/packages');
      console.log(`✅ Packages fetched: ${response.data?.length || 0} packages`);
      
      if (!Array.isArray(response.data)) {
        console.warn('⚠️ API returned non-array data:', response.data);
        return [];
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ Failed to fetch packages:', error);
      return [];
    }
  },

  async getQualityScores(packageIds: number[]): Promise<Record<number, QualityScore>> {
    const scores: Record<number, QualityScore> = {};
    
    if (packageIds.length === 0) {
      return scores;
    }
    
    await Promise.allSettled(
      packageIds.map(async (id) => {
        try {
          const response = await api.get(`/packages/${id}/quality`);
          scores[id] = response.data;
        } catch (error) {
          console.log(`ℹ️ No quality data for package ${id}`);
        }
      })
    );

    return scores;
  },
};

export default apiService;