import { useCallback, useState } from 'react';
import type { Session } from './types';
import { AuthForm } from './components/AuthForm';
import { Dashboard } from './components/Dashboard';

const storageKey = 'dealership-session';
function restoreSession(): Session | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
    if (
      typeof stored?.token === 'string' &&
      typeof stored?.user?.email === 'string' &&
      typeof stored?.user?.id === 'string' &&
      ['user', 'admin'].includes(stored?.user?.role)
    )
      return stored;
  } catch {
    /* An unavailable or invalid session starts on the sign-in screen. */
  }
  return null;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(restoreSession);
  const [notice, setNotice] = useState('');
  const signOut = useCallback((expired = false) => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* Memory session still clears. */
    }
    setSession(null);
    setNotice(expired ? 'Your session has expired. Please sign in again.' : 'You have signed out.');
  }, []);
  function signIn(next: Session) {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Continue for this page lifetime. */
    }
    setSession(next);
    setNotice('');
  }
  return session ? (
    <Dashboard session={session} onSignOut={signOut} />
  ) : (
    <AuthForm onSession={signIn} notice={notice} />
  );
}
