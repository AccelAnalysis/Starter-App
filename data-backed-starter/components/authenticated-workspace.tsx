"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { AuthForm } from "@/components/auth-form";
import { RecordManager } from "@/components/record-manager";
import { auth, firebaseConfigured } from "@/lib/firebase";

export function AuthenticatedWorkspace() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  if (!firebaseConfigured) {
    return (
      <section className="panel setup-panel">
        <p className="eyebrow">Setup required</p>
        <h2>Add Firebase web configuration</h2>
        <p>
          Copy <code>.env.example</code> to <code>.env.local</code>, add the Firebase web app values, enable Email/Password authentication, and create a Firestore database.
        </p>
      </section>
    );
  }

  if (loading) {
    return <section className="panel muted-panel">Checking your session…</section>;
  }

  if (!user) return <AuthForm />;

  return (
    <section className="workspace">
      <div className="workspace-bar">
        <div>
          <span className="muted-label">Signed in as</span>
          <strong>{user.email ?? "Authenticated user"}</strong>
        </div>
        <button className="button secondary" onClick={() => auth && signOut(auth)}>Sign out</button>
      </div>
      <RecordManager user={user} />
    </section>
  );
}
