import { useEffect, useState } from 'react';
import { api, loginUrl, setAuthHandler } from './api.js';
import Login from './components/Login.jsx';
import SendForm from './components/SendForm.jsx';
import BulkSend from './components/BulkSend.jsx';
import FollowUps from './components/FollowUps.jsx';
import TemplateManager from './components/TemplateManager.jsx';
import Settings from './components/Settings.jsx';
import HistoryModal from './components/HistoryModal.jsx';

// Read once: Google sends the user back with ?authError=... when sign-in fails.
const authError = new URLSearchParams(window.location.search).get('authError');
if (authError) window.history.replaceState(null, '', window.location.pathname);

const TABS = [
  ['send', 'Send Mail'],
  ['bulk', 'Bulk Send'],
  ['followups', 'Follow-ups'],
  ['templates', 'Templates'],
  ['settings', 'Settings'],
];

export default function App() {
  const [me, setMe] = useState(undefined); // undefined = loading, null = signed out
  const [templates, setTemplates] = useState([]);
  const [view, setView] = useState('send');
  const [showHistory, setShowHistory] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Reloads the signed-in user: Gmail status, emails sent today, follow-ups due.
  const refreshMe = () =>
    api
      .getMe()
      .then((data) => {
        setMe(data);
        setLoadError('');
      })
      .catch((e) => (e.status === 401 ? setMe(null) : setLoadError(e.message)));

  const loadTemplates = () => api.getTemplates().then(setTemplates).catch((e) => setLoadError(e.message));

  useEffect(() => {
    setAuthHandler(() => setMe(null));
    refreshMe();
  }, []);

  const signedInAs = me?.email;
  useEffect(() => {
    if (signedInAs) loadTemplates();
  }, [signedInAs]);

  const signOut = async () => {
    await api.logout().catch(() => {});
    setMe(null);
    setView('send');
  };

  if (me === null) return <Login error={authError} />;

  if (me === undefined) {
    return (
      <div className="page">
        {loadError ? (
          <div className="alert error">Could not reach the server: {loadError}</div>
        ) : (
          <p className="muted center">Loading…</p>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">✉️ Cold Mail Sender</div>
        <div className="user">
          {me.picture && <img src={me.picture} alt="" referrerPolicy="no-referrer" />}
          <span className="user-email">{me.email}</span>
          <button className="btn outline sm" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      {loadError && <div className="alert error">{loadError}</div>}

      {!me.gmailConnected && (
        <div className="alert warning">
          Gmail is not connected, so emails can't be sent yet.{' '}
          <a className="btn primary sm" href={loginUrl}>
            Connect Gmail
          </a>
        </div>
      )}

      <nav className="tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={view === key ? 'tab active' : 'tab'} onClick={() => setView(key)}>
            {label}
            {key === 'followups' && me.followUpsDue > 0 && <span className="count">{me.followUpsDue}</span>}
          </button>
        ))}
      </nav>

      {view === 'send' && (
        <SendForm templates={templates} me={me} onSent={refreshMe} onOpenHistory={() => setShowHistory(true)} />
      )}
      {view === 'bulk' && <BulkSend templates={templates} me={me} onChanged={refreshMe} />}
      {view === 'followups' && <FollowUps templates={templates} me={me} onChanged={refreshMe} />}
      {view === 'templates' && <TemplateManager templates={templates} onChange={loadTemplates} />}
      {view === 'settings' && <Settings me={me} onChanged={refreshMe} onSignedOut={() => setMe(null)} />}

      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} onChanged={refreshMe} />}
    </div>
  );
}
