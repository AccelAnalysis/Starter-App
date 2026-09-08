'use client';

import { useState } from 'react';
import {
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User
} from 'firebase/auth';
import { auth, firebaseConfigured } from '@/lib/firebase';

export default function AuthPanel({
  user,
  error,
  retry
}: {
  user: User | null;
  error: string;
  retry: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'signin' | 'activate'>('signin');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setFailure('');
    try {
      await fn();
    } catch (e) {
      const code = (e as { code?: string }).code || '';
      setFailure(
        code.includes('invalid-credential')
          ? 'The email or password is not correct.'
          : code.includes('email-already')
            ? 'This email is already registered. Sign in instead.'
            : code.includes('weak-password')
              ? 'Use a stronger password.'
              : 'We could not complete that request. Check your details and try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="brand-lockup"><span className="brand-mark">M</span><strong>Management</strong></div>
        <div>
          <p className="eyebrow">Initiatives · KPIs · Conversation</p>
          <h1>Know what matters.<br />Know what changed.</h1>
          <p className="auth-copy">A focused management workspace for managers, employees, measurable initiatives, and the conversations that move them forward.</p>
          <div className="auth-flow"><span>Manager</span><i>→</i><span>Initiative</span><i>→</i><span>KPI</span><i>↔</i><span>Conversation</span></div>
        </div>
        <small>Private management information stays behind verified access.</small>
      </section>

      <section className="auth-card">
        {!firebaseConfigured ? (
          <>
            <p className="eyebrow">Setup required</p>
            <h2>Connect Firebase</h2>
            <p>The application needs its Firebase web configuration before sign-in is available.</p>
          </>
        ) : user ? (
          <>
            <p className="eyebrow">Workspace access</p>
            <h2>{user.emailVerified ? 'Opening your workspace' : 'Verify your email'}</h2>
            <p>Signed in as <strong>{user.email}</strong>.</p>
            {!user.emailVerified && <p>Use the verification link sent to your email, then return here.</p>}
            {error && <p className="error" role="alert">{error}</p>}
            <button
              disabled={busy}
              onClick={() => run(async () => {
                await user.reload();
                if (!user.emailVerified) {
                  setMessage('Email verification is not complete yet.');
                  return;
                }
                await user.getIdToken(true);
                await retry();
              })}
            >Check access again</button>
            {!user.emailVerified && (
              <button className="secondary" disabled={busy} onClick={() => run(async () => {
                await sendEmailVerification(user);
                setMessage('Verification email sent.');
              })}>Resend verification</button>
            )}
            <button className="text-button" onClick={() => auth && signOut(auth)}>Sign out</button>
          </>
        ) : (
          <>
            <p className="eyebrow">{mode === 'signin' ? 'Welcome back' : 'First-time access'}</p>
            <h2>{mode === 'signin' ? 'Sign in' : 'Activate account'}</h2>
            <p>{mode === 'signin' ? 'Open your initiatives, KPIs, and team conversations.' : 'Use the email your administrator approved.'}</p>
            <form onSubmit={event => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const password = String(form.get('password') || '');
              void run(async () => {
                if (!auth) return;
                await setPersistence(auth, browserSessionPersistence);
                if (mode === 'signin') {
                  await signInWithEmailAndPassword(auth, email, password);
                } else {
                  const result = await createUserWithEmailAndPassword(auth, email, password);
                  await updateProfile(result.user, { displayName: name.trim() });
                  await sendEmailVerification(result.user);
                  setMessage('Account created. Verify your email, then check access again.');
                }
              });
            }}>
              {mode === 'activate' && (
                <label>Full name<input value={name} onChange={e => setName(e.target.value)} required minLength={2} autoComplete="name" /></label>
              )}
              <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></label>
              <label>Password<input name="password" type="password" required minLength={mode === 'activate' ? 12 : undefined} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>
              <button type="submit" disabled={busy}>{busy ? 'Connecting…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
            </form>
            <div className="auth-links">
              <button className="text-button" onClick={() => { setMode(mode === 'signin' ? 'activate' : 'signin'); setFailure(''); setMessage(''); }}>
                {mode === 'signin' ? 'First time here? Activate account' : 'Already registered? Sign in'}
              </button>
              <button className="text-button" disabled={busy || !email} onClick={() => run(async () => {
                if (auth) await sendPasswordResetEmail(auth, email);
                setMessage('Password reset requested.');
              })}>Reset password</button>
            </div>
          </>
        )}
        {failure && <p className="error" role="alert">{failure}</p>}
        {message && <p className="notice" role="status">{message}</p>}
      </section>
    </main>
  );
}
