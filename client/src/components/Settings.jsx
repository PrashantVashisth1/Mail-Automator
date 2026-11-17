import { useState } from 'react';
import { api, loginUrl } from '../api.js';
import { MAX_RESUME_BYTES, toBase64 } from '../helpers.js';

export default function Settings({ me, onChanged, onSignedOut }) {
  const [senderName, setSenderName] = useState(me.senderName);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async (body, successText) => {
    setBusy(true);
    setStatus(null);
    try {
      await api.updateMe(body);
      setStatus({ type: 'success', text: successText });
      onChanged();
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const pickResume = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') return setStatus({ type: 'error', text: 'Resume must be a PDF file' });
    if (file.size > MAX_RESUME_BYTES) return setStatus({ type: 'error', text: 'Resume must be under 2 MB' });
    save({ resumeBase64: await toBase64(file), resumeName: file.name }, 'Default resume saved');
  };

  const signOut = async () => {
    await api.logout().catch(() => {});
    onSignedOut();
  };

  const deleteAccount = async () => {
    const ok = confirm(
      'Delete your account? This permanently removes your templates, resume, history and bulk sends, and disconnects Gmail.'
    );
    if (!ok) return;
    try {
      await api.deleteMe();
      onSignedOut();
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="card">
      <div className="card-head">
        <h2>Settings</h2>
        <p>Signed in as {me.email}</p>
      </div>
      <div className="card-body">
        {status && <div className={`alert ${status.type}`}>{status.text}</div>}

        <h3 className="section">Sender</h3>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            save({ senderName }, 'Sender name saved');
          }}
        >
          <label>
            Your name (shown in the From line and used for {'{{senderName}}'})
            <input value={senderName} onChange={(e) => setSenderName(e.target.value)} required maxLength={100} />
          </label>
          <button className="btn primary" disabled={busy || senderName.trim() === me.senderName}>
            Save
          </button>
        </form>

        <h3 className="section">Default resume</h3>
        <p className="muted small">Attached to every email whose template has no resume of its own. PDF, max 2 MB.</p>
        {me.defaultResumeName ? (
          <div className="file-row">
            📎 {me.defaultResumeName}
            <button className="btn danger sm" onClick={() => save({ removeResume: true }, 'Default resume removed')} disabled={busy}>
              Remove
            </button>
          </div>
        ) : (
          <p className="muted small">No default resume yet.</p>
        )}
        <label className="file-pick">
          {me.defaultResumeName ? 'Replace resume' : 'Upload resume'}
          <input type="file" accept="application/pdf" onChange={pickResume} disabled={busy} />
        </label>

        <h3 className="section">Gmail</h3>
        {me.gmailConnected ? (
          <p className="small">
            <span className="badge sent">Connected</span> The app can send emails as {me.email}. It cannot read your
            inbox.
          </p>
        ) : (
          <div className="alert warning">Gmail is not connected, so emails can't be sent.</div>
        )}
        <a className="btn outline sm" href={loginUrl}>
          {me.gmailConnected ? 'Reconnect Gmail' : 'Connect Gmail'}
        </a>

        <h3 className="section">Account</h3>
        <div className="row-actions">
          <button className="btn outline" onClick={signOut}>
            Sign out
          </button>
          <button className="btn danger" onClick={deleteAccount}>
            Delete my account
          </button>
        </div>
      </div>
    </div>
  );
}
