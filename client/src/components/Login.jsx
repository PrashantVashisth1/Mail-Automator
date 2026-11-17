import { loginUrl } from '../api.js';

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function Login({ error }) {
  return (
    <div className="page narrow">
      <header className="hero">
        <div className="logo">✉️</div>
        <h1>Mail Automator</h1>
        <p className="muted">Send personalised job-application emails to HRs from your own Gmail</p>
        <div className="divider" />
      </header>

      <div className="card">
        <div className="card-body">
          {error && <div className="alert error">{error}</div>}
          <ul className="points">
            <li>Templates with the HR's name and company filled in</li>
            <li>A warning before you email the same HR twice</li>
            <li>Follow-up reminders and reply tracking per template</li>
            <li>Send to a whole CSV list of HR contacts</li>
          </ul>
          <a className="btn google" href={loginUrl}>
            <GoogleLogo /> Sign in with Google
          </a>
          <p className="note">
            We only ask permission to <strong>send</strong> emails from your Gmail. The app can't read your inbox.
          </p>
          <div className="alert info small-alert">
            <strong>First time?</strong> Google may show "Google hasn't verified this app" because the app is new.
            Click <strong>Advanced → Go to Mail Automator</strong>, then tick <strong>"Send email on your behalf"</strong>.
          </div>
        </div>
      </div>
      <p className="note">
        <a href="/privacy">Privacy Policy</a>
      </p>
    </div>
  );
}
