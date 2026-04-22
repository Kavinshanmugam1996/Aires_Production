/**
 * ROUGH STUB — Login page with Cognito auth + force password change flow.
 * Restyle and rebuild as needed. auth.js handles all Cognito logic — don't change that.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, completeNewPassword } from './auth';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [stage, setStage] = useState('login'); // 'login' | 'change-password'
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');



  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.newPasswordRequired) {
        setSession(result.session);
        setStage('change-password');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await completeNewPassword(email, newPassword, session);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to set password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-glass">
        <div className="login-logo">AIRES</div>
        <h1 className="login-title">
          {stage === 'login' ? 'Sign in to your account' : 'Set your new password'}
        </h1>
        <p className="login-subtitle">
          {stage === 'login'
            ? 'Use the credentials sent to your email address'
            : 'Your temporary password must be changed before continuing'}
        </p>

        {error && <div className="login-error">{error}</div>}

        {stage === 'login' ? (
          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label>Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@company.com"
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
              />
            </div>
            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleChangePassword} className="login-form">
            <div className="form-group">
              <label>New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Minimum 8 characters"
              />
            </div>
            <div className="form-group">
              <label>Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Repeat your new password"
              />
            </div>
            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Setting password...' : 'Set password & continue'}
            </button>
          </form>
        )}

        <p className="login-help">
          Need help?{' '}
          <a href="mailto:Info@bizcomgrp.com">Info@bizcomgrp.com</a>
        </p>
      </div>
    </div>
  );
}
