import React, { useState } from 'react';
import { 
  ChevronRight, 
  ChevronLeft,
  Database,
  ShoppingCart,
  Shield,
  Check,
  Loader,
  AlertCircle,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';

interface CreateAccountProps {
  onAccountCreated: (authData: { sessionToken: string; user: any }) => void;
  onSwitchToSignIn: () => void;
}

type RegistrationStep = 'basic-info' | 'credentials' | 'role-selection' | 'complete';

const CreateAccount: React.FC<CreateAccountProps> = ({ onAccountCreated, onSwitchToSignIn }) => {
  const [currentStep, setCurrentStep] = useState<RegistrationStep>('basic-info');
  
  const [form, setForm] = useState({
    // Basic info
    name: '',
    email: '',
    stellarAddress: '',
    
    // Credentials
    username: '',
    password: '',
    repeatPassword: '',
    showPassword: false,
    showRepeatPassword: false,
    
    // Role selection
    roles: {
      buyer: true, // Everyone is a buyer by default
      supplier: false,
      reviewer: false
    },
    
    // Role-specific details
    reviewerSpecializations: '',
    
    // State
    isLoading: false,
    error: '',
    success: '',
    
    // Validation
    validation: {
      username: { available: false, message: '', checking: false },
      email: { available: false, message: '', checking: false }
    }
  });

  const validateStellarAddress = (address: string): boolean => {
    return address.length === 56 && address.startsWith('G');
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): boolean => {
    return password.length >= 8;
  };

  const checkUsernameAvailability = async (username: string) => {
    if (username.length < 3) {
      setForm(prev => ({ 
        ...prev, 
        validation: { 
          ...prev.validation, 
          username: { available: false, message: 'Username must be at least 3 characters', checking: false }
        }
      }));
      return;
    }

    setForm(prev => ({ 
      ...prev, 
      validation: { 
        ...prev.validation, 
        username: { available: false, message: 'Checking availability...', checking: true }
      }
    }));

    try {
      const response = await fetch(`http://localhost:8100/auth/check-username?username=${encodeURIComponent(username)}`);
      const data = await response.json();
      
      setForm(prev => ({ 
        ...prev, 
        validation: { 
          ...prev.validation, 
          username: { available: data.available, message: data.message, checking: false }
        }
      }));
    } catch (error) {
      setForm(prev => ({ 
        ...prev, 
        validation: { 
          ...prev.validation, 
          username: { available: false, message: 'Error checking username', checking: false }
        }
      }));
    }
  };

  const checkEmailAvailability = async (email: string) => {
    if (!validateEmail(email)) {
      setForm(prev => ({ 
        ...prev, 
        validation: { 
          ...prev.validation, 
          email: { available: false, message: 'Please enter a valid email', checking: false }
        }
      }));
      return;
    }

    setForm(prev => ({ 
      ...prev, 
      validation: { 
        ...prev.validation, 
        email: { available: false, message: 'Checking availability...', checking: true }
      }
    }));

    try {
      const response = await fetch(`http://localhost:8100/auth/check-email?email=${encodeURIComponent(email)}`);
      const data = await response.json();
      
      setForm(prev => ({ 
        ...prev, 
        validation: { 
          ...prev.validation, 
          email: { available: data.available, message: data.message, checking: false }
        }
      }));
    } catch (error) {
      setForm(prev => ({ 
        ...prev, 
        validation: { 
          ...prev.validation, 
          email: { available: false, message: 'Error checking email', checking: false }
        }
      }));
    }
  };

  const handleBasicInfoNext = () => {
    const { name, email, stellarAddress } = form;
    
    if (!name || !email || !stellarAddress) {
      setForm(prev => ({ ...prev, error: 'Please fill in all required fields' }));
      return;
    }

    if (!validateEmail(email)) {
      setForm(prev => ({ ...prev, error: 'Please enter a valid email address' }));
      return;
    }

    if (!validateStellarAddress(stellarAddress)) {
      setForm(prev => ({ ...prev, error: 'Please enter a valid Stellar address (starts with G, 56 characters)' }));
      return;
    }
    
    setForm(prev => ({ ...prev, error: '' }));
    setCurrentStep('credentials');
  };

  const handleCredentialsNext = () => {
    const { username, password, repeatPassword, validation } = form;
    
    if (!username || !password || !repeatPassword) {
      setForm(prev => ({ ...prev, error: 'Please fill in all credential fields' }));
      return;
    }

    if (!validation.username.available) {
      setForm(prev => ({ ...prev, error: 'Please choose an available username' }));
      return;
    }

    if (!validation.email.available) {
      setForm(prev => ({ ...prev, error: 'Please use an available email address' }));
      return;
    }

    if (!validatePassword(password)) {
      setForm(prev => ({ ...prev, error: 'Password must be at least 8 characters long' }));
      return;
    }

    if (password !== repeatPassword) {
      setForm(prev => ({ ...prev, error: 'Passwords do not match' }));
      return;
    }
    
    setForm(prev => ({ ...prev, error: '' }));
    setCurrentStep('role-selection');
  };

  const handleCompleteRegistration = async () => {
    setForm(prev => ({ ...prev, isLoading: true, error: '' }));

    try {
      const { roles } = form;
      const selectedRoles = Object.keys(roles).filter(role => roles[role as keyof typeof roles]);
      
      if (selectedRoles.length === 0) {
        throw new Error('Please select at least one role');
      }

      console.log('Registering user with unified auth system...');
      
      const registrationData = {
        username: form.username,
        name: form.name,
        email: form.email,
        password: form.password,
        repeat_password: form.repeatPassword,
        stellar_address: form.stellarAddress,
        roles: selectedRoles
      };

      const response = await fetch('http://localhost:8100/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationData)
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Registration successful:', data);
        
        setForm(prev => ({ 
          ...prev, 
          success: `Account created successfully! You now have access to: ${selectedRoles.join(', ')} features.`
        }));
        
        setCurrentStep('complete');
        
        // Auto-login the user after successful registration
        setTimeout(async () => {
          try {
            const loginResponse = await fetch('http://localhost:8100/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username: form.username,
                password: form.password
              })
            });
            
            if (loginResponse.ok) {
              const loginData = await loginResponse.json();
              console.log('Auto-login successful:', loginData);
              
              onAccountCreated({
                sessionToken: loginData.session_token,
                user: loginData.user
              });
            } else {
              console.warn('Auto-login failed, user will need to sign in manually');
            }
          } catch (error) {
            console.warn('Auto-login error:', error);
          }
        }, 2000);
        
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Registration failed');
      }
      
    } catch (error) {
      console.error('Registration error:', error);
      setForm(prev => ({ 
        ...prev, 
        error: (error as Error).message 
      }));
    } finally {
      setForm(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleRoleToggle = (role: keyof typeof form.roles) => {
    // Buyer role is always enabled
    if (role === 'buyer') return;
    
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
        {['basic-info', 'credentials', 'role-selection', 'complete'].map((step, index) => (
          <div key={step} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === step 
                ? 'bg-blue-600 text-white' 
                : index < ['basic-info', 'credentials', 'role-selection', 'complete'].indexOf(currentStep)
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}>
              {index < ['basic-info', 'credentials', 'role-selection', 'complete'].indexOf(currentStep) ? (
                <Check className="w-4 h-4" />
              ) : (
                index + 1
              )}
            </div>
            {index < 3 && (
              <div className={`w-12 h-0.5 ${
                index < ['basic-info', 'credentials', 'role-selection', 'complete'].indexOf(currentStep)
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-2" />
                Full Name *
              </label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Mail className="w-4 h-4 inline mr-2" />
                Email Address *
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => {
                  setForm(prev => ({ ...prev, email: e.target.value }));
                  if (e.target.value && validateEmail(e.target.value)) {
                    checkEmailAvailability(e.target.value);
                  }
                }}
                placeholder="your@email.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              {form.validation.email.message && (
                <p className={`text-xs mt-1 ${
                  form.validation.email.checking ? 'text-gray-500' :
                  form.validation.email.available ? 'text-green-600' : 'text-red-600'
                }`}>
                  {form.validation.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stellar Address *
              </label>
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
            Next: Set Credentials
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

      {/* Credentials Step */}
      {currentStep === 'credentials' && (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Account Credentials</h3>
            <p className="text-sm text-gray-600">Choose your username and password</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-2" />
                Username *
              </label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => {
                  setForm(prev => ({ ...prev, username: e.target.value }));
                  if (e.target.value.length >= 3) {
                    checkUsernameAvailability(e.target.value);
                  }
                }}
                placeholder="Choose a unique username"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              {form.validation.username.message && (
                <p className={`text-xs mt-1 ${
                  form.validation.username.checking ? 'text-gray-500' :
                  form.validation.username.available ? 'text-green-600' : 'text-red-600'
                }`}>
                  {form.validation.username.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Lock className="w-4 h-4 inline mr-2" />
                Password *
              </label>
              <div className="relative">
                <input
                  type={form.showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Create a secure password"
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, showPassword: !prev.showPassword }))}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {form.showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">At least 8 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Lock className="w-4 h-4 inline mr-2" />
                Repeat Password *
              </label>
              <div className="relative">
                <input
                  type={form.showRepeatPassword ? 'text' : 'password'}
                  value={form.repeatPassword}
                  onChange={(e) => setForm(prev => ({ ...prev, repeatPassword: e.target.value }))}
                  placeholder="Confirm your password"
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, showRepeatPassword: !prev.showRepeatPassword }))}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {form.showRepeatPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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
              onClick={handleCredentialsNext}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
            >
              Next: Choose Roles
              <ChevronRight className="h-4 w-4 ml-2" />
            </button>
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
            {/* Buyer Role (Always enabled) */}
            <div className="border border-gray-200 rounded-lg p-4 bg-blue-50">
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  checked={form.roles.buyer}
                  disabled
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <ShoppingCart className="h-5 w-5 text-green-600 mr-2" />
                    <span className="font-medium text-gray-900">Data Buyer</span>
                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Default</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Purchase high-quality data for your AI agents and applications.
                  </p>
                </div>
              </div>
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
              onClick={() => setCurrentStep('credentials')}
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

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <p className="text-sm text-blue-800">
              <strong>You're all set!</strong> Redirecting you to your dashboard in a moment...
            </p>
          </div>

          {form.error && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md text-sm">
              <p><strong>Account created, but auto-login failed.</strong></p>
              <p>Please use the sign-in form with your new credentials.</p>
            </div>
          )}

          <div className="text-center">
            <button
              onClick={onSwitchToSignIn}
              className="text-gray-600 hover:text-gray-900 text-sm"
            >
              Or sign in manually →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateAccount;