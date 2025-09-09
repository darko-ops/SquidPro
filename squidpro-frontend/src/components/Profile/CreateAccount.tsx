import React, { useState } from 'react';
import { 
  ChevronRight, 
  ChevronLeft,
  Database,
  ShoppingCart,
  Shield,
  Check,
  Loader,
  AlertCircle
} from 'lucide-react';

interface CreateAccountProps {
  onAccountCreated: (apiKeys: Record<string, string>) => void;
  onSwitchToSignIn: () => void;
}

type RegistrationStep = 'basic-info' | 'role-selection' | 'role-details' | 'complete';

const CreateAccount: React.FC<CreateAccountProps> = ({ onAccountCreated, onSwitchToSignIn }) => {
  const [currentStep, setCurrentStep] = useState<RegistrationStep>('basic-info');
  
  const [form, setForm] = useState({
    // Basic info
    name: '',
    email: '',
    stellarAddress: '',
    
    // Role selection
    roles: {
      buyer: false,
      supplier: false,
      reviewer: false
    },
    
    // Role-specific details
    reviewerSpecializations: '',
    
    // State
    isLoading: false,
    error: '',
    success: '',
    apiKeys: {} as Record<string, string>
  });

  const validateStellarAddress = (address: string): boolean => {
    return address.length === 56 && address.startsWith('G');
  };

  const handleBasicInfoNext = () => {
    const { name, email, stellarAddress } = form;
    
    if (!name || !email || !stellarAddress) {
      setForm(prev => ({ ...prev, error: 'Please fill in all required fields' }));
      return;
    }

    if (!validateStellarAddress(stellarAddress)) {
      setForm(prev => ({ ...prev, error: 'Please enter a valid Stellar address (starts with G, 56 characters)' }));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setForm(prev => ({ ...prev, error: 'Please enter a valid email address' }));
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
    
    // If reviewer is selected, go to role details for specializations
    if (roles.reviewer) {
      setCurrentStep('role-details');
    } else {
      handleCompleteRegistration();
    }
  };

  const handleCompleteRegistration = async () => {
    setForm(prev => ({ ...prev, isLoading: true, error: '' }));

    try {
      const { roles } = form;
      const apiKeys: Record<string, string> = {};
      const registrationResults: string[] = [];
      
      // Register as supplier if selected
      if (roles.supplier) {
        try {
          console.log('Registering supplier...');
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
            console.log('Supplier registration response:', data);
            apiKeys.supplier = data.api_key;
            registrationResults.push('Supplier account created');
          } else {
            const errorData = await supplierResponse.json();
            throw new Error(`Supplier registration failed: ${errorData.detail || 'Unknown error'}`);
          }
        } catch (error) {
          console.error('Supplier registration error:', error);
          throw new Error(`Failed to create supplier account: ${(error as Error).message}`);
        }
      }
      
      // Register as reviewer if selected
      if (roles.reviewer) {
        try {
          console.log('Registering reviewer...');
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
            console.log('Reviewer registration response:', data);
            apiKeys.reviewer = data.api_key;
            registrationResults.push('Reviewer account created');
          } else {
            const errorData = await reviewerResponse.json();
            throw new Error(`Reviewer registration failed: ${errorData.detail || 'Unknown error'}`);
          }
        } catch (error) {
          console.error('Reviewer registration error:', error);
          throw new Error(`Failed to create reviewer account: ${(error as Error).message}`);
        }
      }

      if (Object.keys(apiKeys).length === 0) {
        // If only buyer role was selected, we don't have registration for that yet
        // So we'll just show success and let them sign in later
        setForm(prev => ({ 
          ...prev, 
          isLoading: false,
          success: 'Account information saved! You can now browse the catalog as a buyer.',
          apiKeys: { buyer: 'buyer_placeholder' } // Placeholder for buyer-only accounts
        }));
      } else {
        setForm(prev => ({ 
          ...prev, 
          isLoading: false,
          apiKeys,
          success: `Account created successfully! ${registrationResults.join(' and ')}.`
        }));
      }
      
      setCurrentStep('complete');
      
    } catch (error) {
      console.error('Registration error:', error);
      setForm(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: (error as Error).message 
      }));
    }
  };

  const handleLoginWithNewAccount = () => {
    console.log('Logging in with new account API keys:', form.apiKeys);
    if (Object.keys(form.apiKeys).length > 0) {
      onAccountCreated(form.apiKeys);
    } else {
      setForm(prev => ({ ...prev, error: 'No API keys available. Please try registering again.' }));
    }
  };

  const handleRoleToggle = (role: keyof typeof form.roles) => {
    setForm(prev => ({
      ...prev,
      roles: {
        ...prev.roles,
        [role]: !prev.roles[role]
      }
    }));
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

      {/* Basic Info Step */}
      {currentStep === 'basic-info' && (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Basic Information</h3>
            <p className="text-sm text-gray-600">Tell us about yourself</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Your full name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Stellar Address *</label>
              <input
                type="text"
                value={form.stellarAddress}
                onChange={(e) => setForm(prev => ({ ...prev, stellarAddress: e.target.value }))}
                placeholder="GDXDSB444OLNDYOJAVGU3JWQO4BEGQT2..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                required
              />
              <p className="text-xs text-gray-500 mt-1">For receiving XLM payments</p>
            </div>
          </div>

          {form.error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm flex items-start">
              <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
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

      {/* Role Selection Step */}
      {currentStep === 'role-selection' && (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Choose Your Roles</h3>
            <p className="text-sm text-gray-600">Select what you want to do on SquidPro</p>
          </div>

          <div className="space-y-4">
            {/* Buyer Role */}
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.roles.buyer}
                  onChange={() => handleRoleToggle('buyer')}
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

            {/* Supplier Role */}
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.roles.supplier}
                  onChange={() => handleRoleToggle('supplier')}
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

            {/* Reviewer Role */}
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.roles.reviewer}
                  onChange={() => handleRoleToggle('reviewer')}
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
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm flex items-start">
              <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
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

      {/* Role Details Step */}
      {currentStep === 'role-details' && (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Role Details</h3>
            <p className="text-sm text-gray-600">Additional information for your selected roles</p>
          </div>

          <div className="space-y-4">
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
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm flex items-start">
              <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
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

      {/* Complete Step */}
      {currentStep === 'complete' && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Account Created Successfully!</h3>
            <p className="text-sm text-gray-600">Welcome to SquidPro</p>
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
                </div>
                <code className="text-xs text-gray-600 break-all block mb-2">{apiKey}</code>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <p className="text-sm text-blue-800">
              <strong>Important:</strong> Save your API keys securely. You'll need them to access your account features.
            </p>
          </div>

          {form.error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm flex items-start">
              <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
              {form.error}
            </div>
          )}

          <button
            onClick={handleLoginWithNewAccount}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Continue to Dashboard
          </button>

          <div className="text-center">
            <button
              onClick={onSwitchToSignIn}
              className="text-gray-600 hover:text-gray-900 text-sm"
            >
              Sign in with a different account
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateAccount;