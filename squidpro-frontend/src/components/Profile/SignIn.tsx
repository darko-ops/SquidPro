import React, { useState } from 'react';
import { 
  Key, 
  User, 
  Loader,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';

interface SignInProps {
  onSignInSuccess: (apiKeys: Record<string, string>) => void;
  onSwitchToCreateAccount: () => void;
}

const SignIn: React.FC<SignInProps> = ({ onSignInSuccess, onSwitchToCreateAccount }) => {
  const [form, setForm] = useState({
    apiKey: '',
    isLoading: false,
    error: '',
    showApiKey: false
  });

  const handleApiKeySignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.apiKey) {
      setForm(prev => ({ ...prev, error: 'Please enter your API key' }));
      return;
    }

    setForm(prev => ({ ...prev, isLoading: true, error: '' }));

    try {
      // Determine API key type and test it
      let apiKeys: Record<string, string> = {};
      let userType = '';
      
      if (form.apiKey.startsWith('sup_')) {
        console.log('Testing supplier API key...');
        const response = await fetch('http://localhost:8100/suppliers/me', {
          headers: { 'X-API-Key': form.apiKey }
        });
        
        if (response.ok) {
          apiKeys.supplier = form.apiKey;
          userType = 'supplier';
          console.log('Supplier API key valid');
        } else {
          throw new Error('Invalid supplier API key');
        }
      } else if (form.apiKey.startsWith('rev_')) {
        console.log('Testing reviewer API key...');
        const response = await fetch('http://localhost:8100/reviewers/me', {
          headers: { 'X-API-Key': form.apiKey }
        });
        
        if (response.ok) {
          apiKeys.reviewer = form.apiKey;
          userType = 'reviewer';
          console.log('Reviewer API key valid');
        } else {
          throw new Error('Invalid reviewer API key');
        }
      } else {
        throw new Error('Invalid API key format. Must start with "sup_" or "rev_"');
      }

      // Check if user has additional roles by trying to find accounts with same email
      if (userType === 'supplier') {
        console.log('Checking for additional reviewer access...');
        // Get supplier data first
        const supplierResponse = await fetch('http://localhost:8100/suppliers/me', {
          headers: { 'X-API-Key': form.apiKey }
        });
        
        if (supplierResponse.ok) {
          const supplierData = await supplierResponse.json();
          
          // Try to register as reviewer with same details to get reviewer API key
          // (This is a bit of a hack - ideally we'd have a better way to link accounts)
          try {
            const reviewerResponse = await fetch('http://localhost:8100/reviewers/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: supplierData.name,
                email: supplierData.email,
                stellar_address: supplierData.stellar_address,
                specializations: ['data-quality', 'general']
              })
            });
            
            if (reviewerResponse.ok) {
              const reviewerData = await reviewerResponse.json();
              apiKeys.reviewer = reviewerData.api_key;
              console.log('Also registered as reviewer');
            } else if (reviewerResponse.status === 409) {
              console.log('Reviewer account already exists for this user');
              // Could implement API to get reviewer API key by email here
            }
          } catch (error) {
            console.log('Could not register reviewer account:', error);
          }
        }
      } else if (userType === 'reviewer') {
        console.log('Checking for additional supplier access...');
        // Get reviewer data first
        const reviewerResponse = await fetch('http://localhost:8100/reviewers/me', {
          headers: { 'X-API-Key': form.apiKey }
        });
        
        if (reviewerResponse.ok) {
          const reviewerData = await reviewerResponse.json();
          
          // Try to register as supplier with same details
          try {
            const supplierResponse = await fetch('http://localhost:8100/suppliers/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: reviewerData.name,
                email: reviewerData.email,
                stellar_address: reviewerData.stellar_address
              })
            });
            
            if (supplierResponse.ok) {
              const supplierData = await supplierResponse.json();
              apiKeys.supplier = supplierData.api_key;
              console.log('Also registered as supplier');
            } else if (supplierResponse.status === 409) {
              console.log('Supplier account already exists for this user');
              // Could implement API to get supplier API key by email here
            }
          } catch (error) {
            console.log('Could not register supplier account:', error);
          }
        }
      }

      console.log('Sign in successful with API keys:', apiKeys);
      onSignInSuccess(apiKeys);
      
    } catch (error) {
      console.error('Sign in failed:', error);
      setForm(prev => ({ 
        ...prev, 
        error: (error as Error).message 
      }));
    } finally {
      setForm(prev => ({ ...prev, isLoading: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* API Key Sign In */}
      <form onSubmit={handleApiKeySignIn} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Key className="w-4 h-4 inline mr-2" />
            API Key
          </label>
          <div className="relative">
            <input
              type={form.showApiKey ? 'text' : 'password'}
              value={form.apiKey}
              onChange={(e) => setForm(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="sup_... or rev_..."
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              required
            />
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, showApiKey: !prev.showApiKey }))}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              {form.showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Enter your SquidPro API key to access your account
          </p>
        </div>

        {form.error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm flex items-start">
            <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
            {form.error}
          </div>
        )}

        <button
          type="submit"
          disabled={form.isLoading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center"
        >
          {form.isLoading ? (
            <>
              <Loader className="animate-spin h-4 w-4 mr-2" />
              Signing in...
            </>
          ) : (
            <>
              <User className="h-4 w-4 mr-2" />
              Sign In
            </>
          )}
        </button>
      </form>

      {/* Create Account Link */}
      <div className="text-center">
        <p className="text-sm text-gray-600">
          Don't have an account?{' '}
          <button
            onClick={onSwitchToCreateAccount}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Create one here
          </button>
        </p>
      </div>

      {/* Help Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
        <h4 className="font-medium text-gray-900 mb-2">API Key Format</h4>
        <div className="text-sm text-gray-600 space-y-1">
          <p>• <strong>Supplier API Key:</strong> Starts with "sup_" - for data providers</p>
          <p>• <strong>Reviewer API Key:</strong> Starts with "rev_" - for quality reviewers</p>
          <p>• Your API key was provided when you registered your account</p>
        </div>
      </div>

      {/* Demo Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="font-medium text-blue-900 mb-2">Test the System</h4>
        <p className="text-sm text-blue-700 mb-3">
          Create a new account above to get your API keys, or browse the catalog without signing in.
        </p>
        <div className="space-y-2">
          <div className="bg-white border border-blue-200 rounded p-2 text-xs">
            <strong>After creating an account:</strong><br/>
            • Copy your API key from the success screen<br/>
            • Return here and paste it to sign in<br/>
            • Access your personalized dashboard
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;