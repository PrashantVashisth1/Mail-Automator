const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

// Carries the server's error code (e.g. 'DUPLICATE', 'DAILY_LIMIT', 'GMAIL_RECONNECT') and extra
// data, so components can show the right message or button.
export class ApiError extends Error {
  constructor(message, status, code, data) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

// App.jsx registers this to show the login screen when the session expires.
let onAuthRequired = () => {};
export const setAuthHandler = (fn) => {
  onAuthRequired = fn;
};

async function request(url, options = {}) {
  if (import.meta.env.PROD && !API_BASE_URL) {
    throw new Error('VITE_API_URL is not set for this deployment.');
  }

  const res = await fetch(`${API_BASE_URL}${url}`, {
    credentials: 'include', // send the session cookie
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new ApiError(
      `API returned a non-JSON response (${res.status}). Check that the backend is running and VITE_API_URL points to it.`,
      res.status
    );
  }
  const data = await res.json();
  if (!res.ok) {
    if (data.code === 'AUTH_REQUIRED' && url !== '/api/me') onAuthRequired();
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data.code, data.data);
  }
  return data;
}

const send = (method, body) => ({ method, body: JSON.stringify(body) });

// Full-page navigation to Google. Also used for "Reconnect Gmail".
export const loginUrl = `${API_BASE_URL}/api/auth/google`;

export const api = {
  getMe: () => request('/api/me'),
  updateMe: (body) => request('/api/me', send('PUT', body)),
  deleteMe: () => request('/api/me', { method: 'DELETE' }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),

  getTemplates: async () => {
    const templates = await request('/api/templates');
    if (!Array.isArray(templates)) {
      throw new Error('Backend returned an invalid templates response.');
    }
    return templates;
  },
  createTemplate: (t) => request('/api/templates', send('POST', t)),
  updateTemplate: (id, t) => request(`/api/templates/${id}`, send('PUT', t)),
  deleteTemplate: (id) => request(`/api/templates/${id}`, { method: 'DELETE' }),

  sendMail: (payload) => request('/api/send', send('POST', payload)),
  getHistory: () => request('/api/history'),
  setOutcome: (id, outcome) => request(`/api/history/${id}/outcome`, send('PATCH', { outcome })),
  getStats: () => request('/api/stats'),

  getFollowUps: () => request('/api/followups'),
  sendFollowUp: (id, templateId) => request(`/api/followups/${id}/send`, send('POST', { templateId })),

  checkBulk: (emails) => request('/api/bulk/check', send('POST', { emails })),
  startBulk: (payload) => request('/api/bulk', send('POST', payload)),
  getBulkJobs: () => request('/api/bulk'),
  resumeBulk: (id) => request(`/api/bulk/${id}/resume`, { method: 'POST' }),
  cancelBulk: (id) => request(`/api/bulk/${id}/cancel`, { method: 'POST' }),
};
