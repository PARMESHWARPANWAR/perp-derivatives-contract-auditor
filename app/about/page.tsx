import Link from "next/link";

export const dynamic = "force-dynamic";

const sections = [
  {
    eyebrow: "The problem",
    title: "Audits are essential, but feedback arrives late.",
    body: "Manual smart contract audits commonly cost $5,000–$15,000+ and can take weeks. Free static analyzers such as Slither are fast and useful, but they mainly identify syntax-level issues like reentrancy, unchecked calls, and missing zero-address checks; they cannot assess whether a contract's financial logic behaves safely.",
  },
  {
    eyebrow: "What existing tools miss",
    title: "Protocol economics are not a syntax pattern.",
    body: "Generic static analyzers do not understand funding-rate manipulation, liquidation incentive griefing, or oracle staleness. These are business-logic failures specific to margin-trading and perpetuals protocols: detecting them requires reasoning about incentives, pricing assumptions, collateral, and settlement behavior rather than matching known code patterns.",
  },
  {
    eyebrow: "What makes it different",
    title: "A domain-expert interpretation layer, not another analyzer.",
    body: "We did not rebuild static analysis. We built a domain-expert interpretation layer on top of it, focused on the financial failure modes that matter in perpetuals protocols.",
  },
  {
    eyebrow: "Cost and time impact",
    title: "First-pass triage for earlier, more focused review.",
    body: "This is a first-pass triage tool intended to surface obvious issues early and prioritize what needs deeper manual review. It can identify and explain potential static and derivatives-specific concerns in seconds rather than waiting weeks for a full audit cycle. It is not a replacement for a professional manual audit.",
  },
];

export default function AboutPage() {
  return <main className="min-h-screen bg-slate-950 text-slate-100">
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
      <header className="flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">Project overview</p>
        <Link href="/" className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-cyan-400 hover:text-cyan-300">Try the auditor</Link>
      </header>

      {process.env.MOCK_MODE === "true" && <aside className="mt-7 rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-5 py-4 text-sm leading-6 text-slate-200">
        <span className="font-semibold text-cyan-300">Demo mode status. </span>
        Static analysis (Slither) is fully live. AI reasoning is currently running in simulated demo mode due to hackathon API credit distribution delays — the live GPT-5.6 integration is fully implemented in <code className="rounded bg-slate-950/60 px-1.5 py-0.5 text-xs text-cyan-200">src/reasoner.ts</code> and activates automatically once <code className="rounded bg-slate-950/60 px-1.5 py-0.5 text-xs text-cyan-200">MOCK_MODE</code> is disabled.
      </aside>}

      <section className="border-b border-slate-800 py-16 sm:py-20">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-400">OpenAI Build Week Challenge · Developer Tools</p>
        <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-6xl">Perp/Derivatives<br />Contract Auditor</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">Slither static analysis paired with GPT-5.6 reasoning for Solidity contracts that manage margin, funding rates, and liquidations.</p>
        <Link href="/?example=perp" className="mt-8 inline-flex rounded-lg bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400">Try it with a contract</Link>
      </section>

      <section className="grid gap-5 py-12 md:grid-cols-2">
        {sections.slice(0, 2).map((section) => <article key={section.eyebrow} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-400">{section.eyebrow}</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight">{section.title}</h2>
          <p className="mt-4 leading-7 text-slate-300">{section.body}</p>
        </article>)}
      </section>

      <section className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Validation from the test contract</p>
        <div className="mt-5 grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
          <div className="flex gap-5 text-center"><div><p className="text-5xl font-bold text-white">11</p><p className="mt-1 text-xs uppercase tracking-wider text-slate-300">Generic issues<br />found by Slither</p></div><div className="border-l border-cyan-400/30 pl-5"><p className="text-5xl font-bold text-amber-300">0 / 4</p><p className="mt-1 text-xs uppercase tracking-wider text-slate-300">Planted derivatives<br />bugs caught</p></div></div>
          <p className="max-w-2xl leading-7 text-slate-200">Slither found 11 generic issues but caught zero of the four intentionally planted derivatives-specific bugs: missing oracle-staleness checks, self-liquidation griefing, ungated risk parameters, and a funding-rate manipulation window.</p>
        </div>
      </section>

      <section className="py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-400">How our tool works</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight">Two analysis stages, one readable report.</h2>
        <p className="mt-4 max-w-3xl leading-7 text-slate-300">Slither's output is always real analysis. GPT-5.6 then translates those findings into plain English with suggested fixes and performs a separate, specialized pass using a derivatives checklist.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-6"><span className="text-sm font-bold text-cyan-400">01</span><h3 className="mt-4 text-lg font-semibold">Slither static analysis</h3><p className="mt-2 text-sm leading-6 text-slate-400">Trail of Bits' open-source tool identifies syntax-level Solidity findings.</p></article>
          <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-6"><span className="text-sm font-bold text-cyan-400">02</span><h3 className="mt-4 text-lg font-semibold">GPT-5.6 reasoning</h3><p className="mt-2 text-sm leading-6 text-slate-400">Explains static findings and checks funding, oracle, margin, liquidation, and settlement logic.</p></article>
          <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-6"><span className="text-sm font-bold text-cyan-400">03</span><h3 className="mt-4 text-lg font-semibold">Prioritized report</h3><p className="mt-2 text-sm leading-6 text-slate-400">Groups static findings and derivatives-specific risks by severity with suggested fixes.</p></article>
        </div>
      </section>

      <section className="grid gap-5 pb-16 md:grid-cols-2">
        {sections.slice(2).map((section) => <article key={section.eyebrow} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-400">{section.eyebrow}</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight">{section.title}</h2>
          <p className="mt-4 leading-7 text-slate-300">{section.body}</p>
        </article>)}
      </section>
    </div>
  </main>;
}
