import { useState } from 'react';
import { api } from '../api.js';
import { MAX_RESUME_BYTES, toBase64 } from '../helpers.js';

const blank = { name: '', subject: '', body: '', resumeName: '' };

export default function TemplateManager({ templates, onChange }) {
  const [editingId, setEditingId] = useState(null); // null = nothing, 'new' = creating
  const [draft, setDraft] = useState(blank);
  const [error, setError] = useState('');

  const startEdit = (t) => {
    setEditingId(t ? t._id : 'new');
    setDraft(t ? { name: t.name, subject: t.subject, body: t.body, resumeName: t.resumeName || '' } : blank);
    setError('');
  };

  const pickResume = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') return setError('Resume must be a PDF file');
    if (file.size > MAX_RESUME_BYTES) return setError('Resume must be under 2 MB');
    setError('');
    setDraft({ ...draft, resumeBase64: await toBase64(file), resumeName: file.name, removeResume: false });
  };

  const removeResume = () =>
    setDraft({ ...draft, resumeBase64: undefined, resumeName: '', removeResume: true });

  const save = async (e) => {
    e.preventDefault();
    try {
      const { resumeName, ...rest } = draft;
      const payload = draft.resumeBase64 ? { ...rest, resumeName } : rest;
      if (editingId === 'new') await api.createTemplate(payload);
      else await api.updateTemplate(editingId, payload);
      setEditingId(null);
      onChange();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (t) => {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    try {
      await api.deleteTemplate(t._id);
      onChange();
    } catch (err) {
      setError(err.message);
    }
  };

  const update = (e) => setDraft({ ...draft, [e.target.name]: e.target.value });

  return (
    <div className="card">
      <div className="card-head">
        <h2>Your Templates</h2>
        <p>
          Use <code>{'{{hrName}}'}</code>, <code>{'{{companyName}}'}</code> and <code>{'{{senderName}}'}</code> as
          placeholders
        </p>
      </div>
      <div className="card-body">
        {editingId ? (
          <form onSubmit={save}>
            <label>
              Template Name
              <input name="name" value={draft.name} onChange={update} placeholder="Frontend Developer" required />
            </label>
            <label>
              Subject
              <input name="subject" value={draft.subject} onChange={update} required />
            </label>
            <label>
              Body
              <textarea name="body" rows={16} value={draft.body} onChange={update} required />
            </label>
            <label>
              Resume for this role (PDF, max 2 MB)
              <input type="file" accept="application/pdf" onChange={pickResume} />
            </label>
            {draft.resumeName && (
              <div className="muted small">
                📎 {draft.resumeName}{' '}
                <button type="button" className="btn danger sm" onClick={removeResume}>Remove</button>
              </div>
            )}
            {error && <div className="alert error">{error}</div>}
            <div className="actions">
              <button type="button" className="btn ghost" onClick={() => setEditingId(null)}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                Save Template
              </button>
            </div>
          </form>
        ) : (
          <>
            {error && <div className="alert error">{error}</div>}
            <ul className="tpl-list">
              {templates.map((t) => (
                <li key={t._id}>
                  <div>
                    <strong>{t.name}</strong>
                    <div className="muted small">{t.subject}</div>
                    <div className="muted small">{t.resumeName ? `📎 ${t.resumeName}` : 'No resume (uses your default from Settings)'}</div>
                  </div>
                  <div className="row-actions">
                    <button className="btn outline sm" onClick={() => startEdit(t)}>Edit</button>
                    <button className="btn danger sm" onClick={() => remove(t)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
            <button className="btn primary" onClick={() => startEdit(null)}>+ New Template</button>
          </>
        )}
      </div>
    </div>
  );
}