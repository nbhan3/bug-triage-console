// BatchResults.tsx — "Run all examples" results table.
//
// Classifies all SEEDS through the deterministic rules engine and renders a
// screenshot-ready table: #, Report, Bucket, Severity, Confidence, Evidence, Exposure.
// No LLM calls here — results are synchronous and stable for comparison.

import { useMemo, useState } from "react";
import { triage } from "../lib/triage";
import { SEEDS } from "../lib/seeds";
import { SEVERITY_STYLE, SEVERITY_LABELS, BUCKET_STYLE, CONFIDENCE_STYLE, EXPOSURE_LABEL, BUCKET_TOOLTIP, SEVERITY_TOOLTIP, CONFIDENCE_TOOLTIP } from "../lib/display";
import Tooltip from "./Tooltip";

export default function BatchResults() {
  const [ran, setRan] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const results = useMemo(() => {
    if (!ran) return [];
    return SEEDS.map((seed) => ({
      seed,
      result: triage({
        bugReport: seed.bugReport,
        customer: `Example #${seed.id}`,
        impact: seed.impact,
      }),
    }));
  }, [ran]);

  if (!ran) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-sm text-stone-500 text-center max-w-md">
          Runs all 15 sample reports through the deterministic rules engine and shows
          the results in a table — useful for screenshots and auditing engine output.
        </p>
        <button
          onClick={() => setRan(true)}
          className="rounded-md bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 transition-colors"
        >
          Run all 15 examples →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-ink">Batch results — {SEEDS.length} examples</h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Deterministic rules engine · no LLM · results are reproducible
          </p>
        </div>
        <button
          onClick={() => setRan(false)}
          className="text-xs text-stone-400 hover:text-stone-600"
        >
          Reset
        </button>
      </div>

      <div className="rounded-xl border border-cream-border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-stone-100 text-[10px] uppercase tracking-widest text-stone-400">
              <th className="px-3 py-3 font-semibold w-8">#</th>
              <th className="px-3 py-3 font-semibold">Report</th>
              <th className="px-3 py-3 font-semibold">Bucket</th>
              <th className="px-3 py-3 font-semibold">Severity</th>
              <th className="px-3 py-3 font-semibold">Confidence</th>
              <th className="px-3 py-3 font-semibold">Evidence</th>
              <th className="px-3 py-3 font-semibold">Exposure</th>
            </tr>
          </thead>
          <tbody>
            {results.map(({ seed, result }) => (
              <tr
                key={seed.id}
                className="border-b border-stone-50 hover:bg-stone-50 align-top"
              >
                <td className="px-3 py-3 font-mono text-stone-400">{seed.id}</td>

                <td className="px-3 py-3 max-w-[260px]">
                  <p className="text-stone-700 leading-snug">
                    {expanded.has(seed.id) || seed.bugReport.length <= 100
                      ? seed.bugReport
                      : seed.bugReport.slice(0, 100) + "…"}
                  </p>
                  {seed.bugReport.length > 100 && (
                    <button
                      onClick={() => toggle(seed.id)}
                      className="mt-1 text-[10px] font-medium text-stone-400 hover:text-stone-600 transition-colors"
                    >
                      {expanded.has(seed.id) ? "Show less ↑" : "Show more ↓"}
                    </button>
                  )}
                  <p className="mt-0.5 text-[10px] text-stone-400 uppercase tracking-wide">
                    {seed.impact === "outage" ? "Outage" : seed.impact === "many" ? "Many callers" : "Single caller"}
                  </p>
                </td>

                <td className="px-3 py-3">
                  <Tooltip text={BUCKET_TOOLTIP[result.primaryBucket]}>
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${BUCKET_STYLE[result.primaryBucket]}`}>
                      {result.primaryBucket}
                    </span>
                  </Tooltip>
                  {result.secondaryTags.map((t) => (
                    <Tooltip key={t} text={BUCKET_TOOLTIP[t]}>
                      <span className="ml-1 rounded px-1 py-0 text-[10px] font-medium text-stone-400 ring-1 ring-inset ring-stone-200">
                        +{t}
                      </span>
                    </Tooltip>
                  ))}
                </td>

                <td className="px-3 py-3">
                  <Tooltip text={SEVERITY_TOOLTIP[result.severity]}>
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${SEVERITY_STYLE[result.severity].badge}`}>
                      {SEVERITY_LABELS[result.severity]}
                    </span>
                  </Tooltip>
                  <p className="mt-1 text-[10px] text-stone-500 max-w-[160px] leading-tight">
                    {result.severityReason}
                  </p>
                </td>

                <td className="px-3 py-3">
                  <Tooltip text={CONFIDENCE_TOOLTIP[result.confidence]}>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CONFIDENCE_STYLE[result.confidence]}`}>
                      {result.confidence}
                    </span>
                  </Tooltip>
                </td>

                <td className="px-3 py-3 max-w-[200px]">
                  <div className="flex flex-wrap gap-1">
                    {result.evidence
                      .filter((e) => e.kind === "bucket")
                      .slice(0, 3)
                      .map((e, i) => (
                        <code
                          key={i}
                          className="rounded bg-violet-100 px-1 py-0 text-[10px] text-violet-800"
                        >
                          {e.text}
                        </code>
                      ))}
                    {result.evidence.filter((e) => e.kind === "bucket").length > 3 && (
                      <span className="text-[10px] text-stone-400">
                        +{result.evidence.filter((e) => e.kind === "bucket").length - 3} more
                      </span>
                    )}
                    {result.evidence.filter((e) => e.kind === "bucket").length === 0 && (
                      <span className="text-[10px] text-stone-400 italic">no signals</span>
                    )}
                  </div>
                </td>

                <td className="px-3 py-3">
                  <div className="flex flex-col gap-0.5">
                    {result.exposure.length === 0 ? (
                      <span className="text-[10px] text-stone-300">—</span>
                    ) : (
                      result.exposure.map((e) => (
                        <span
                          key={e}
                          className="rounded bg-red-50 px-1.5 py-0 text-[10px] font-semibold text-red-700 ring-1 ring-inset ring-red-200"
                        >
                          {EXPOSURE_LABEL[e]}
                        </span>
                      ))
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-stone-400">
        All results computed by the deterministic rules engine in{" "}
        <code>src/lib/triage.ts</code>. No answers are hardcoded — the engine classifies
        from signal matches against the lexicons in <code>src/lib/rules.ts</code>.
      </p>
    </div>
  );
}
