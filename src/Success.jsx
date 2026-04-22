import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { getPaymentStatus } from './api';
import './Status.css';


function Success() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');
  const [orgData, setOrgData] = useState(null);

  useEffect(() => {
    if (!sessionId) { navigate('/', { replace: true }); return; }
    localStorage.removeItem('aires_intake_data');
    if (sessionId) {
      getPaymentStatus(sessionId)
        .then(data => {
          setOrgData(data);
          if (data?.organizationId) {
            localStorage.setItem('aires_secondary_org', String(data.organizationId));
          }
        })
        .catch(() => {});
    }
  }, [sessionId]);

  return (
    <div className="status-container" style={{ '--status-color': '#22c55e' }}>
      <div className="status-card">
        <div className="status-icon">✅</div>
        <h1 className="status-title">Payment Successful!</h1>
        <p className="status-message">
          Your payment has been confirmed. Login credentials have been sent to your email address
          — use them to access the AIRES assessment portal.
        </p>

        {orgData && (
          <div style={{
            margin: '20px 0',
            padding: '14px 18px',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: '10px',
            textAlign: 'left',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Organization</p>
            <p style={{ fontSize: '15px', color: '#fff', fontWeight: 600, margin: 0 }}>{orgData.companyName}</p>
          </div>
        )}

        {orgData && (
          <button
            className="status-button"
            style={{
              marginBottom: '10px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.14)',
              color: 'rgba(255,255,255,0.8)',
            }}
            onClick={() => navigate(`/secondary-user?orgId=${orgData.organizationId}`)}
          >
            + Add Secondary User
          </button>
        )}

       


        {sessionId && (
          <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)', marginTop: '16px', wordBreak: 'break-all' }}>
            Reference: {sessionId}
          </p>
        )}
      </div>
    </div>
  );
}

export default Success;
