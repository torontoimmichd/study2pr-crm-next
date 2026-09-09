'use client';
import {useState} from 'react';
import {useSession} from './Session';
import {supabase, configured} from '../lib/supabase';

function Frame({children}) {
  return <div className="gate-wrap"><div className="gate-card">
    <div className="gate-brand"><span className="mark">S2</span><b>Study2PR</b></div>
    {children}
  </div></div>;
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const {error} = await supabase.auth.signInWithPassword({email: email.trim(), password});
    if (error) { setErr(error.message); setBusy(false); }
    // on success the auth listener swaps the tree; no need to unset busy
  }

  return <Frame>
    <h1 className="gate-h">Sign in</h1>
    <p className="gate-sub">Use the account your branch administrator created for you.</p>
    <form onSubmit={submit}>
      <div className="fld"><label htmlFor="e">Email</label>
        <input id="e" type="email" autoComplete="username" required
               value={email} onChange={ev => setEmail(ev.target.value)}/></div>
      <div className="fld" style={{marginTop: 12}}><label htmlFor="p">Password</label>
        <input id="p" type="password" autoComplete="current-password" required
               value={password} onChange={ev => setPassword(ev.target.value)}/></div>
      {err ? <div className="gate-err" role="alert">{err}</div> : null}
      <button className="tbtn pri" type="submit" disabled={busy} style={{marginTop: 16, width: '100%', justifyContent: 'center'}}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  </Frame>;
}

export default function Gate({children}) {
  const {state, user, error, signOut} = useSession();

  if (!configured || state === 'unconfigured') return <Frame>
    <h1 className="gate-h">Not configured</h1>
    <p className="gate-sub">This deployment has no Supabase URL or key set. Add
      <code> NEXT_PUBLIC_SUPABASE_URL</code> and <code> NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and redeploy.</p>
  </Frame>;

  if (state === 'loading') return <Frame>
    <h1 className="gate-h">Checking your session…</h1>
    <p className="gate-sub">One moment.</p>
  </Frame>;

  if (state === 'anon') return <SignIn/>;

  if (state === 'stranger') return <Frame>
    <h1 className="gate-h">No access yet</h1>
    <p className="gate-sub">You are signed in as <b>{user?.email}</b>, but this account is not
      attached to a staff record, so there is nothing for you to see. An administrator needs to
      add you in HR and grant a role.</p>
    <button className="tbtn" onClick={signOut} style={{marginTop: 16}}>Sign out</button>
  </Frame>;

  if (state === 'error') return <Frame>
    <h1 className="gate-h">Something went wrong</h1>
    <p className="gate-sub">{error}</p>
    <button className="tbtn" onClick={() => location.reload()} style={{marginTop: 16}}>Try again</button>
  </Frame>;

  return children;
}
