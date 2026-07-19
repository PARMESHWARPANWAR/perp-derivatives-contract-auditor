"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { EXAMPLE_CONTRACTS, type ExampleContractKey } from "./exampleContracts";

type Severity = "Critical" | "High" | "Medium" | "Low" | "Informational";
type Finding = { title: string; severity: Severity; plainEnglishExplanation: string; suggestedFix: string };
type AuditResult = {
  contractName: string;
  markdown: string;
  mockMode: boolean;
  staticAnalysis: { available: boolean; message: string };
  reasoning: { contractSummary: string; staticFindingsExplained: Finding[]; businessLogicRisks: Finding[] };
};

const severities: Severity[] = ["Critical", "High", "Medium", "Low", "Informational"];
const severityStyle: Record<Severity, string> = {
  Critical: "border-red-400/50 bg-red-500/10 text-red-200", High: "border-orange-400/50 bg-orange-500/10 text-orange-200", Medium: "border-yellow-400/50 bg-yellow-500/10 text-yellow-100", Low: "border-blue-400/50 bg-blue-500/10 text-blue-100", Informational: "border-slate-400/50 bg-slate-400/10 text-slate-200",
};

function DemoStatusBanner() {
  return <aside className="mt-7 rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-5 py-4 text-sm leading-6 text-slate-200">
    <span className="font-semibold text-cyan-300">Demo mode status. </span>
    Static analysis (Slither) is fully live. AI reasoning is currently running in simulated demo mode due to hackathon API credit distribution delays — the live GPT-5.6 integration is fully implemented in <code className="rounded bg-slate-950/60 px-1.5 py-0.5 text-xs text-cyan-200">src/reasoner.ts</code> and activates automatically once <code className="rounded bg-slate-950/60 px-1.5 py-0.5 text-xs text-cyan-200">MOCK_MODE</code> is disabled.
  </aside>;
}

function Findings({ findings }: { findings: Finding[] }) {
  const ordered = [...findings].sort((a, b) => severities.indexOf(a.severity) - severities.indexOf(b.severity));
  if (!ordered.length) return <p className="text-sm text-slate-400">No findings in this section.</p>;
  return <div className="space-y-3">{ordered.map((finding, index) => <article key={`${finding.title}-${index}`} className={`rounded-xl border p-5 ${severityStyle[finding.severity]}`}>
    <div className="mb-3 flex flex-wrap items-center gap-3"><span className="rounded-full border border-current px-2.5 py-1 text-xs font-bold uppercase tracking-wider">{finding.severity}</span><h3 className="font-semibold text-white">{finding.title}</h3></div><p className="leading-6 text-slate-200">{finding.plainEnglishExplanation}</p><div className="mt-4 border-t border-white/10 pt-3 text-sm leading-6 text-slate-300"><span className="font-semibold text-white">Suggested fix: </span>{finding.suggestedFix}</div>
  </article>)}</div>;
}

export default function AuditWorkspace({ mockMode }: { mockMode: boolean }) {
  const [source, setSource] = useState(""); const [file, setFile] = useState<File | null>(null); const [result, setResult] = useState<AuditResult | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const inputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const loadExample = (key: ExampleContractKey) => { setSource(EXAMPLE_CONTRACTS[key].source); setFile(null); setResult(null); setError(""); };
  useEffect(() => { const example = searchParams.get("example"); if (example && example in EXAMPLE_CONTRACTS) loadExample(example as ExampleContractKey); }, [searchParams]);
  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => { const selected = event.target.files?.[0] ?? null; setFile(selected); setResult(null); setError(""); if (selected) selected.text().then(setSource); };
  const audit = async (event: FormEvent) => { event.preventDefault(); setError(""); setResult(null); if (!source.trim() && !file) { setError("Paste Solidity source or upload a .sol file first."); return; } setLoading(true); try { const data = new FormData(); data.set("source", source); if (file) data.set("file", file); const response = await fetch("/api/audit", { method: "POST", body: data }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "The audit could not be completed."); setResult(payload); } catch (err) { setError(err instanceof Error ? err.message : "The audit could not be completed."); } finally { setLoading(false); } };
  const download = () => { if (!result) return; const url = URL.createObjectURL(new Blob([result.markdown], { type: "text/markdown" })); const link = document.createElement("a"); link.href = url; link.download = `${result.contractName.replace(/\.sol$/i, "")}-audit-report.md`; link.click(); URL.revokeObjectURL(url); };
  return <main className="min-h-screen bg-slate-950 text-slate-100"><div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
    <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">Security review workspace</p><h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Perp/Derivatives Contract Auditor</h1><p className="mt-4 max-w-2xl leading-7 text-slate-400">Static analysis from Slither, followed by a focused review of perpetuals, margin, oracle, and liquidation logic.</p></div><Link href="/about" className="shrink-0 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-cyan-400 hover:text-cyan-300">About the project</Link></header>
    {mockMode && <DemoStatusBanner />}
    <form onSubmit={audit} className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-2xl shadow-black/20 sm:p-7"><div className="mb-5"><p className="text-sm font-semibold">Try an example</p><div className="mt-3 flex flex-wrap gap-2">{(Object.keys(EXAMPLE_CONTRACTS) as ExampleContractKey[]).map((key) => <button key={key} type="button" onClick={() => loadExample(key)} className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-cyan-400 hover:text-cyan-300">{EXAMPLE_CONTRACTS[key].label}</button>)}</div></div><label className="mb-3 block text-sm font-semibold">Solidity source</label><textarea value={source} onChange={(e) => { setSource(e.target.value); setFile(null); }} placeholder="pragma solidity ^0.8.20; ..." className="min-h-64 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-500" /><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><input ref={inputRef} type="file" accept=".sol" onChange={chooseFile} className="hidden" /><button type="button" onClick={() => inputRef.current?.click()} className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium hover:border-cyan-400 hover:text-cyan-300">Upload .sol file</button>{file && <span className="ml-3 text-sm text-slate-400">{file.name}</span>}</div><button disabled={loading} className="rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-wait disabled:opacity-60">{loading ? "Auditing contract…" : "Audit Contract"}</button></div>{loading && <p className="mt-5 rounded-lg bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">Running static analysis and AI reasoning. This usually takes 10–30 seconds.</p>}{error && <p role="alert" className="mt-5 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}</form>
    {result && <section className="mt-10 space-y-7"><div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-medium text-cyan-400">AUDIT COMPLETE · {result.contractName}</p>{result.mockMode && <p className="mt-3 inline-block rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">Demo Mode — using simulated AI analysis</p>}<h2 className="mt-2 text-2xl font-bold">Contract summary</h2><p className="mt-3 max-w-3xl leading-7 text-slate-300">{result.reasoning.contractSummary}</p></div><button onClick={download} className="shrink-0 rounded-lg border border-cyan-500/70 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/10">Download Report as Markdown</button></div><p className={`mt-5 text-sm ${result.staticAnalysis.available ? "text-emerald-300" : "text-amber-300"}`}>{result.staticAnalysis.message}</p></div><section><div className="mb-4"><p className="text-sm font-semibold uppercase tracking-wider text-cyan-400">Static Findings Explained</p><h2 className="mt-1 text-2xl font-bold">Static analysis, made actionable</h2></div><Findings findings={result.reasoning.staticFindingsExplained} /></section><section><div className="mb-4"><p className="text-sm font-semibold uppercase tracking-wider text-violet-400">Derivatives-Specific Risks</p><h2 className="mt-1 text-2xl font-bold">Economic and protocol logic review</h2></div><Findings findings={result.reasoning.businessLogicRisks} /></section></section>}
  </div></main>;
}
