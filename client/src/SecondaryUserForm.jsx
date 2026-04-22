/**
 * ROUGH STUB — Form to add a secondary user after payment.
 * Restyle and rebuild as needed. Calls api.js createSecondaryUser() — don't change that.
 * Receives orgId from query param: /secondary-user?orgId=123
 */
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createSecondaryUser } from './api';
import './SecondaryUserForm.css';

export default function SecondaryUserForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orgId = searchParams.get('orgId');

  // Guard: must have arrived from the success page with a matching org token
  useEffect(() => {
    const storedOrg = localStorage.getItem('aires_secondary_org');
    if (!orgId || storedOrg !== orgId) navigate('/', { replace: true });
  }, [orgId, navigate]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [addedEmail, setAddedEmail] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!orgId) {
      setError('Invalid link — missing organization ID. Please go back to the success page.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await createSecondaryUser(orgId, name, email);
      setAddedEmail(email);
      setDone(true);
    } catch (err) {
      setError(err.message || 'Failed to add secondary user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="secondary-container">
        <div className="secondary-glass">
          <div className="secondary-icon">✅</div>
          <h1 className="secondary-title">Secondary User Added</h1>
          <p className="secondary-sub">
            Login credentials have been sent to <strong>{addedEmail}</strong>.
            They can sign in to access the assessment portal.
          </p>
          <button className="secondary-button" onClick={() => navigate('/login')}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="secondary-container">
      <div className="secondary-glass">
        <h1 className="secondary-title">Add Secondary User</h1>
        <p className="secondary-sub">
          Add a secondary contact who will also have access to the assessment portal.
          They will receive their own login credentials via email.
        </p>

        {error && <div className="secondary-error">{error}</div>}

        <form onSubmit={handleSubmit} className="secondary-form">
          <div className="secondary-group">
            <label>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="Secondary contact's full name"
            />
          </div>
          <div className="secondary-group">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="secondary@company.com"
            />
          </div>
          <button type="submit" className="secondary-button" disabled={loading}>
            {loading ? 'Adding...' : 'Add Secondary User'}
          </button>
        </form>

        <button className="secondary-skip" onClick={() => navigate('/login')}>
          Skip — go to login
        </button>
      </div>
    </div>
  );
}
