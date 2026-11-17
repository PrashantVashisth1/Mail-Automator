import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { api } from '../api.js';
import {
  EMAIL_RE,
  FOLLOW_UP_OPTIONS,
  fill,
  formatDate,
  formatDateTime,
  formatTime,
  saveDraftAndReconnect,
} from '../helpers.js';

const MAX_ROWS = 100;
const SAMPLE_CSV =
  'hrName,companyName,email\nPriya Sharma,Acme Corporation,priya@acme.com\nRahul Verma,"Globex, Inc.",rahul@globex.com\n';

// Accept friendly headers like "HR Name", "hr_name" or "Email".
const HEADER_MAP = { hrname: 'hrName', companyname: 'companyName', company: 'companyName', email: 'email' };
const normalizeHeader = (h) => HEADER_MAP[h.toLowerCase().replace(/[\s_-]/g, '')] || h.trim();

const JOB_LABELS = { running: 'Sending', paused: 'Paused', completed: 'Done', cancelled: 'Cancelled' };

function downloadSample() {
  const url = URL.createObjectURL(new Blob([SAMPLE_CSV], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'hr-contacts-sample.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// Problems that block sending. Emailed-before is only a warning (the user decides).
function rowIssues(row, counts) {
  const issues = [];
  if (!row.hrName) issues.push('Missing HR name');
  if (!row.companyName) issues.push('Missing company');
  if (!EMAIL_RE.test(row.email)) issues.push('Invalid email');
  else if (counts[row.email] > 1) issues.push('Appears twice in this file');
  return issues;
}

function JobCard({ job, onAction }) {
  const [showRows, setShowRows] = useState(false);
  const count = (s) => job.rows.filter((r) => r.status === s).length;
  const done = count('sent') + count('failed');
  const pct = Math.round((done / job.rows.length) * 100);

  return (
    <div className="job">
      <div className="job-head">
        <div>
          <strong>{job.templateName}</strong>
          <span className="muted small"> · {formatDateTime(job.createdAt)}</span>
        </div>
        <span className={`badge job-${job.status}`}>{JOB_LABELS[job.status]}</span>
      </div>
      <div className="progress">
        <div style={{ width: `${pct}%` }} />
      </div>
      <div className="muted small">
        {count('sent')} sent · {count('failed')} failed · {count('queued')} waiting
        {count('cancelled') > 0 && ` · ${count('cancelled')} cancelled`} (of {job.rows.length})
      </div>
      {job.status === 'paused' && (
        <div className="alert warning small-alert">
          {job.pauseReason === 'daily_limit'
            ? 'Paused because the daily limit was reached. Resume after midnight (IST).'
            : 'Paused because Gmail is disconnected. Reconnect Gmail in Settings, then resume.'}
        </div>
      )}
      <div className="row-actions job-actions">
        <button className="btn outline sm" onClick={() => setShowRows(!showRows)}>
          {showRows ? 'Hide details' : 'Details'}
        </button>
        {job.status === 'paused' && (
          <button className="btn primary sm" onClick={() => onAction('resume', job)}>
            Resume
          </button>
        )}
        {(job.status === 'running' || job.status === 'paused') && (
          <button className="btn danger sm" onClick={() => onAction('cancel', job)}>
            Cancel
          </button>
        )}
      </div>
      {showRows && (
        <div className="table-wrap job-rows">
          <table>
            <thead>
              <tr>
                <th>HR</th>
                <th>Company</th>
                <th>Email</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {job.rows.map((r) => (
                <tr key={r.email}>
                  <td>{r.hrName}</td>
                  <td>{r.companyName}</td>
                  <td>{r.email}</td>
                  <td>
                    <span className={`badge ${r.status}`} title={r.error || ''}>
                      {r.status === 'queued' ? 'waiting' : r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function BulkSend({ templates, me, onChanged }) {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [history, setHistory] = useState({}); // email -> previous send, from the server
  const [templateId, setTemplateId] = useState('');
  const [followUpDays, setFollowUpDays] = useState(5);
  const [status, setStatus] = useState(null);
  const [starting, setStarting] = useState(false);
  const [jobs, setJobs] = useState([]);

  const loadJobs = () =>
    api
      .getBulkJobs()
      .then(setJobs)
      .catch((e) => setStatus({ type: 'error', text: e.message }));

  useEffect(() => {
    loadJobs();
  }, []);

  // While a job is sending, refresh its progress every 5 seconds.
  const anyRunning = jobs.some((j) => j.status === 'running');
  useEffect(() => {
    if (!anyRunning) return undefined;
    const timer = setInterval(() => {
      loadJobs();
      onChanged();
    }, 5000);
    return () => clearInterval(timer);
  }, [anyRunning]);

  useEffect(() => {
    if (!templates.some((t) => t._id === templateId) && templates.length) setTemplateId(templates[0]._id);
  }, [templates, templateId]);

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;
    setStatus(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: normalizeHeader,
      complete: async ({ data, meta }) => {
        const missing = ['hrName', 'companyName', 'email'].filter((h) => !meta.fields?.includes(h));
        if (missing.length) {
          return setStatus({ type: 'error', text: `The CSV needs these columns: hrName, companyName, email (missing: ${missing.join(', ')}).` });
        }
        if (data.length > MAX_ROWS) {
          return setStatus({ type: 'error', text: `A CSV can have at most ${MAX_ROWS} contacts. This file has ${data.length}.` });
        }
        const parsed = data.map((r) => ({
          hrName: (r.hrName || '').trim(),
          companyName: (r.companyName || '').trim(),
          email: (r.email || '').trim().toLowerCase(),
        }));
        setRows(parsed);
        setFileName(file.name);
        try {
          const res = await api.checkBulk(parsed.map((r) => r.email).filter((e) => EMAIL_RE.test(e)));
          setHistory(res.duplicates);
        } catch (err) {
          setStatus({ type: 'error', text: err.message });
        }
      },
      error: (err) => setStatus({ type: 'error', text: `Could not read the CSV: ${err.message}` }),
    });
  };

  const counts = rows.reduce((acc, r) => ({ ...acc, [r.email]: (acc[r.email] || 0) + 1 }), {});
  const blocked = rows.some((r) => rowIssues(r, counts).length > 0);
  const firstValid = rows.find((r) => rowIssues(r, counts).length === 0);
  const template = templates.find((t) => t._id === templateId);
  const remaining = Math.max(0, me.dailyLimit - me.sentToday);
  const today = Math.min(rows.length, remaining);
  const minutes = Math.ceil((today * me.bulkGapSeconds) / 60);

  const removeRow = (index) => setRows(rows.filter((_, i) => i !== index));
  const clear = () => {
    setRows([]);
    setFileName('');
    setHistory({});
  };

  const start = async () => {
    setStarting(true);
    setStatus(null);
    try {
      await api.startBulk({ templateId, followUpDays, rows });
      clear();
      setStatus({ type: 'success', text: 'Bulk send started. You can leave this page; sending continues on the server.' });
      loadJobs();
    } catch (err) {
      setStatus({ type: 'error', text: err.message, reconnect: err.code === 'GMAIL_RECONNECT' });
    } finally {
      setStarting(false);
    }
  };

  const jobAction = async (action, job) => {
    if (action === 'cancel' && !confirm('Stop this bulk send? Emails already sent stay sent.')) return;
    try {
      await (action === 'resume' ? api.resumeBulk(job._id) : api.cancelBulk(job._id));
      loadJobs();
    } catch (err) {
      setStatus({ type: 'error', text: err.message, reconnect: err.code === 'GMAIL_RECONNECT' });
    }
  };

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>Bulk Send from CSV</h2>
          <p>Upload HR contacts and send each one a personalised email, one at a time.</p>
        </div>
        <div className="card-body">
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

          {rows.length === 0 ? (
            <>
              <label className="dropzone">
                <input type="file" accept=".csv,text/csv" onChange={pickFile} />
                <strong>Choose a CSV file</strong>
                <span className="muted small">
                  Columns: hrName, companyName, email · max {MAX_ROWS} rows
                </span>
              </label>
              <button className="btn outline sm" onClick={downloadSample}>
                Download sample CSV
              </button>
            </>
          ) : (
            <>
              <h3 className="section">
                Review {rows.length} contacts <span className="muted small">({fileName})</span>
              </h3>
              <div className="table-wrap review">
                <table>
                  <thead>
                    <tr>
                      <th>HR</th>
                      <th>Company</th>
                      <th>Email</th>
                      <th>Check</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const issues = rowIssues(r, counts);
                      const prev = history[r.email];
                      return (
                        <tr key={`${r.email}-${i}`} className={issues.length ? 'row-bad' : ''}>
                          <td>{r.hrName || '—'}</td>
                          <td>{r.companyName || '—'}</td>
                          <td>{r.email || '—'}</td>
                          <td>
                            {issues.length > 0 && <span className="issue">{issues.join(', ')}</span>}
                            {!issues.length && prev && (
                              <span className="warn-text">Emailed {formatDate(prev.date)} ({prev.companyName})</span>
                            )}
                            {!issues.length && !prev && <span className="ok-text">OK</span>}
                          </td>
                          <td>
                            <button className="close sm-close" onClick={() => removeRow(i)} aria-label="Remove row">
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {blocked && <p className="issue">Fix or remove the rows marked in red to continue.</p>}
              {Object.keys(history).length > 0 && (
                <p className="warn-text">
                  Rows marked "Emailed …" were contacted in the last 30 days. Remove them, or keep them to send anyway.
                </p>
              )}

              <div className="grid spaced">
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
                <label>
                  Follow-up reminder
                  <select value={followUpDays} onChange={(e) => setFollowUpDays(Number(e.target.value))}>
                    {FOLLOW_UP_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {template && firstValid && (
                <div className="preview">
                  <div className="preview-row muted small">Preview of the first email</div>
                  <div className="preview-row">
                    <span className="muted">To:</span> {firstValid.email} · <span className="muted">Subject:</span>{' '}
                    <strong>{fill(template.subject, { ...firstValid, senderName: me.senderName })}</strong>
                  </div>
                  <pre>{fill(template.body, { ...firstValid, senderName: me.senderName })}</pre>
                </div>
              )}

              <div className="alert info">
                {today === rows.length
                  ? `All ${rows.length} emails will go today, about one every ${me.bulkGapSeconds} seconds (~${minutes} min).`
                  : `${today} of ${rows.length} emails will go today (daily limit ${me.dailyLimit}). The job then pauses; resume it after ${formatTime(me.resetsAt)}.`}
              </div>

              <div className="actions">
                <button className="btn ghost" onClick={clear}>
                  Choose another file
                </button>
                <button
                  className="btn primary"
                  onClick={start}
                  disabled={starting || blocked || !templateId || !me.gmailConnected || rows.length === 0}
                >
                  {starting ? 'Starting…' : `Start sending ${rows.length} emails`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {jobs.length > 0 && (
        <div className="card spaced-card">
          <div className="card-body">
            <h3 className="section">Recent bulk sends</h3>
            {jobs.map((job) => (
              <JobCard key={job._id} job={job} onAction={jobAction} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
