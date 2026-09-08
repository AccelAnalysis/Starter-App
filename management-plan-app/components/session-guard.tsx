'use client';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
/** Clears all in-memory navigation/dialog state when leaving an identity. */
export default function SessionGuard() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    if (!auth) return;
    let initialized = false;
    let previousUid: string | null = null;
    return onAuthStateChanged(auth, user => {
      const nextUid = user?.uid || null;
      if (initialized && previousUid && previousUid !== nextUid) {
        window.location.replace('/');
        return;
      }
      initialized = true;
      previousUid = nextUid;
      setSignedIn(Boolean(user));
    });
  }, []);
  return signedIn ? <button className="mobile-session secondary small" type="button" aria-label="Sign out of workspace" onClick={() => auth && signOut(auth)}>Sign out</button> : null;
}
