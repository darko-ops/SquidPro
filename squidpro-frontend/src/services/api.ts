import axios from 'axios';
import type { DataPackage, QualityScore, User, ApiHealth } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8100';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

export const apiService = {
  async checkHealth(): Promise<ApiHealth> {
    const response = await api.get('/health');
    return response.data;
  },

  async getPackages(): Promise<DataPackage[]> {
    const response = await api.get('/packages');
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
};

export default apiService;
