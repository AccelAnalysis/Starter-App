import { UtilityWorkbench } from "@/components/utility-workbench";

export default function Home() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Utility starter</p>
        <h1>One input. One useful result.</h1>
        <p className="lede">
          Replace the example transformer with the smallest complete workflow your user needs.
        </p>
      </section>
      <UtilityWorkbench />
      <footer className="footer-note">
        Keep version one focused: one user, one problem, one outcome.
      </footer>
    </main>
  );
}
