import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { OUTCOME_LABELS, daysAgo, fill, formatDate, saveDraftAndReconnect } from '../helpers.js';

export default function FollowUps({ templates, me, onChanged }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null); // the email whose follow-up panel is open
  const [templateId, setTemplateId] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);

  const load = () =>
    api
      .getFollowUps()
      .then(setItems)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const defaultTemplate = templates.find((t) => t.name === 'Follow-up') || templates[0];

  const open = (item) => {
    setOpenId(item._id);
    setTemplateId(defaultTemplate?._id || '');
    setStatus(null);
  };

  const sendFollowUp = async (item) => {
    setSending(true);
    setStatus(null);
    try {
      const res = await api.sendFollowUp(item._id, templateId);
      setStatus({ type: 'success', text: res.message });
      setOpenId(null);
      load();
    } catch (err) {
      setStatus({ type: 'error', text: err.message, reconnect: err.code === 'GMAIL_RECONNECT' });
    } finally {
      setSending(false);
      onChanged();
    }
  };

  // Marking a reply/interview/rejection removes the email from this list.
  const setOutcome = async (item, outcome) => {
    try {
      await api.setOutcome(item._id, outcome);
      load();
      onChanged();
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    }
  };

  const template = templates.find((t) => t._id === templateId);

  return (
    <div className="card">
      <div className="card-head">
        <h2>Follow-ups due</h2>
        <p>Emails with no reply by the reminder date you picked. Send a polite follow-up or mark what happened.</p>
      </div>
      <div className="card-body">
        {error && <div className="alert error">{error}</div>}
        {status && (
          <div className={`alert ${status.type}`}>
            {status.text}
            {status.reconnect && (
              <div className="alert-actions">
                <button className="btn primary sm" onClick={() => saveDraftAndReconnect(null)}>
                  Reconnect Gmail
                </button>
              </div>
            )}
          </div>
        )}
        {!items && !error && <p className="muted">Loading…</p>}
        {items && items.length === 0 && (
          <p className="muted">
            Nothing to follow up right now. When you send an email with a reminder and the HR hasn't replied by then,
            it shows up here.
          </p>
        )}

        <ul className="tpl-list">
          {(items || []).map((item) => (
            <li key={item._id} className="stack">
              <div className="fu-row">
                <div>
                  <strong>{item.companyName}</strong> · {item.hrName}
                  <div className="muted small">{item.email}</div>
                  <div className="muted small">
                    Sent {formatDate(item.createdAt)} ({daysAgo(item.createdAt)} days ago) · {item.templateName}
                  </div>
                </div>
                <div className="row-actions">
                  <select
                    className="outcome no_response"
                    value={item.outcome}
                    onChange={(e) => setOutcome(item, e.target.value)}
                    aria-label="Outcome"
                  >
                    {Object.entries(OUTCOME_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button className="btn primary sm" onClick={() => open(item)} disabled={openId === item._id}>
                    Send follow-up
                  </button>
                </div>
              </div>

              {openId === item._id && (
                <div className="panel">
                  <label>
                    Template
                    <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                      {templates.map((t) => (
                        <option key={t._id} value={t._id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {template && (
                    <div className="preview">
                      <div className="preview-row">
                        <span className="muted">Subject:</span> <strong>Re: {item.subject}</strong>
                      </div>
                      <pre>{fill(template.body, { ...item, senderName: me.senderName })}</pre>
                      <div className="attach">Sent as a reply in the same Gmail conversation.</div>
                    </div>
                  )}
                  <div className="actions">
                    <button className="btn ghost" onClick={() => setOpenId(null)}>
                      Cancel
                    </button>
                    <button
                      className="btn primary"
                      onClick={() => sendFollowUp(item)}
                      disabled={sending || !templateId || !me.gmailConnected}
                    >
                      {sending ? 'Sending…' : 'Send follow-up'}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
