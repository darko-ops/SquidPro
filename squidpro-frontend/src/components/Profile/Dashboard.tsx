import React, { useState } from 'react';
import { 
  User, 
  DollarSign, 
  Package, 
  Star, 
  LogOut, 
  Loader,
  ShoppingCart,
  Database,
  Shield,
  Plus,
  Eye,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface DashboardProps {
  userRoles: {
    supplier?: any;
    reviewer?: any;
  };
  apiKeys: {
    supplier?: string;
    reviewer?: string;
  };
  onLogout: () => void;
}

type TabType = 'buying' | 'supplying' | 'reviewing';

const Dashboard: React.FC<DashboardProps> = ({ userRoles, apiKeys, onLogout }) => {
  // Debug: Log the roles and API keys
  console.log('Dashboard Debug - userRoles:', userRoles);
  console.log('Dashboard Debug - apiKeys:', apiKeys);
  
  // Determine available tabs based on user roles
  const availableTabs = [];
  if (userRoles.supplier || userRoles.reviewer) availableTabs.push('buying'); // Everyone can buy
  if (userRoles.supplier) availableTabs.push('supplying');
  if (userRoles.reviewer) availableTabs.push('reviewing');

  console.log('Dashboard Debug - availableTabs:', availableTabs);

  const [activeTab, setActiveTab] = useState<TabType>(availableTabs[0] as TabType);

  // Get the primary user data (prefer supplier, fallback to reviewer)
  const primaryUserData = userRoles.supplier || userRoles.reviewer;

  const BuyingTab = () => (
    <div className="space-y-6">
      {/* Debug Section */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-medium text-yellow-800 mb-2">Debug Information</h4>
        <div className="text-sm text-yellow-700 space-y-1">
          <p><strong>API Keys:</strong> {Object.keys(apiKeys).join(', ') || 'None'}</p>
          <p><strong>User Roles:</strong> {Object.keys(userRoles).join(', ') || 'None'}</p>
          <p><strong>Available Tabs:</strong> {availableTabs.join(', ')}</p>
        </div>
      </div>

      {/* Buying Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <ShoppingCart className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Credits Available</p>
              <p className="text-2xl font-bold text-gray-900">$0.00</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <Database className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Queries This Month</p>
              <p className="text-2xl font-bold text-gray-900">0</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Spent</p>
              <p className="text-2xl font-bold text-gray-900">$0.00</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Purchases */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Purchases</h3>
        <div className="text-center py-8 text-gray-500">
          <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No purchases yet</p>
          <p className="text-sm">Your data queries and purchases will appear here</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button className="bg-blue-600 text-white px-4 py-3 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center">
            <Plus className="h-4 w-4 mr-2" />
            Add Credits
          </button>
          <button className="bg-gray-600 text-white px-4 py-3 rounded-md hover:bg-gray-700 transition-colors text-sm font-medium flex items-center justify-center">
            <Eye className="h-4 w-4 mr-2" />
            Browse Catalog
          </button>
        </div>
      </div>
    </div>
  );

  const SupplyingTab = () => {
    const supplierData = userRoles.supplier;
    
    return (
      <div className="space-y-6">
        {/* Supplier Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Current Balance</p>
                <p className="text-2xl font-bold text-gray-900">${(supplierData?.balance || 0).toFixed(2)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Data Packages</p>
                <p className="text-2xl font-bold text-gray-900">{supplierData?.package_count || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">$0.00</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <Eye className="h-8 w-8 text-indigo-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Queries</p>
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
            </div>
          </div>
        </div>

        {/* My Data Packages */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">My Data Packages</h3>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium flex items-center">
              <Plus className="h-4 w-4 mr-2" />
              Upload Dataset
            </button>
          </div>
          <div className="text-center py-8 text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No data packages uploaded yet</p>
            <p className="text-sm">Upload your first dataset to start earning</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Supplier Tools</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button className="bg-blue-600 text-white px-4 py-3 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium">
              Upload New Dataset
            </button>
            <button className="bg-gray-600 text-white px-4 py-3 rounded-md hover:bg-gray-700 transition-colors text-sm font-medium">
              View Analytics
            </button>
            <button className="bg-green-600 text-white px-4 py-3 rounded-md hover:bg-green-700 transition-colors text-sm font-medium">
              Request Payout
            </button>
          </div>
        </div>

        {/* API Key Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Supplier API Key</h3>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
            <code className="text-sm text-gray-600 break-all">{apiKeys.supplier}</code>
          </div>
          <p className="text-xs text-gray-500 mt-2">Use this API key for supplier operations</p>
        </div>
      </div>
    );
  };

  const ReviewingTab = () => {
    const reviewerData = userRoles.reviewer;
    
    return (
      <div className="space-y-6">
        {/* Reviewer Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Review Earnings</p>
                <p className="text-2xl font-bold text-gray-900">${(reviewerData?.balance || 0).toFixed(2)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <Star className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Reviews Completed</p>
                <p className="text-2xl font-bold text-gray-900">{reviewerData?.stats?.total_reviews || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Consensus Rate</p>
                <p className="text-2xl font-bold text-gray-900">{((reviewerData?.stats?.consensus_rate || 0) * 100).toFixed(0)}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Reputation</p>
                <p className="text-2xl font-bold text-gray-900 capitalize">{reviewerData?.reputation_level || 'Novice'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Specializations */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Specializations</h3>
          <div className="flex flex-wrap gap-2">
            {reviewerData?.specializations?.map((spec: string) => (
              <span key={spec} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full border border-blue-200">
                {spec}
              </span>
            )) || <span className="text-gray-500">No specializations set</span>}
          </div>
        </div>

        {/* Available Tasks */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Available Review Tasks</h3>
            <button className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors text-sm font-medium">
              Refresh Tasks
            </button>
          </div>
          <div className="text-center py-8 text-gray-500">
            <Star className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No review tasks available at the moment</p>
            <p className="text-sm">Check back later for new opportunities!</p>
          </div>
        </div>

        {/* Recent Reviews */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Reviews</h3>
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No reviews completed yet</p>
            <p className="text-sm">Your review history and earnings will appear here</p>
          </div>
        </div>

        {/* API Key Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Reviewer API Key</h3>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
            <code className="text-sm text-gray-600 break-all">{apiKeys.reviewer}</code>
          </div>
          <p className="text-xs text-gray-500 mt-2">Use this API key for reviewer operations</p>
        </div>
      </div>
    );
  };

  if (!primaryUserData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin h-8 w-8 text-gray-400" />
        <span className="ml-2 text-gray-600">Loading your dashboard...</span>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* User Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{primaryUserData.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-gray-600">SquidPro Account</span>
              <div className="flex gap-1">
                {userRoles.supplier && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">Supplier</span>
                )}
                {userRoles.reviewer && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">Reviewer</span>
                )}
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Buyer</span>
              </div>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>

        {/* Debug Section */}
        {!userRoles.reviewer && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-8">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-orange-800 mb-1">Missing Reviewer Access</h4>
                <p className="text-sm text-orange-700 mb-2">
                  You don't have reviewer access. This could be because:
                </p>
                <ul className="text-sm text-orange-700 list-disc list-inside space-y-1">
                  <li>You didn't select "Quality Reviewer" during registration</li>
                  <li>The reviewer registration failed</li>
                  <li>Your reviewer API key isn't working</li>
                </ul>
                <p className="text-sm text-orange-700 mt-2">
                  <strong>API Keys you have:</strong> {Object.keys(apiKeys).join(', ') || 'None'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Account Overview */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600">Email</label>
              <p className="text-gray-900">{primaryUserData.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">Stellar Address</label>
              <p className="text-gray-900 font-mono text-sm">{primaryUserData.stellar_address}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">Member Since</label>
              <p className="text-gray-900">{new Date(primaryUserData.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {availableTabs.includes('buying') && (
              <button
                onClick={() => setActiveTab('buying')}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === 'buying'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Buying
              </button>
            )}
            {availableTabs.includes('supplying') && (
              <button
                onClick={() => setActiveTab('supplying')}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === 'supplying'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Database className="h-4 w-4 mr-2" />
                Supplying
              </button>
            )}
            {availableTabs.includes('reviewing') && (
              <button
                onClick={() => setActiveTab('reviewing')}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === 'reviewing'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Shield className="h-4 w-4 mr-2" />
                Reviewing
              </button>
            )}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'buying' && <BuyingTab />}
        {activeTab === 'supplying' && <SupplyingTab />}
        {activeTab === 'reviewing' && <ReviewingTab />}
      </div>
    </div>
  );
};

export default Dashboard;