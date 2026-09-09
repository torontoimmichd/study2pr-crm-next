'use client';
import Link from 'next/link';
import {useState, useEffect, useCallback} from 'react';
import {usePathname} from 'next/navigation';
import {StoreProvider, useStore} from './Store';
import {SessionProvider, useSession} from './Session';
import {supabase} from '../lib/supabase';
import Gate from './Gate';

const I = {
  dash: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  inbox: 'M3 6h18v12H3zM3 7l9 6 9-6',
  leads: 'M4 19V9l8-5 8 5v10M9 19v-6h6v6',
  assess: 'M9 11l2 2 4-4M4 3h16v18H4z',
  clients: 'M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5M16 6.5a3 3 0 010 5.5M18 20c0-2.2-.8-3.7-2-4.6',
  files: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  docs: 'M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5',
  appts: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  money: 'M15 9.5c-.6-1-1.7-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 2 3 2 3 .8 3 2-1.3 2-3 2c-1.3 0-2.4-.5-3-1.5',
  reports: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  hr: 'M9 7a3 3 0 106 0 3 3 0 10-6 0M4 21v-2a5 5 0 015-5h6a5 5 0 015 5v2',
  cc: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M8 15v6',
  settings: 'M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
};

// countKey names the number this item shows. Where there is nothing real to
// count yet, it is null and the item carries no badge at all — an invented
// number beside real ones is worse than no number.
const NAV = [
  ['/', 'Dashboard', I.dash, null],
  ['/inbox', 'Inbox', I.inbox, null],
  ['/leads', 'Leads', I.leads, 'leads'],
  ['/assessments', 'Assessments', I.assess, 'assessments'],
  ['/clients', 'Clients', I.clients, 'clients'],
  ['/files', 'Files', I.files, null],
  ['/documents', 'Documents', I.docs, 'documents'],
  ['/appointments', 'Appointments', I.appts, 'appointments'],
  ['/money', 'Money', I.money, null],
  ['/reports', 'Reports', I.reports, null],
  ['/hr', 'HR', I.hr, null],
];

function Ico({d}) {
  return <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>;
}

function Inner({children}) {
  const path = usePathname() || '/';
  const {user, signOut} = useSession();
  const {navCounts} = useStore();
  const [counts, setCounts] = useState({});
  const [me, setMe] = useState(null);

  // Pinned open, or collapsed to icons and expanding on hover. The choice sticks.
  const [pinned, setPinned] = useState(true);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('s2.railPinned');
      if (saved !== null) setPinned(saved === '1');
    } catch { /* private window, or storage blocked — the default stands */ }
  }, []);
  function togglePin() {
    setPinned(v => {
      const next = !v;
      try { window.localStorage.setItem('s2.railPinned', next ? '1' : '0'); } catch {}
      return next;
    });
  }

  const refresh = useCallback(async () => {
    try { setCounts(await navCounts()); } catch { /* badges just stay as they were */ }
  }, [navCounts]);

  useEffect(() => { refresh(); }, [refresh, path]);

  useEffect(() => {
    (async () => {
      const {data} = await supabase.rpc('fn_whoami');
      if (data) setMe(data);
    })();
  }, []);

  const on = h => h === '/' ? path === '/' : path.startsWith(h);
  const badge = key => {
    if (!key) return null;
    const n = counts[key];
    return n === undefined || n === null || n === 0 ? null : n;
  };

  return (<div className={'app' + (pinned ? '' : ' railhidden')}>
    <aside className="rail">
      <div className="brand"><span className="mark">S2</span><b>Study2PR</b></div>
      {NAV.map(n => {
        const b = badge(n[3]);
        const hot = n[3] === 'documents' && counts.documents_overdue > 0;
        return (<Link key={n[0]} href={n[0]} className={'nav' + (on(n[0]) ? ' on' : '')} title={n[1]}>
          <Ico d={n[2]}/><span className="lbl">{n[1]}</span>
          {b !== null ? <span className={'cnt' + (hot ? ' hot' : '')}>{b}</span> : null}</Link>);
      })}
      <div className="railgap"/><div className="railsep"/>
      <Link href="/control-centre" className={'nav' + (on('/control-centre') ? ' on' : '')} title="Control Centre">
        <Ico d={I.cc}/><span className="lbl">Control Centre</span>
        {counts.rules_unverified ? <span className="cnt hot">{counts.rules_unverified}</span> : null}</Link>
      <Link href="/settings" className={'nav' + (on('/settings') ? ' on' : '')} title="Settings">
        <Ico d={I.settings}/><span className="lbl">Settings</span></Link>
      <div className="who"><span className="av">{me?.initials || '··'}</span>
        <span><b>{me?.name || user?.email || 'Signing in…'}</b>
          {me ? me.roles + ' · ' + me.branch : ''}</span></div>
    </aside>

    <div className="main">
      <div className="top">
        <button className="tbtn" onClick={togglePin} aria-pressed={pinned}
          title={pinned ? 'Collapse the menu — it will open when you hover it'
                        : 'Keep the menu open'}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 6}}>
            <path d="M3 6h18M3 12h18M3 18h18"/></svg>
          {pinned ? 'Collapse menu' : 'Keep menu open'}
        </button>
        <span className="spacer"/>
        <Link href="/leads/new" className="tbtn pri">+ New lead</Link>
        {user ? <div className="whoami">
          <span className="em" title={user.email}>{user.email}</span>
          <button className="mini" onClick={signOut}>Sign out</button>
        </div> : null}
      </div>{children}</div>
  </div>);
}

export default function Shell({children}) {
  return <SessionProvider><Gate>
    <StoreProvider><Inner>{children}</Inner></StoreProvider>
  </Gate></SessionProvider>;
}
