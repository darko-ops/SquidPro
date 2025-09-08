import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Search, 
  ExternalLink, 
  Eye, 
  Star, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  Info,
  Zap
} from 'lucide-react';
import { apiService } from '../../services/api';
import type { DataPackage } from '../../types';

const DataCatalog: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showIntegrationGuide, setShowIntegrationGuide] = useState(false);

  // Fetch packages
  const { 
    data: packages = [], 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['packages'],
    queryFn: apiService.getPackages,
    refetchInterval: 30000,
  });

  // Fetch quality scores
  const { data: qualityScores = {} } = useQuery({
    queryKey: ['quality-scores', packages.map(p => p.id)],
    queryFn: () => apiService.getQualityScores(packages.map(p => p.id)),
    enabled: packages.length > 0,
  });

  // Filter packages
  const filteredPackages = useMemo(() => {
    return packages.filter(pkg => {
      const matchesSearch = !searchTerm || 
        pkg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pkg.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pkg.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = !selectedCategory || pkg.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [packages, searchTerm, selectedCategory]);

  const categories = useMemo(() => 
    [...new Set(packages.map(p => p.category))], [packages]
  );

  const showIntegrationCode = (packageId: number, packageName: string) => {
    alert(`Integration for "${packageName}":\n\n` +
          `1. Mint token: POST /mint\n` +
          `2. Query package: GET /data/package/${packageId}\n` +
          `3. Use Authorization: Bearer YOUR_TOKEN header\n\n` +
          `See integration examples below.`);
  };

  const showSampleData = (packageId: number) => {
    const pkg = packages.find(p => p.id === packageId);
    if (pkg?.sample_data) {
      alert(`Sample Data:\n\n${JSON.stringify(pkg.sample_data, null, 2)}`);
    } else {
      alert('No sample data available for this package.');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffHours < 1) return 'Recently';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8">
          <h1 className="text-2xl font-bold text-red-900 mb-4">Connection Error</h1>
          <p className="text-red-700 mb-2">
            Failed to load packages. Make sure SquidPro API is running on port 8100.
          </p>
          <p className="text-sm text-red-600">
            Error: {(error as Error).message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Data Catalog
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-6">
          Quality-verified data feeds for AI agents with transparent pricing and peer-reviewed reliability scores.
        </p>
        <div className="inline-flex items-center px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-sm font-medium text-blue-800">
          <Zap className="w-4 h-4 mr-2" />
          Enhanced React Version - Real-time updates enabled!
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search packages
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, description, or tags..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-16">
          <div className="inline-flex items-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-gray-600">Loading data packages...</span>
          </div>
        </div>
      )}

      {/* Packages Grid */}
      {!isLoading && (
        <>
          {filteredPackages.length === 0 ? (
            <div className="text-center py-16">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No packages found
              </h3>
              <p className="text-gray-600">Try adjusting your search criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {filteredPackages.map(pkg => {
                const qualityScore = qualityScores[pkg.id];
                const hasQuality = qualityScore && qualityScore.total_reviews > 0;
                const overallRating = hasQuality ? qualityScore.scores.overall_rating : 0;

                return (
                  <div 
                    key={pkg.id} 
                    className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 hover:border-blue-300 hover:-translate-y-1"
                  >
                    <div className="p-6">
                      {/* Package Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {pkg.name}
                          </h3>
                          <p className="text-sm text-gray-600">by {pkg.supplier}</p>
                        </div>
                        <div className="text-lg font-bold text-green-600">
                          ${pkg.price_per_query}
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-gray-700 text-sm mb-4 line-clamp-3">
                        {pkg.description}
                      </p>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded border border-blue-200">
                          {pkg.category}
                        </span>
                        {pkg.tags?.slice(0, 2).map(tag => (
                          <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                            {tag}
                          </span>
                        ))}
                        {pkg.tags && pkg.tags.length > 2 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                            +{pkg.tags.length - 2} more
                          </span>
                        )}
                      </div>

                      {/* Quality Section */}
                      <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-4">
                        {hasQuality ? (
                          <>
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-sm font-medium text-gray-900">Quality Score</span>
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-bold text-green-600">
                                  {overallRating.toFixed(1)}/10
                                </span>
                                <div className="flex">
                                  {[...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`w-4 h-4 ${
                                        i < Math.round(overallRating / 2)
                                          ? 'text-yellow-400 fill-current'
                                          : 'text-gray-300'
                                      }`}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4 text-center">
                              <div>
                                <div className="flex items-center justify-center mb-1">
                                  <TrendingUp className="w-3 h-3 text-gray-400 mr-1" />
                                  <span className="text-xs text-gray-600">Accuracy</span>
                                </div>
                                <div className="text-sm font-medium text-gray-900">
                                  {qualityScore.scores.quality.toFixed(1)}
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center justify-center mb-1">
                                  <Clock className="w-3 h-3 text-gray-400 mr-1" />
                                  <span className="text-xs text-gray-600">Freshness</span>
                                </div>
                                <div className="text-sm font-medium text-gray-900">
                                  {qualityScore.scores.timeliness.toFixed(1)}
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center justify-center mb-1">
                                  <CheckCircle className="w-3 h-3 text-gray-400 mr-1" />
                                  <span className="text-xs text-gray-600">Schema</span>
                                </div>
                                <div className="text-sm font-medium text-gray-900">
                                  {qualityScore.scores.schema_compliance.toFixed(1)}
                                </div>
                              </div>
                            </div>
                            
                            <p className="text-xs text-gray-500 mt-3 text-center">
                              Based on {qualityScore.total_reviews} review{qualityScore.total_reviews !== 1 ? 's' : ''} • 
                              Last reviewed {formatDate(qualityScore.last_reviewed)}
                            </p>
                          </>
                        ) : (
                          <div className="text-center">
                            <Info className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                            <span className="text-sm text-gray-600">Not yet reviewed</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex space-x-2">
                        <button
                          onClick={() => showIntegrationCode(pkg.id, pkg.name)}
                          className="flex-1 bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors flex items-center justify-center space-x-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Use Package</span>
                        </button>
                        <button
                          onClick={() => showSampleData(pkg.id)}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Integration Guide */}
      <div className="border-t border-gray-200 pt-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Quick Integration
          </h2>
          <p className="text-gray-600 max-width-2xl mx-auto">
            Get started with SquidPro in 3 simple steps
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: "1",
              title: "Get an API Token",
              code: `curl -X POST http://localhost:8100/mint \\
  -H "Content-Type: application/json" \\
  -d '{"agent_id":"my-ai-agent","credits":10.0}'`
            },
            {
              step: "2", 
              title: "Query Any Data Package",
              code: `curl -H "Authorization: Bearer YOUR_TOKEN" \\
  "http://localhost:8100/data/package/1"`
            },
            {
              step: "3",
              title: "Get Data + Receipt", 
              code: `{
  "trace_id": "...",
  "data": {"price": 65000.50},
  "cost": 0.005,
  "payout": {"supplier": 0.0035}
}`
            }
          ].map(({ step, title, code }) => (
            <div key={step} className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {step}. {title}
              </h3>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto">
                <pre className="text-sm">
                  <code>{code}</code>
                </pre>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <button
            onClick={() => setShowIntegrationGuide(!showIntegrationGuide)}
            className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            Create Account to Get Started
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataCatalog;