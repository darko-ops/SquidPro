import React, { useState } from 'react';
import { useAuth, useValidation, useRoles, useAuthForm } from './useAuth';
import { LoginCredentials, UserRegistration, UserRole } from './auth.types';
import './Profile.css';

const Profile: React.FC = () => {
  // Main authentication state
  const { user, isAuthenticated, isLoading, login, register, logout, error } = useAuth();
  
  // UI state
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [activeRole, setActiveRole] = useState<UserRole>('buyer');
  
  // Role utilities
  const { hasRole, permissions } = useRoles(user);
  
  // Form validation
  const { usernameState, emailState, validateUsername, validateEmail } = useValidation();
  
  // Login form
  const loginForm = useAuthForm<LoginCredentials>(
    { username: '', password: '' },
    login
  );

  // Registration form
  const registerForm = useAuthForm<UserRegistration>(
    {
      username: '',
      name: '',
      email: '',
      password: '',
      repeat_password: '',
      stellar_address: '',
      roles: ['buyer'],
    },
    async (data) => {
      // Client-side validation
      if (data.password !== data.repeat_password) {
        throw new Error('Passwords do not match');
      }
      if (data.roles.length === 0) {
        throw new Error('Please select at least one role');
      }
      if (usernameState.status === 'taken' || emailState.status === 'taken') {
        throw new Error('Please fix validation errors');
      }
      
      await register(data);
    }
  );

  // Set initial active role when user logs in
  React.useEffect(() => {
    if (user && user.roles.length > 0) {
      setActiveRole(user.roles[0]);
    }
  }, [user]);

  // Debounced validation
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (registerForm.formData.username.length >= 3) {
        validateUsername(registerForm.formData.username);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [registerForm.formData.username, validateUsername]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (registerForm.formData.email.includes('@')) {
        validateEmail(registerForm.formData.email);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [registerForm.formData.email, validateEmail]);

  // Handle role selection in registration
  const handleRoleChange = (role: UserRole, checked: boolean) => {
    const currentRoles = registerForm.formData.roles;
    const newRoles = checked 
      ? [...currentRoles, role]
      : currentRoles.filter(r => r !== role);
    
    registerForm.updateField('roles', newRoles);
  };

  // Render role-specific content
  const renderRoleContent = () => {
    switch (activeRole) {
      case 'buyer':
        return (
          <div>
            <h3>Data Packages</h3>
            <p>Browse and purchase data packages from our catalog.</p>
            <a href="/" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
              Browse Catalog
            </a>
          </div>
        );
      case 'supplier':
        return (
          <div>
            <h3>Your Data Packages</h3>
            <p>Manage your uploaded data packages and track earnings.</p>
            <p>No packages uploaded yet. Upload your first data package to start earning.</p>
          </div>
        );
      case 'reviewer':
        return (
          <div>
            <h3>Review Tasks</h3>
            <p>Earn money by reviewing data quality.</p>
            <p>No review tasks available at the moment. Check back later for new opportunities.</p>
          </div>
        );
      default:
        return <div>Select a role tab to view content.</div>;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="profile-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  // Not authenticated - show auth forms
  if (!isAuthenticated) {
    return (
      <div className="profile-container">
        <div className="auth-section">
          <div className="auth-header">
            <h1 className="auth-title">Welcome to SquidPro</h1>
            <p className="auth-subtitle">Sign in to your account or create a new one</p>
          </div>

          {/* Auth Tabs */}
          <div className="auth-tabs">
            <div 
              className={`auth-tab ${authTab === 'login' ? 'active' : ''}`}
              onClick={() => setAuthTab('login')}
            >
              Sign In
            </div>
            <div 
              className={`auth-tab ${authTab === 'register' ? 'active' : ''}`}
              onClick={() => setAuthTab('register')}
            >
              Create Account
            </div>
          </div>

          {/* Error Messages */}
          {(error || loginForm.errors.general || registerForm.errors.general) && (
            <div className="message error">
              {error || loginForm.errors.general || registerForm.errors.general}
            </div>
          )}

          {/* Login Form */}
          {authTab === 'login' && (
            <form onSubmit={loginForm.handleSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label">Username</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter your username"
                  value={loginForm.formData.username}
                  onChange={(e) => loginForm.updateField('username', e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Enter your password"
                  value={loginForm.formData.password}
                  onChange={(e) => loginForm.updateField('password', e.target.value)}
                  required
                />
              </div>
              <button 
                type="submit" 
                className="auth-btn" 
                disabled={loginForm.isSubmitting}
              >
                {loginForm.isSubmitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* Registration Form */}
          {authTab === 'register' && (
            <form onSubmit={registerForm.handleSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label">Username</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Choose a username"
                  value={registerForm.formData.username}
                  onChange={(e) => registerForm.updateField('username', e.target.value)}
                  required
                />
                {usernameState.message && (
                  <div className={`validation-message ${usernameState.status}`}>
                    {usernameState.message}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter your full name"
                  value={registerForm.formData.name}
                  onChange={(e) => registerForm.updateField('name', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="Enter your email"
                  value={registerForm.formData.email}
                  onChange={(e) => registerForm.updateField('email', e.target.value)}
                  required
                />
                {emailState.message && (
                  <div className={`validation-message ${emailState.status}`}>
                    {emailState.message}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Choose a password (min 8 characters)"
                  value={registerForm.formData.password}
                  onChange={(e) => registerForm.updateField('password', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Repeat Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Repeat your password"
                  value={registerForm.formData.repeat_password}
                  onChange={(e) => registerForm.updateField('repeat_password', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Stellar Address</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Your Stellar wallet address (starts with G)"
                  value={registerForm.formData.stellar_address}
                  onChange={(e) => registerForm.updateField('stellar_address', e.target.value)}
                  required
                />
              </div>

              <div className="checkbox-group">
                <label className="checkbox-label">Choose Your Roles:</label>
                <div className="checkbox-options">
                  <div className="checkbox-option">
                    <input 
                      type="checkbox" 
                      id="role-buyer" 
                      checked={registerForm.formData.roles.includes('buyer')}
                      onChange={(e) => handleRoleChange('buyer', e.target.checked)}
                    />
                    <label htmlFor="role-buyer">Buyer - Purchase data from suppliers</label>
                  </div>
                  <div className="checkbox-option">
                    <input 
                      type="checkbox" 
                      id="role-supplier" 
                      checked={registerForm.formData.roles.includes('supplier')}
                      onChange={(e) => handleRoleChange('supplier', e.target.checked)}
                    />
                    <label htmlFor="role-supplier">Supplier - Sell your data</label>
                  </div>
                  <div className="checkbox-option">
                    <input 
                      type="checkbox" 
                      id="role-reviewer" 
                      checked={registerForm.formData.roles.includes('reviewer')}
                      onChange={(e) => handleRoleChange('reviewer', e.target.checked)}
                    />
                    <label htmlFor="role-reviewer">Reviewer - Earn by reviewing data quality</label>
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                className="auth-btn" 
                disabled={registerForm.isSubmitting}
              >
                {registerForm.isSubmitting ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Authenticated - show dashboard
  return (
    <div className="profile-container">
      <div className="dashboard-section">
        <div className="dashboard-header">
          <div className="user-info">
            <h1>{user!.name}</h1>
            <p className="user-subtitle">@{user!.username} • {user!.roles.join(', ')}</p>
          </div>
          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </div>

        {/* Role Tabs */}
        <div className="role-tabs">
          {user!.roles.map((role) => (
            <div 
              key={role}
              className={`role-tab ${activeRole === role ? 'active' : ''}`}
              onClick={() => setActiveRole(role)}
            >
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </div>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{user!.roles.length}</div>
            <div className="stat-label">Active Roles</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">API Key</div>
            <div className="stat-label">
              <div className="api-key-display">{user!.api_key}</div>
              <small>Use this for programmatic access</small>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-value">Active</div>
            <div className="stat-label">Account Status</div>
          </div>
        </div>

        {/* Content Section */}
        <div className="content-section">
          <div className="section-content">
            {renderRoleContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;