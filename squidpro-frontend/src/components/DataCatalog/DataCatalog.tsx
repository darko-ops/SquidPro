import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ExternalLink, Eye } from 'lucide-react';
import { apiService } from '../../services/api';
import type { DataPackage } from '../../types';

const DataCatalog: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

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

  // Check API health
  const { data: apiHealth } = useQuery({
    queryKey: ['api-health'],
    queryFn: apiService.checkHealth,
    refetchInterval: 30000,
  });

  // Filter packages
  const filteredPackages = React.useMemo(() => {
    return packages.filter(pkg => {
      const matchesSearch = !searchTerm || 
        pkg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pkg.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pkg.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = !selectedCategory || pkg.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [packages, searchTerm, selectedCategory]);

  const categories = [...new Set(packages.map(p => p.category))];

  const showIntegrationCode = (packageId: number, packageName: string) => {
    alert(`Integration for "${packageName}":\n\n1. Mint token: POST /mint\n2. Query package: GET /data/package/${packageId}\n3. Use Authorization: Bearer YOUR_TOKEN header`);
  };

  const showSampleData = (packageId: number) => {
    const pkg = packages.find(p => p.id === packageId);
    if (pkg?.sample_data) {
      alert(`Sample Data:\n\n${JSON.stringify(pkg.sample_data, null, 2)}`);
    } else {
      alert('No sample data available for this package.');
    }
  };

  if (error) {
    return (
      <div className="error">
        <h1>Connection Error</h1>
        <p>Failed to load packages. Make sure SquidPro API is running on port 8100.</p>
        <p style={{fontSize: '0.875rem', color: '#6b7280'}}>
          Error: {(error as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div style={{minHeight: '100vh'}}>
      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div style={{display: 'flex', alignItems: 'center', gap: '2rem'}}>
              <a href="/" className="logo">SquidPro</a>
              <nav className="nav">
                <a href="/">Catalog</a>
                <a href="http://localhost:8100/profile.html">Profile</a>
              </nav>
            </div>
            
            <div className="status">
              <div className={`status-dot ${apiHealth?.ok ? 'status-online' : 'status-offline'}`} />
              <span>{apiHealth?.ok ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="container">
          {/* Hero */}
          <div className="hero">
            <h1>Data Catalog</h1>
            <p>
              Quality-verified data feeds for AI agents with transparent pricing and peer-reviewed reliability scores.
            </p>
            <div className="hero-badge">
              🚀 Enhanced React Version - Real-time updates enabled!
            </div>
          </div>

          {/* Search */}
          <div className="search-section">
            <div className="search-grid">
              <div className="form-group">
                <label>Search packages</label>
                <div style={{position: 'relative'}}>
                  <Search style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '1rem',
                    height: '1rem',
                    color: '#9ca3af'
                  }} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, description, or tags..."
                    className="form-input"
                    style={{paddingLeft: '2.5rem'}}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="form-input"
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

          {/* Loading */}
          {isLoading && (
            <div className="loading">
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <div className="spinner"></div>
                <span>Loading data packages...</span>
              </div>
            </div>
          )}

          {/* Packages Grid */}
          {!isLoading && (
            <>
              {filteredPackages.length === 0 ? (
                <div style={{textAlign: 'center', padding: '3rem'}}>
                  <h3 style={{fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem'}}>
                    No packages found
                  </h3>
                  <p style={{color: '#6b7280'}}>Try adjusting your search criteria.</p>
                </div>
              ) : (
                <div className="packages-grid">
                  {filteredPackages.map(pkg => {
                    const qualityScore = qualityScores[pkg.id];
                    const hasQuality = qualityScore && qualityScore.total_reviews > 0;
                    const overallRating = hasQuality ? qualityScore.scores.overall_rating : 0;

                    return (
                      <div key={pkg.id} className="package-card">
                        <div className="package-header">
                          <div>
                            <h3 className="package-title">{pkg.name}</h3>
                            <p className="package-supplier">by {pkg.supplier}</p>
                          </div>
                          <div className="package-price">${pkg.price_per_query}</div>
                        </div>

                        <p className="package-description">{pkg.description}</p>

                        <div className="tags">
                          <span className="tag category">{pkg.category}</span>
                          {pkg.tags?.slice(0, 2).map(tag => (
                            <span key={tag} className="tag">{tag}</span>
                          ))}
                          {pkg.tags?.length > 2 && (
                            <span className="tag">+{pkg.tags.length - 2} more</span>
                          )}
                        </div>

                        {hasQuality ? (
                          <div className="quality-section">
                            <div className="quality-header">
                              <span className="quality-label">Quality Score</span>
                              <span className="quality-score">{overallRating.toFixed(1)}/10</span>
                            </div>
                            <p className="quality-meta">
                              Based on {qualityScore.total_reviews} reviews
                            </p>
                          </div>
                        ) : (
                          <div className="quality-section">
                            <span className="quality-meta">Not yet reviewed</span>
                          </div>
                        )}

                        <div className="package-actions">
                          <button 
                            onClick={() => showIntegrationCode(pkg.id, pkg.name)}
                            className="btn btn-primary"
                          >
                            <ExternalLink style={{width: '1rem', height: '1rem'}} />
                            Use Package
                          </button>
                          <button 
                            onClick={() => showSampleData(pkg.id)}
                            className="btn"
                          >
                            <Eye style={{width: '1rem', height: '1rem'}} />
                            Sample
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Integration Guide */}
          <div style={{borderTop: '1px solid #e5e7eb', paddingTop: '3rem', marginTop: '3rem'}}>
            <div style={{textAlign: 'center', marginBottom: '2rem'}}>
              <h2 style={{fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem'}}>
                Quick Integration
              </h2>
              <p style={{color: '#6b7280', maxWidth: '600px', margin: '0 auto'}}>
                Get started with SquidPro in 3 simple steps
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '2rem'
            }}>
              <div style={{
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                padding: '1.5rem'
              }}>
                <h3 style={{fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem'}}>
                  1. Get an API Token
                </h3>
                <div style={{
                  background: '#1f2937',
                  color: '#e5e7eb',
                  padding: '1rem',
                  borderRadius: '0.375rem',
                  fontFamily: 'Monaco, monospace',
                  fontSize: '0.875rem',
                  overflowX: 'auto'
                }}>
                  <pre>{`curl -X POST http://localhost:8100/mint \\
  -H "Content-Type: application/json" \\
  -d '{"agent_id":"my-ai-agent","credits":10.0}'`}</pre>
                </div>
              </div>

              <div style={{
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                padding: '1.5rem'
              }}>
                <h3 style={{fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem'}}>
                  2. Query Any Data Package
                </h3>
                <div style={{
                  background: '#1f2937',
                  color: '#e5e7eb',
                  padding: '1rem',
                  borderRadius: '0.375rem',
                  fontFamily: 'Monaco, monospace',
                  fontSize: '0.875rem',
                  overflowX: 'auto'
                }}>
                  <pre>{`curl -H "Authorization: Bearer YOUR_TOKEN" \\
  "http://localhost:8100/data/package/1"`}</pre>
                </div>
              </div>

              <div style={{
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                padding: '1.5rem'
              }}>
                <h3 style={{fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem'}}>
                  3. Get Data + Receipt
                </h3>
                <div style={{
                  background: '#1f2937',
                  color: '#e5e7eb',
                  padding: '1rem',
                  borderRadius: '0.375rem',
                  fontFamily: 'Monaco, monospace',
                  fontSize: '0.875rem',
                  overflowX: 'auto'
                }}>
                  <pre>{`{
  "trace_id": "...",
  "data": {"price": 65000.50},
  "cost": 0.005,
  "payout": {"supplier": 0.0035}
}`}</pre>
                </div>
              </div>
            </div>

            <div style={{textAlign: 'center', marginTop: '2rem'}}>
              <a
                href="http://localhost:8100/profile.html"
                className="btn"
                style={{
                  display: 'inline-flex',
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem'
                }}
              >
                Create Account to Get Started
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DataCatalog;
