import React, { useState } from 'react';
import { 
  ChevronRight, 
  ChevronLeft,
  Database,
  ShoppingCart,
  Shield,
  Check,
  Loader
} from 'lucide-react';

interface CreateAccountProps {
  onAccountCreated: (apiKey: string, userType: 'supplier' | 'reviewer') => void;
  onSwitchToSignIn: () => void;
}

type RegistrationStep = 'basic-info' | 'role-selection' | 'role-details' | 'complete';

interface UserRoles {
  supplier: boolean;
  buyer: boolean;
  reviewer: boolean;
}

const CreateAccount: React.FC<CreateAccountProps> = ({ onAccountCreated, onSwitchToSignIn }) => {
  const [currentStep, setCurrentStep] = useState<RegistrationStep>('basic-info');
  
  const [form, setForm] = useState({
    // Basic info
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    stellarAddress: '',
    
    // Role selection
    roles: {
      supplier: false,
      buyer: false,
      reviewer: false
    } as UserRoles,
    
    // Role-specific details
    supplierCategories: '',
    reviewerSpecializations: '',
    
    // State
    isLoading: false,
    error: '',
    success: '',
    apiKeys: {} as Record<string, string>
  });

  const handleBasicInfoNext = () => {
    const { name, email, password, confirmPassword, stellarAddress } = form;
    
    if (!name || !email || !password || !stellarAddress) {
      setForm(prev => ({ ...prev, error: 'Please fill in all required fields' }));
      return;
    }
    
    if (password !== confirmPassword) {
      setForm(prev => ({ ...prev, error: 'Passwords do not match' }));
      return;
    }
    
    if (password.length < 6) {
      setForm(prev => ({ ...prev, error: 'Password must be at least 6 characters' }));
      return;
    }
    
    setForm(prev => ({ ...prev, error: '' }));
    setCurrentStep('role-selection');
  };

  const handleRoleSelectionNext = () => {
    const { roles } = form;
    
    if (!roles.supplier && !roles.buyer && !roles.reviewer) {
      setForm(prev => ({ ...prev, error: 'Please select at least one role' }));
      return;
    }
    
    setForm(prev => ({ ...prev, error: '' }));
    
    // If only buyer is selected, skip role details
    if (roles.buyer && !roles.supplier && !roles.reviewer) {
      handleCompleteRegistration();
    } else {
      setCurrentStep('role-details');
    }
  };

  const handleCompleteRegistration = async () => {
    setForm(prev => ({ ...prev, isLoading: true, error: '' }));

    try {
      const { roles } = form;
      const apiKeys: Record<string, string> = {};
      
      // Register as supplier if selected
      if (roles.supplier) {
        const supplierResponse = await fetch('http://localhost:8100/suppliers/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            stellar_address: form.stellarAddress
          })
        });
        
        if (supplierResponse.ok) {
          const data = await supplierResponse.json();
          apiKeys.supplier = data.api_key;
        }
      }
      
      // Register as reviewer if selected
      if (roles.reviewer) {
        const reviewerResponse = await fetch('http://localhost:8100/reviewers/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            stellar_address: form.stellarAddress,
            specializations: form.reviewerSpecializations.split(',').map(s => s.trim()).filter(s => s)
          })
        });
        
        if (reviewerResponse.ok) {
          const data = await reviewerResponse.json();
          apiKeys.reviewer = data.api_key;
        }
      }
      
      setForm(prev => ({ 
        ...prev, 
        isLoading: false,
        apiKeys,
        success: 'Account created successfully!'
      }));
      
      setCurrentStep('complete');
      
    } catch (error) {
      setForm(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: (error as Error).message 
      }));
    }
  };

  const handleLoginWithNewAccount = (role: 'supplier' | 'reviewer') => {
    const apiKey = form.apiKeys[role];
    if (apiKey) {
      onAccountCreated(apiKey, role);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-center space-x-4 mb-8">
        {['basic-info', 'role-selection', 'role-details', 'complete'].map((step, index) => (
          <div key={step} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === step 
                ? 'bg-blue-600 text-white' 
                : index < ['basic-info', 'role-selection', 'role-details', 'complete'].indexOf(currentStep)
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}>
              {index < ['basic-info', 'role-selection', 'role-details', 'complete'].indexOf(currentStep) ? (
                <Check className="w-4 h-4" />
              ) : (
                index + 1
              )}
            </div>
            {index < 3 && (
              <div className={`w-12 h-0.5 ${
                index < ['basic-info', 'role-selection', 'role-details', 'complete'].indexOf(currentStep)
                  ? 'bg-green-600'
                  : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {currentStep === 'basic-info' && (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Basic Information</h3>
            <p className="text-sm text-gray-600">Tell us about yourself</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Choose a username"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">This will be used to sign in to your account</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="your@email.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder="At least 6 characters"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="Confirm your password"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stellar Address *</label>
              <input
                type="text"
                value={form.stellarAddress}
                onChange={(e) => setForm(prev => ({ ...prev, stellarAddress: e.target.value }))}
                placeholder="GDXDSB444OLNDYOJAVGU3JWQO4BEGQT2..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">For receiving XLM payments</p>
            </div>
          </div>

          {form.error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {form.error}
            </div>
          )}

          <button
            onClick={handleBasicInfoNext}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            Next: Choose Your Roles
            <ChevronRight className="h-4 w-4 ml-2" />
          </button>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <button
                onClick={onSwitchToSignIn}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Sign in here
              </button>
            </p>
          </div>
        </div>
      )}

      {currentStep === 'role-selection' && (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Choose Your Roles</h3>
            <p className="text-sm text-gray-600">Select what you want to do on SquidPro (you can choose multiple)</p>
          </div>

          <div className="space-y-4">
            {/* Supplier Role */}
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.roles.supplier}
                  onChange={(e) => setForm(prev => ({
                    ...prev,
                    roles: { ...prev.roles, supplier: e.target.checked }
                  }))}
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <Database className="h-5 w-5 text-blue-600 mr-2" />
                    <span className="font-medium text-gray-900">Data Supplier</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Upload and sell your datasets to AI agents. Earn XLM for every query.
                  </p>
                </div>
              </label>
            </div>

            {/* Buyer Role */}
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.roles.buyer}
                  onChange={(e) => setForm(prev => ({
                    ...prev,
                    roles: { ...prev.roles, buyer: e.target.checked }
                  }))}
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <ShoppingCart className="h-5 w-5 text-green-600 mr-2" />
                    <span className="font-medium text-gray-900">Data Buyer</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Purchase high-quality data for your AI agents and applications.
                  </p>
                </div>
              </label>
            </div>

            {/* Reviewer Role */}
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.roles.reviewer}
                  onChange={(e) => setForm(prev => ({
                    ...prev,
                    roles: { ...prev.roles, reviewer: e.target.checked }
                  }))}
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <Shield className="h-5 w-5 text-purple-600 mr-2" />
                    <span className="font-medium text-gray-900">Quality Reviewer</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Review data quality and earn XLM rewards for maintaining platform standards.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {form.error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {form.error}
            </div>
          )}

          <div className="flex space-x-3">
            <button
              onClick={() => setCurrentStep('basic-info')}
              className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 transition-colors flex items-center justify-center"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </button>
            <button
              onClick={handleRoleSelectionNext}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </button>
          </div>
        </div>
      )}

      {currentStep === 'role-details' && (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Role Details</h3>
            <p className="text-sm text-gray-600">Additional information for your selected roles</p>
          </div>

          <div className="space-y-4">
            {form.roles.supplier && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier Categories (Optional)
                </label>
                <input
                  type="text"
                  value={form.supplierCategories}
                  onChange={(e) => setForm(prev => ({ ...prev, supplierCategories: e.target.value }))}
                  placeholder="financial, crypto, real-estate"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Comma-separated categories you'll supply</p>
              </div>
            )}

            {form.roles.reviewer && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Review Specializations
                </label>
                <input
                  type="text"
                  value={form.reviewerSpecializations}
                  onChange={(e) => setForm(prev => ({ ...prev, reviewerSpecializations: e.target.value }))}
                  placeholder="financial, crypto, real-time, accuracy"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Comma-separated areas of expertise</p>
              </div>
            )}
          </div>

          {form.error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {form.error}
            </div>
          )}

          <div className="flex space-x-3">
            <button
              onClick={() => setCurrentStep('role-selection')}
              className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 transition-colors flex items-center justify-center"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </button>
            <button
              onClick={handleCompleteRegistration}
              disabled={form.isLoading}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center"
            >
              {form.isLoading ? (
                <>
                  <Loader className="animate-spin h-4 w-4 mr-2" />
                  Creating Account...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Create Account
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {currentStep === 'complete' && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Account Created Successfully!</h3>
            <p className="text-sm text-gray-600">Your SquidPro account is now active</p>
          </div>

          {form.success && (
            <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md text-sm">
              {form.success}
            </div>
          )}

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-900">Your API Keys:</h4>
            {Object.entries(form.apiKeys).map(([role, apiKey]) => (
              <div key={role} className="bg-gray-50 border border-gray-200 rounded-md p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700 capitalize">{role} API Key:</span>
                  <button
                    onClick={() => handleLoginWithNewAccount(role as 'supplier' | 'reviewer')}
                    className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                  >
                    Use This Account
                  </button>
                </div>
                <code className="text-xs text-gray-600 break-all">{apiKey}</code>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <p className="text-sm text-blue-800">
              <strong>Important:</strong> Save your API keys securely. You'll need them to access your account features.
            </p>
          </div>

          <button
            onClick={() => {
              // Auto-login with all API keys
              if (Object.keys(form.apiKeys).length > 0) {
                onAccountCreated(form.apiKeys);
              } else {
                onSwitchToSignIn();
              }
            }}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Continue to Dashboard
          </button>
        </div>
      )}
    </div>
  );
};

export default CreateAccount;