import { useRef, useState, type FormEvent } from 'react';
import { api } from '../api';
import type { Session } from '../types';
import { Brand, CarOutline } from './Brand';

export function AuthForm({ onSession, notice }: { onSession: (session: Session) => void; notice: string }) {
  const [register, setRegister] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email')).trim();
    const password = String(form.get('password'));
    if (new TextEncoder().encode(password).length > 72) {
      setError('Password must be at most 72 UTF-8 bytes.');
      return;
    }
    busy.current = true;
    setPending(true);
    setError('');
    try {
      onSession(await api<Session>(`/auth/${register ? 'register' : 'login'}`, {
        method: 'POST', body: { email, password }
      }));
    } catch (failure) { setError((failure as Error).message); }
    finally { busy.current = false; setPending(false); }
  }
  return <main className="auth-layout">
    <section className="auth-story">
      <Brand light />
      <div className="auth-story-copy">
        <p className="eyebrow">YOUR NEXT CHAPTER, ON WHEELS</p>
        <h1>A great drive<br />starts here<span>.</span></h1>
        <p>Explore the inventory.<br />Find the vehicle that fits your life.</p>
        <CarOutline className="auth-car" />
      </div>
      <p className="auth-footnote">A clear view of every vehicle. All in one place.</p>
    </section>
    <section className="auth-form-panel">
      <div className="auth-form-inner">
        <p className="eyebrow text-teal-800">WELCOME TO MOTORLINE</p>
        <h2>{register ? 'Make yourself at home.' : 'Good to see you.'}</h2>
        <p className="muted mt-3 mb-8">{register ? 'Create your account to explore our vehicle inventory.' : 'Sign in to explore what’s in the showroom.'}</p>
        {notice && <p role="status" className="notice mb-5">{notice}</p>}
        <form onSubmit={submit} className="space-y-5">
          <label className="field">Email address<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" disabled={pending} /></label>
          <label className="field">Password<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={8} placeholder="Enter your password" disabled={pending} /></label>
          {register && <p className="text-sm muted">Use at least 8 characters, up to 72 UTF-8 bytes.</p>}
          {error && <p role="alert" className="error-box">{error}</p>}
          <button className="button button-primary w-full" disabled={pending}>
            {pending ? (register ? 'Creating account…' : 'Signing in…') : (register ? 'Create account' : 'Sign in')}
          </button>
        </form>
        <p className="mt-7 text-sm muted">{register ? 'Already have an account? ' : 'New to Motorline? '}
          <button type="button" className="text-link" disabled={pending} onClick={() => { setRegister(!register); setError(''); }}>
            {register ? 'Back to sign in' : 'Create an account'}
          </button>
        </p>
      </div>
    </section>
  </main>;
}
