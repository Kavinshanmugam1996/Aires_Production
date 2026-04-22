/**
 * ROUGH STUB — Post-login dashboard showing assessment status and progress.
 * Restyle and rebuild as needed. All API calls go through api.js — don't change those.
 * Routes: /dashboard (protected — requires Cognito token)
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserInfo, getAssessmentStatus, testerFullReset } from './api';
import { getToken, logout } from './auth';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    Promise.all([getUserInfo(token), getAssessmentStatus(token)])
      .then(([user, status]) => {
        setUserInfo(user);
        setAssessment(status);
      })
      .catch(() => {
        logout();
        navigate('/login');
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleReset = async () => {
    if (!window.confirm('Full tester reset: this will delete your account, all payment records, and assessment data so you can go through the entire flow again from scratch. Continue?')) return;
    try {
      await testerFullReset(getToken());
      logout();
      navigate('/');
    } catch (err) {
      alert('Reset failed: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-loading">Loading your portal...</div>
      </div>
    );
  }

  const progress = assessment && assessment.totalQuestions > 0
    ? Math.round((assessment.answeredCount / assessment.totalQuestions) * 100)
    : 0;

  const statusLabel =
    assessment?.status === 'submitted' ? 'Completed'
    : assessment?.status === 'in_progress' ? 'In Progress'
    : 'Not Started';

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="dashboard-logo">AIRES</div>
        <div className="dashboard-nav">
          <span className="dashboard-email">{userInfo?.email}</span>
          <button className="logout-button" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-welcome">
          <h1>Welcome, {userInfo?.contactPerson || userInfo?.email}</h1>
          <p>{userInfo?.companyName}</p>
        </div>

        <div className="dashboard-card">
          <div className="card-header">
            <div className="card-icon">
              {assessment?.status === 'submitted' ? '✅'
                : assessment?.status === 'in_progress' ? '📝'
                : '🚀'}
            </div>
            <div className="card-info">
              <h2 className="card-title">AI Risk Assessment</h2>
              <p className="card-subtitle">AIRES LITE — {assessment?.totalQuestions || 15} questions across 5 categories</p>
            </div>
            <div className={`status-badge status-${assessment?.status || 'not_started'}`}>
              {statusLabel}
            </div>
          </div>

          {assessment?.status === 'in_progress' && (
            <div className="progress-section">
              <div className="progress-label">
                <span>{assessment.answeredCount} of {assessment.totalQuestions} answered</span>
                <span>{progress}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <div className="card-actions">
            {assessment?.status === 'submitted' ? (
              <button className="action-button" onClick={() => navigate('/report')}>
                View Report
              </button>
            ) : (
              <button className="action-button" onClick={() => navigate('/assessment')}>
                {assessment?.status === 'in_progress' ? 'Continue Assessment' : 'Start Assessment'}
              </button>
            )}
            <button
              onClick={handleReset}
              style={{
                marginTop: '10px',
                background: 'none',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.35)',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '11px',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Reset Assessment (Tester)
            </button>
          </div>
        </div>

        <div className="dashboard-info">
          <div className="info-item">
            <span className="info-label">Role</span>
            <span className="info-value">
              {userInfo?.role === 'secondary' ? 'Secondary User' : 'Primary User'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Organization</span>
            <span className="info-value">{userInfo?.companyName || '—'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Assessment</span>
            <span className="info-value">{statusLabel}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
