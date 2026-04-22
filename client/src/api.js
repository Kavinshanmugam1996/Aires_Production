const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function getPaymentStatus(sessionId) {
  const r = await fetch(`${API_URL}/api/payment-status?session_id=${encodeURIComponent(sessionId)}`);
  if (!r.ok) throw new Error('Failed to fetch payment status');
  return r.json();
}

export async function createSecondaryUser(organizationId, secondaryName, secondaryEmail) {
  const r = await fetch(`${API_URL}/api/secondary-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationId, secondaryName, secondaryEmail }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Failed to create secondary user');
  return data;
}

export async function getUserInfo(token) {
  const r = await fetch(`${API_URL}/api/user-info`, { headers: authHeaders(token) });
  if (!r.ok) throw new Error('Failed to fetch user info');
  return r.json();
}

export async function getAssessmentStatus(token) {
  const r = await fetch(`${API_URL}/api/assessment/status`, { headers: authHeaders(token) });
  if (!r.ok) throw new Error('Failed to fetch assessment status');
  return r.json();
}

export async function startAssessment(token) {
  const r = await fetch(`${API_URL}/api/assessment/start`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!r.ok) throw new Error('Failed to start assessment');
  return r.json();
}

export async function getQuestions(token) {
  const r = await fetch(`${API_URL}/api/assessment/questions`, { headers: authHeaders(token) });
  if (!r.ok) throw new Error('Failed to fetch questions');
  return r.json();
}

export async function submitAssessment(token, sessionId, answers) {
  const r = await fetch(`${API_URL}/api/assessment/submit`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ sessionId, answers }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Failed to submit assessment');
  return data;
}

export async function testerFullReset(token) {
  const r = await fetch(`${API_URL}/api/tester/full-reset`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Failed to reset');
  return data;
}
