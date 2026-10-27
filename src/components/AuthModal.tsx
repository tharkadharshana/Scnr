import React, { useState } from 'react';
import { loginWithGoogle, loginWithEmail, signUpWithEmail, resendVerification, sendPasswordReset, setNewPassword } from '../supabase';

type Mode = 'signin' | 'signup' | 'forgot' | 'setpw' | 'sent';

export const MIN_PASSWORD = 8;

/** Sign-in card: Google, or email + password with verification and reset. 'setpw' is the page opened from a reset link. */
export default function AuthModal({ initialMode = 'signin', onClose }: { initialMode?: Mode; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sentFor, setSentFor] = useState<'signup' | 'reset'>('signup');

  const run = async (fn: () => Promise<void>) => {
    setError(null); setNote(null); setUnverified(false); setBusy(true);
    try { await fn(); } catch (e: any) {
      const m: string = e?.message || '';
      if (/not confirmed/i.test(m)) { setUnverified(true); setError('Verify your email first. We sent you a link when you signed up.'); }
      else if (/invalid login/i.test(m)) setError('Wrong email or password.');
      else if (/rate limit|too many/i.test(m)) setError('Too many attempts. Wait a few minutes and try again.');
      else setError(m || 'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode !== 'forgot' && password.length < MIN_PASSWORD && mode !== 'signin') { setError(`Use at least ${MIN_PASSWORD} characters for the password.`); return; }
    run(async () => {
      if (mode === 'signin') await loginWithEmail(email.trim(), password);
      else if (mode === 'signup') { await signUpWithEmail(email.trim(), password); setNote(`We sent a verification link to ${email.trim()}. Open it to finish creating your account.`); setSentFor('signup'); setMode('sent'); }
      else if (mode === 'forgot') { await sendPasswordReset(email.trim()); setNote(`If ${email.trim()} has an account, a reset link is on its way.`); setSentFor('reset'); setMode('sent'); }
      else if (mode === 'setpw') { await setNewPassword(password); onClose(); }
    });
  };

  const title = { signin: 'Sign in to Scnr', signup: 'Create your account', forgot: 'Reset your password', setpw: 'Choose a new password', sent: 'Check your inbox' }[mode];

  return (
    <div className="auth-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="auth-card">
        <button className="auth-x" aria-label="Close" onClick={onClose}>×</button>
        <h2 className="auth-title">{title}</h2>
        {mode === 'sent' ? (
          <>
            <p className="auth-note">{note}</p>
            {sentFor === 'signup' && <p className="auth-small">Nothing there? Check spam, then <button className="auth-link" disabled={busy} onClick={() => run(async () => { await resendVerification(email.trim()); setNote('Sent again.'); })}>send it again</button>.</p>}
          </>
        ) : (
          <>
            {(mode === 'signin' || mode === 'signup') && (
              <>
                <button className="auth-google" disabled={busy} onClick={() => run(loginWithGoogle)}>Continue with Google</button>
                <div className="auth-or"><span>or</span></div>
              </>
            )}
            <form onSubmit={submit} noValidate>
              {mode !== 'setpw' && <input className="auth-input" type="email" autoComplete="email" placeholder="Email" aria-label="Email" value={email} onChange={e => setEmail(e.target.value)} required />}
              {mode !== 'forgot' && <input className="auth-input" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder={mode === 'signin' ? 'Password' : `Password (${MIN_PASSWORD}+ characters)`} aria-label="Password" value={password} onChange={e => setPassword(e.target.value)} required />}
              {error && <div className="auth-error" role="alert">{error}</div>}
              {note && <div className="auth-note">{note}</div>}
              {unverified && <button type="button" className="auth-link" disabled={busy} onClick={() => run(async () => { await resendVerification(email.trim()); setNote('Verification email sent again.'); })}>Resend verification email</button>}
              <button className="auth-submit" type="submit" disabled={busy || (!email && mode !== 'setpw')}>
                {busy ? 'Please wait…' : { signin: 'Sign in', signup: 'Create account', forgot: 'Send reset link', setpw: 'Save password', sent: '' }[mode]}
              </button>
            </form>
            {mode === 'signin' && <p className="auth-small"><button className="auth-link" onClick={() => { setError(null); setMode('forgot'); }}>Forgot password?</button></p>}
            {(mode === 'signin' || mode === 'signup') && (
              <p className="auth-small">
                {mode === 'signin' ? 'New to Scnr? ' : 'Already have an account? '}
                <button className="auth-link" onClick={() => { setError(null); setMode(mode === 'signin' ? 'signup' : 'signin'); }}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button>
              </p>
            )}
            {mode === 'forgot' && <p className="auth-small"><button className="auth-link" onClick={() => { setError(null); setMode('signin'); }}>Back to sign in</button></p>}
          </>
        )}
      </div>
    </div>
  );
}
