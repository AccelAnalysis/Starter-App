'use client';
export default function ErrorBoundary({ reset }: { reset: () => void }) { return <main className="auth-card"><h1>Something interrupted the workspace</h1><p>Your saved records have not been removed. Reload the workspace before retrying an action.</p><button onClick={reset}>Try again</button></main>; }
