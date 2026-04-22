const COGNITO_REGION = import.meta.env.VITE_COGNITO_REGION || 'ca-central-1';
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || '';
const COGNITO_URL = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`;

async function cognitoRequest(target, body) {
  const r = await fetch(COGNITO_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) {
    const msg = data.message || data.Message || 'Authentication error';
    throw Object.assign(new Error(msg), { code: data.__type });
  }
  return data;
}

export async function login(email, password) {
  const data = await cognitoRequest('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: { USERNAME: email, PASSWORD: password },
    ClientId: CLIENT_ID,
  });

  if (data.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
    return { newPasswordRequired: true, session: data.Session };
  }

  const { IdToken, AccessToken, RefreshToken } = data.AuthenticationResult;
  storeTokens({ IdToken, AccessToken, RefreshToken, email });
  return { success: true };
}

export async function completeNewPassword(email, newPassword, session) {
  const data = await cognitoRequest('RespondToAuthChallenge', {
    ChallengeName: 'NEW_PASSWORD_REQUIRED',
    ClientId: CLIENT_ID,
    Session: session,
    ChallengeResponses: { USERNAME: email, NEW_PASSWORD: newPassword },
  });
  const { IdToken, AccessToken, RefreshToken } = data.AuthenticationResult;
  storeTokens({ IdToken, AccessToken, RefreshToken, email });
  return { success: true };
}

function storeTokens({ IdToken, AccessToken, RefreshToken, email }) {
  localStorage.setItem('aires_id_token', IdToken);
  localStorage.setItem('aires_access_token', AccessToken);
  localStorage.setItem('aires_refresh_token', RefreshToken);
  localStorage.setItem('aires_user_email', email);
}

export function getToken() {
  return localStorage.getItem('aires_id_token');
}

export function getUserEmail() {
  return localStorage.getItem('aires_user_email');
}

export function isAuthenticated() {
  return !!localStorage.getItem('aires_id_token');
}

export function logout() {
  localStorage.removeItem('aires_id_token');
  localStorage.removeItem('aires_access_token');
  localStorage.removeItem('aires_refresh_token');
  localStorage.removeItem('aires_user_email');
}
