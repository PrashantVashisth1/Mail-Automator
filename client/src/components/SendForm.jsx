import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { FOLLOW_UP_OPTIONS, fill, formatDate, formatTime, saveDraftAndReconnect, takeDraft } from '../helpers.js';

const empty = { hrName: '', companyName: '', email: '' };

export default function SendForm({ templates, me, onSent, onOpenHistory }) {
  // If the user just came back from "Reconnect Gmail", restore what they had typed.
  const [draft] = useState(takeDraft);
  const [form, setForm] = useState(draft?.form || empty);
  const [templateId, setTemplateId] = useState(draft?.templateId || '');
  const [followUpDays, setFollowUpDays] = useState(draft?.followUpDays ?? 5);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);
  const [duplicate, setDuplicate] = useState(null); // previous email to this address, when the server warns

  useEffect(() => {
    const exists = templates.some((t) => t._id === templateId);
    if (!exists && templates.length) setTemplateId(templates[0]._id);
  }, [templates, templateId]);

  const template = templates.find((t) => t._id === templateId);
  const vars = { ...form, senderName: me.senderName };
  const remaining = me.dailyLimit - me.sentToday;
  const limitReached = remaining <= 0;
  const resume = template?.resumeName || me.defaultResumeName;

  const update = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (e.target.name === 'email') setDuplicate(null);
  };

  const send = async (sendAnyway) => {
    setSending(true);
    setStatus(null);
    try {
      const res = await api.sendMail({ ...form, templateId, followUpDays, sendAnyway });
      setStatus({ type: 'success', text: res.message });
      setForm(empty);
      setDuplicate(null);
    } catch (err) {
      if (err.code === 'DUPLICATE') setDuplicate(err.data.previous);
      else setStatus({ type: 'error', text: err.message, reconnect: err.code === 'GMAIL_RECONNECT' });
    } finally {
      setSending(false);
      onSent(); // refresh "sent today", follow-ups due and Gmail status
    }
  };

  const reconnect = () => saveDraftAndReconnect({ form, templateId, followUpDays });

  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        send(false);
      }}
    >
      <div className="card-head">
        <h2>Job Application Mail</h2>
        <p>Fill HR details, pick a template, and send from your Gmail</p>
      </div>

      <div className="card-body">
        <h3 className="section">Recipient Information</h3>
        <div className="grid">
          <label>
            HR Name <span className="req">*</span>
            <input name="hrName" value={form.hrName} onChange={update} placeholder="Priya Sharma" required />
          </label>
          <label>
            Company Name <span className="req">*</span>
            <input name="companyName" value={form.companyName} onChange={update} placeholder="Acme Corporation" required />
          </label>
        </div>
        <label>
          HR Email Address <span className="req">*</span>
          <input type="email" name="email" value={form.email} onChange={update} placeholder="hr@company.com" required />
        </label>

        <h3 className="section">Email Template</h3>
        <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} required>
          {templates.map((t) => (
            <option key={t._id} value={t._id}>
              {t.name}
            </option>
          ))}
        </select>

        {template && (
          <div className="preview">
            <div className="preview-row">
              <span className="muted">Subject:</span> <strong>{fill(template.subject, vars)}</strong>
            </div>
            <pre>{fill(template.body, vars)}</pre>
            {resume && <div className="attach">📎 {resume} will be attached</div>}
          </div>
        )}

        <label className="spaced">
          Follow-up reminder
          <select value={followUpDays} onChange={(e) => setFollowUpDays(Number(e.target.value))}>
            {FOLLOW_UP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {duplicate && (
          <div className="alert warning">
            <strong>You already emailed {form.email}</strong> on {formatDate(duplicate.date)} ({duplicate.companyName},
            template "{duplicate.templateName}"). Emailing again so soon can look like spam.
            <div className="alert-actions">
              <button type="button" className="btn outline sm" onClick={() => setDuplicate(null)}>
                Cancel
              </button>
              <button type="button" className="btn primary sm" onClick={() => send(true)} disabled={sending}>
                Send anyway
              </button>
            </div>
          </div>
        )}

        {status && (
          <div className={`alert ${status.type}`}>
            {status.text}
            {status.reconnect && (
              <div className="alert-actions">
                <button type="button" className="btn primary sm" onClick={reconnect}>
                  Reconnect Gmail
                </button>
              </div>
            )}
          </div>
        )}

        {limitReached && (
          <div className="alert error">
            Daily limit of {me.dailyLimit} emails reached. You can send again after {formatTime(me.resetsAt)}.
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setForm(empty);
              setStatus(null);
              setDuplicate(null);
            }}
          >
            Reset Form
          </button>
          <button type="button" className="btn outline" onClick={onOpenHistory}>
            Open History
          </button>
          <button
            type="submit"
            className="btn primary"
            disabled={sending || !templateId || limitReached || !me.gmailConnected || Boolean(duplicate)}
          >
            {sending ? 'Sending…' : '✉ Send Mail'}
          </button>
        </div>
        {remaining <= 10 && !limitReached && (
          <p className="limit-note">
            {remaining} of {me.dailyLimit} emails left today
          </p>
        )}
        <p className="note">Email delivery may take a few moments. Kindly wait for confirmation.</p>
      </div>
    </form>
  );
}
