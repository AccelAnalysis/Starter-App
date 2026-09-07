import { AuthenticatedWorkspace } from "@/components/authenticated-workspace";

export default function Home() {
  return (
    <main className="page-shell">
      <section className="hero compact-hero">
        <p className="eyebrow">Data-backed starter</p>
        <h1>Private records without platform sprawl.</h1>
        <p className="lede">
          Email/password authentication plus owner-only Firestore records. Replace the example record workflow with the app-specific job.
        </p>
      </section>
      <AuthenticatedWorkspace />
    </main>
  );
}
