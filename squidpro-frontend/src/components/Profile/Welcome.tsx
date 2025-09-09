import React from 'react';
import { 
  Database, 
  ShoppingCart, 
  Shield, 
  ArrowRight,
  DollarSign,
  Star,
  TrendingUp,
  Package
} from 'lucide-react';

interface WelcomeProps {
  userRoles: {
    supplier?: any;
    reviewer?: any;
  };
  onNavigateToRole: (role: 'buying' | 'supplying' | 'reviewing') => void;
  onLogout: () => void;
}

const Welcome: React.FC<WelcomeProps> = ({ userRoles, onNavigateToRole, onLogout }) => {
  const userName = userRoles.supplier?.name || userRoles.reviewer?.name || 'User';
  
  // Safely access user roles
  const safeUserRoles = userRoles || {};
  
  // Determine available roles
  const availableRoles = [];
  if (safeUserRoles.supplier || safeUserRoles.reviewer) availableRoles.push('buying'); // Everyone can buy
  if (safeUserRoles.supplier) availableRoles.push('supplying');
  if (safeUserRoles.reviewer) availableRoles.push('reviewing');

  const roleCards = [
    {
      id: 'buying' as const,
      title: 'Data Buyer',
      description: 'Purchase high-quality data for your AI agents and applications',
      icon: ShoppingCart,
      color: 'bg-blue-600',
      hoverColor: 'hover:bg-blue-700',
      features: ['Browse Data Catalog', 'Quality Scores', 'Instant Access'],
      available: true // Everyone can buy
    },
    {
      id: 'supplying' as const,
      title: 'Data Supplier',
      description: 'Upload and monetize your datasets, earn XLM for every query',
      icon: Database,
      color: 'bg-green-600',
      hoverColor: 'hover:bg-green-700',
      features: ['Upload Datasets', 'Set Pricing', 'Track Revenue'],
      available: !!safeUserRoles.supplier
    },
    {
      id: 'reviewing' as const,
      title: 'Quality Reviewer',
      description: 'Review data quality and earn rewards for maintaining platform standards',
      icon: Shield,
      color: 'bg-purple-600',
      hoverColor: 'hover:bg-purple-700',
      features: ['Review Tasks', 'Earn Rewards', 'Build Reputation'],
      available: !!safeUserRoles.reviewer
    }
  ];

  // Quick stats
  const supplierStats = safeUserRoles.supplier ? {
    balance: safeUserRoles.supplier.balance || 0,
    packages: safeUserRoles.supplier.package_count || 0
  } : null;

  const reviewerStats = safeUserRoles.reviewer ? {
    balance: safeUserRoles.reviewer.balance || 0,
    reviews: safeUserRoles.reviewer.stats?.total_reviews || 0,
    reputation: safeUserRoles.reviewer.reputation_level || 'Novice'
  } : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-between items-center mb-8">
            <div></div>
            <h1 className="text-4xl font-bold text-gray-900">
              Welcome back, {userName}! 👋
            </h1>
            <button
              onClick={onLogout}
              className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Logout
            </button>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Choose your role to access your personalized dashboard and start using SquidPro
          </p>
        </div>

        {/* Quick Stats Overview */}
        {(supplierStats || reviewerStats) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {supplierStats && (
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center">
                  <DollarSign className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Supplier Balance</p>
                    <p className="text-2xl font-bold text-gray-900">${supplierStats.balance.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}
            
            {supplierStats && (
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center">
                  <Package className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Data Packages</p>
                    <p className="text-2xl font-bold text-gray-900">{supplierStats.packages}</p>
                  </div>
                </div>
              </div>
            )}

            {reviewerStats && (
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center">
                  <Star className="h-8 w-8 text-yellow-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Reviews Completed</p>
                    <p className="text-2xl font-bold text-gray-900">{reviewerStats.reviews}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Role Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {roleCards.map((role) => {
            const Icon = role.icon;
            const isAvailable = role.available;
            
            return (
              <div
                key={role.id}
                className={`bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden transition-all duration-300 ${
                  isAvailable 
                    ? 'hover:shadow-xl hover:-translate-y-2 cursor-pointer' 
                    : 'opacity-50 cursor-not-allowed'
                }`}
                onClick={() => isAvailable && onNavigateToRole(role.id)}
              >
                <div className={`${role.color} p-6 text-white`}>
                  <div className="flex items-center justify-between mb-4">
                    <Icon className="h-8 w-8" />
                    {isAvailable && <ArrowRight className="h-5 w-5" />}
                  </div>
                  <h3 className="text-xl font-bold mb-2">{role.title}</h3>
                  <p className="text-blue-100 text-sm">{role.description}</p>
                </div>
                
                <div className="p-6">
                  <ul className="space-y-2">
                    {role.features.map((feature, index) => (
                      <li key={index} className="flex items-center text-sm text-gray-600">
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-3"></div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  {isAvailable ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToRole(role.id);
                      }}
                      className={`w-full mt-4 ${role.color} ${role.hoverColor} text-white py-2 px-4 rounded-md transition-colors font-medium flex items-center justify-center`}
                    >
                      Access Dashboard
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </button>
                  ) : (
                    <div className="w-full mt-4 bg-gray-200 text-gray-500 py-2 px-4 rounded-md text-center font-medium">
                      Not Available
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-6 text-center">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => onNavigateToRole('buying')}
              className="bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 py-3 px-4 rounded-md transition-colors font-medium flex items-center justify-center"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Browse Data Catalog
            </button>
            
            {safeUserRoles.supplier && (
              <button
                onClick={() => onNavigateToRole('supplying')}
                className="bg-green-50 hover:bg-green-100 border border-green-200 text-green-800 py-3 px-4 rounded-md transition-colors font-medium flex items-center justify-center"
              >
                <Database className="h-4 w-4 mr-2" />
                Upload New Dataset
              </button>
            )}
            
            {safeUserRoles.reviewer && (
              <button
                onClick={() => onNavigateToRole('reviewing')}
                className="bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 py-3 px-4 rounded-md transition-colors font-medium flex items-center justify-center"
              >
                <Shield className="h-4 w-4 mr-2" />
                Find Review Tasks
              </button>
            )}
          </div>
        </div>

        {/* Account Information */}
        <div className="mt-8 bg-gray-50 rounded-lg border border-gray-200 p-6">
          <h4 className="text-sm font-medium text-gray-900 mb-4">Account Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Email:</span>
              <span className="ml-2 text-gray-900">{safeUserRoles.supplier?.email || safeUserRoles.reviewer?.email || 'Not available'}</span>
            </div>
            <div>
              <span className="text-gray-600">Stellar Address:</span>
              <span className="ml-2 text-gray-900 font-mono text-xs">
                {(safeUserRoles.supplier?.stellar_address || safeUserRoles.reviewer?.stellar_address)?.slice(0, 10)}...
              </span>
            </div>
            <div>
              <span className="text-gray-600">Member Since:</span>
              <span className="ml-2 text-gray-900">
                {new Date(safeUserRoles.supplier?.created_at || safeUserRoles.reviewer?.created_at || Date.now()).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;