export interface DataPackage {
  id: number;
  name: string;
  description: string;
  category: string;
  supplier: string;
  price_per_query: number;
  sample_data?: any;
  tags: string[];
  rate_limit: number;
  created_at: string;
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
}

export interface User {
  id: number;
  name: string;
  email?: string;
  type: 'supplier' | 'reviewer';
  stellar_address: string;
  balance: number;
}

export interface ApiHealth {
  ok: boolean;
}
