"use client";

import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { FormEvent, useState } from "react";
import { auth } from "@/lib/firebase";

type Mode = "sign-in" | "create";

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message.replace("Firebase: ", "") : "Authentication failed.";
}

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth) return;

    setSubmitting(true);
    setError("");

    try {
      if (mode === "create") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (nextError) {
      setError(messageFromError(nextError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-grid">
      <div className="panel auth-copy">
        <p className="eyebrow">Protected workflow</p>
        <h2>Each user sees only their own records.</h2>
        <p>
          Authentication identifies the user. Firestore rules enforce ownership independently of the interface.
        </p>
      </div>

      <form className="panel" onSubmit={handleSubmit}>
        <div className="segmented" aria-label="Authentication mode">
          <button type="button" className={mode === "sign-in" ? "active" : ""} onClick={() => setMode("sign-in")}>Sign in</button>
          <button type="button" className={mode === "create" ? "active" : ""} onClick={() => setMode("create")}>Create account</button>
        </div>

        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>

        <label className="field">
          <span>Password</span>
          <input type="password" minLength={6} autoComplete={mode === "create" ? "new-password" : "current-password"} required value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>

        {error ? <p className="error-message" role="alert">{error}</p> : null}

        <button className="button primary full" disabled={submitting} type="submit">
          {submitting ? "Working…" : mode === "create" ? "Create account" : "Sign in"}
        </button>
      </form>
    </section>
  );
}
