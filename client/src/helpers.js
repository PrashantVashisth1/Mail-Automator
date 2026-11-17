import { loginUrl } from './api.js';

// Same placeholder logic as the server, used for the live preview.
export const fill = (text, vars) =>
  text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key) => (vars[key] ? vars[key] : m));

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_RESUME_BYTES = 2 * 1024 * 1024;

export const OUTCOME_LABELS = {
  no_response: 'No response',
  replied: 'Replied',
  interview: 'Interview',
  rejected: 'Rejected',
};

export const FOLLOW_UP_OPTIONS = [
  { value: 0, label: 'No reminder' },
  { value: 3, label: 'Remind me in 3 days' },
  { value: 5, label: 'Remind me in 5 days' },
  { value: 7, label: 'Remind me in 7 days' },
];

export const formatDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const formatDateTime = (d) =>
  new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export const formatTime = (d) => new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export const daysAgo = (d) => Math.floor((Date.now() - new Date(d).getTime()) / (24 * 60 * 60 * 1000));

export const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });

// The Send form is saved here before going to Google, and restored when the user comes back.
const DRAFT_KEY = 'mailAutomator.sendDraft';

export function saveDraftAndReconnect(draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // storage blocked: reconnect anyway, the form just won't come back
  }
  window.location.href = loginUrl;
}

export function takeDraft() {
  try {
    const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY));
    sessionStorage.removeItem(DRAFT_KEY);
    return draft;
  } catch {
    return null;
  }
}
