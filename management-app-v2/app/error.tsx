'use client';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="fatal">
      <div className="brand-mark">M</div>
      <h1>The workspace could not open.</h1>
      <p>No change has been confirmed. Refresh the workspace before trying again.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
