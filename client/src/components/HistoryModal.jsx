import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { OUTCOME_LABELS, formatDateTime } from '../helpers.js';

const isOriginal = (l) => l.status === 'sent' && !l.parentLogId;

export default function HistoryModal({ onClose, onChanged }) {
  const [logs, setLogs] = useState(null);
  const [stats, setStats] = useState([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [templateFilter, setTemplateFilter] = useState('');

  const loadStats = () => api.getStats().then(setStats).catch(() => {});

  useEffect(() => {
    api.getHistory().then(setLogs).catch((e) => setError(e.message));
    loadStats();
  }, []);

  const changeOutcome = async (log, outcome) => {
    try {
      const updated = await api.setOutcome(log._id, outcome);
      setLogs((all) => all.map((l) => (l._id === updated._id ? { ...l, outcome: updated.outcome } : l)));
      loadStats();
      onChanged(); // follow-ups due count may change
    } catch (e) {
      setError(e.message);
    }
  };

  const templateNames = [...new Set((logs || []).map((l) => l.templateName).filter(Boolean))];
  const q = query.toLowerCase();
  const filtered = (logs || []).filter(
    (l) =>
      [l.companyName, l.hrName, l.email, l.templateName].some((v) => v?.toLowerCase().includes(q)) &&
      (!templateFilter || l.templateName === templateFilter) &&
      (!outcomeFilter || (isOriginal(l) && l.outcome === outcomeFilter))
  );

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Sent History</h2>
          <button className="close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-scroll">
          {stats.length > 0 && (
            <div className="stats">
              <h3 className="section">Reply rate by template</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Template</th>
                      <th>Sent</th>
                      <th>Replies</th>
                      <th>Reply rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((s) => (
                      <tr key={s.templateName}>
                        <td>{s.templateName}</td>
                        <td>{s.sent}</td>
                        <td>{s.replied}</td>
                        <td>{s.replyRate === null ? <span className="muted">Not enough data</span> : `${Math.round(s.replyRate * 100)}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted small">
                Replied, Interview and Rejected all count as a reply. Shown once a template has 5+ emails.
              </p>
            </div>
          )}

          <div className="filters">
            <input
              placeholder="Search company, HR, email or template…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select value={outcomeFilter} onChange={(e) => setOutcomeFilter(e.target.value)}>
              <option value="">All outcomes</option>
              {Object.entries(OUTCOME_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select value={templateFilter} onChange={(e) => setTemplateFilter(e.target.value)}>
              <option value="">All templates</option>
              {templateNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {error && <div className="alert error">{error}</div>}
          {!logs && !error && <p className="muted">Loading…</p>}
          {logs && filtered.length === 0 && <p className="muted">No mails yet.</p>}
          {filtered.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Company</th>
                    <th>HR</th>
                    <th>Email</th>
                    <th>Template</th>
                    <th>Status</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => (
                    <tr key={l._id}>
                      <td>{formatDateTime(l.createdAt)}</td>
                      <td>{l.companyName}</td>
                      <td>{l.hrName}</td>
                      <td>{l.email}</td>
                      <td>{l.templateName}</td>
                      <td>
                        <span className={`badge ${l.status}`} title={l.error || ''}>
                          {l.status}
                        </span>
                        {l.parentLogId && <span className="tag">Follow-up</span>}
                        {l.source === 'csv' && <span className="tag">CSV</span>}
                        {l.sentAnyway && <span className="tag warn">Sent anyway</span>}
                      </td>
                      <td>
                        {isOriginal(l) ? (
                          <select
                            className={`outcome ${l.outcome}`}
                            value={l.outcome}
                            onChange={(e) => changeOutcome(l, e.target.value)}
                          >
                            {Object.entries(OUTCOME_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
