import { useState } from "react";
import type { TriageResult, Bucket, Severity } from "../lib/triage";
import { BUCKETS } from "../lib/rules";
import EvidenceText from "./EvidenceText";
import {
  SEVERITY_STYLE,
  SEVERITY_LABELS,
  CONFIDENCE_STYLE,
  BUCKET_STYLE,
  EXPOSURE_LABEL,
  BUCKET_TOOLTIP,
  SEVERITY_TOOLTIP,
  CONFIDENCE_TOOLTIP,
} from "../lib/display";
import Tooltip from "./Tooltip";

interface Props {
  report: string;
  result: TriageResult;
  /** Current effective values (may differ from recommendation after a human override). */
  effectiveBucket?: Bucket;
  effectiveSeverity?: Severity;
  /** True while the async LLM call is in flight. */
  llmPending?: boolean;
}

const SEV_BORDER: Record<Severity, string> = {
  0: "border-l-red-600",
  1: "border-l-orange-500",
  2: "border-l-amber-400",
  3: "border-l-gray-400",
};

function SectionCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-cream-border bg-card shadow-sm">
      <div className="px-4 py-2.5 border-b border-stone-100">
        <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
          {label}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function WhyNotOthers({
  result,
  primaryBucket,
}: {
  result: TriageResult;
  primaryBucket: Bucket;
}) {
  const [open, setOpen] = useState(false);
  const others = BUCKETS.filter((d) => d.key !== primaryBucket);

  return (
    <div className="rounded-xl border border-cream-border bg-card shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 border-b border-stone-100 text-left"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
          Why not other buckets?
        </span>
        <span className="text-stone-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="p-4 space-y-1.5">
          {others.map((d) => {
            const bs = result.bucketScores[d.key];
            const isSecondary = result.secondaryTags.includes(d.key);
            let reason: string;
            if (bs.suppressedBy) {
              reason = bs.suppressedBy;
            } else if (bs.score === 0) {
              reason = "No matching signals found in the report.";
            } else if (isSecondary) {
              reason = `Tagged secondary — ${bs.score} signal${bs.score !== 1 ? "s" : ""} matched but not the root-cause layer.`;
            } else {
              const primaryScore = result.bucketScores[primaryBucket].score;
              reason =
                bs.score < primaryScore
                  ? `Scored ${bs.score} signal${bs.score !== 1 ? "s" : ""} vs. ${primaryScore} for ${primaryBucket} — outweighed.`
                  : `Scored ${bs.score} signal${bs.score !== 1 ? "s" : ""} — lost tie-break to ${primaryBucket} by priority order.`;
            }
            return (
              <div
                key={d.key}
                className="flex items-start gap-2 rounded-md bg-stone-50 px-3 py-2 text-xs ring-1 ring-inset ring-stone-100"
              >
                <span
                  className={`shrink-0 rounded px-1.5 py-0 text-[10px] font-bold leading-4 ${BUCKET_STYLE[d.key]}`}
                >
                  {d.key}
                </span>
                <span className="text-stone-500">{reason}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Confidence accounting for LLM agreement. */
function effectiveConfidence(result: TriageResult): import("../lib/triage").Confidence {
  if (result.llmBucket === undefined) return result.confidence;
  return result.llmBucket === result.primaryBucket ? "High" : "Low";
}

export default function ResultCard({
  report,
  result,
  effectiveBucket,
  effectiveSeverity,
  llmPending,
}: Props) {
  const sev = effectiveSeverity ?? result.severity;
  const bucket = effectiveBucket ?? result.primaryBucket;
  const conf = effectiveConfidence(result);
  const overridden =
    (effectiveBucket && effectiveBucket !== result.primaryBucket) ||
    (effectiveSeverity !== undefined && effectiveSeverity !== result.severity);

  return (
    <div className="space-y-3">
      {/* ── Decision Summary Card ── */}
      <div
        className={`rounded-xl border border-cream-border bg-card shadow-sm border-l-4 ${SEV_BORDER[sev]}`}
      >
        <div className="p-4">
          {/* Top row: Sev + Bucket + Confidence */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Tooltip text={SEVERITY_TOOLTIP[sev]}>
                <span
                  className={`rounded-md px-2.5 py-1 text-sm font-bold ${SEVERITY_STYLE[sev].badge}`}
                >
                  {SEVERITY_LABELS[sev]}
                </span>
              </Tooltip>
              <Tooltip text={BUCKET_TOOLTIP[bucket]}>
                <span
                  className={`rounded px-2.5 py-1 text-sm font-bold ${BUCKET_STYLE[bucket]}`}
                >
                  {bucket}
                </span>
              </Tooltip>
              {result.secondaryTags.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-stone-400 font-semibold uppercase tracking-wide">
                    also
                  </span>
                  {result.secondaryTags.map((t) => (
                    <Tooltip key={t} text={BUCKET_TOOLTIP[t]}>
                      <span className="rounded px-1.5 py-0.5 text-[11px] font-medium text-stone-500 ring-1 ring-inset ring-stone-200">
                        {t}
                      </span>
                    </Tooltip>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {llmPending && (
                <span className="text-[11px] text-stone-400 animate-pulse">LLM…</span>
              )}
              {result.llmBucket !== undefined && !llmPending && (
                result.llmBucket === result.primaryBucket ? (
                  <span className="text-[11px] font-semibold text-emerald-600">LLM ✓</span>
                ) : (
                  <span className="text-[11px] font-semibold text-amber-600">LLM ≠</span>
                )
              )}
              <Tooltip text={CONFIDENCE_TOOLTIP[conf]}>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${CONFIDENCE_STYLE[conf]}`}
                >
                  {conf}
                </span>
              </Tooltip>
            </div>
          </div>

          {/* Why bullets */}
          <ul className="space-y-1.5 text-xs">
            <li className="flex items-start gap-1.5">
              <span className={`mt-0.5 shrink-0 font-bold ${SEVERITY_STYLE[sev].text}`}>
                •
              </span>
              <span className={`font-medium ${SEVERITY_STYLE[sev].text}`}>
                {result.severityReason}
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 shrink-0 text-stone-300">•</span>
              <span className="text-stone-600">{result.ruleApplied}</span>
            </li>
            {result.systemicScope && (
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0 text-stone-300">•</span>
                <span className="text-stone-500">
                  Scope judged systemic — root cause is a prompt / policy / config change.
                </span>
              </li>
            )}
            {result.exposure.length > 0 && (
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0 text-red-400">•</span>
                <div className="flex flex-wrap gap-1">
                  {result.exposure.map((e) => (
                    <span
                      key={e}
                      className="rounded bg-red-50 px-1.5 py-0 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-200"
                    >
                      {EXPOSURE_LABEL[e]}
                    </span>
                  ))}
                </div>
              </li>
            )}
          </ul>

          {/* Owner row */}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
              Owner
            </span>
            <span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-800">
              {result.routing.owner}
            </span>
            {result.routing.parallel && (
              <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                ‖ {result.routing.parallel}
              </span>
            )}
            {result.routing.urgent && (
              <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700 ring-1 ring-inset ring-orange-300">
                URGENT
              </span>
            )}
          </div>
        </div>
      </div>

      {/* LLM conflict notice */}
      {result.llmBucket !== undefined &&
        result.llmBucket !== result.primaryBucket && (
          <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
            <strong>LLM suggests {result.llmBucket}</strong> — {result.llmReason ?? "no reason provided"}.
            Confidence lowered to Low; human review recommended.
          </div>
        )}

      {/* PII detected */}
      {result.piiDetected && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-800 ring-1 ring-inset ring-red-300">
          <strong>PII detected</strong> — SSN pattern found in the report text. Do not share this report externally and handle per your data-handling policy.
        </div>
      )}

      {/* Multiple root causes */}
      {result.multipleRootCauses && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
          <strong>Multiple root causes likely</strong> — signals from {result.multipleRootCauses.join(", ")} all fired. Consider splitting into separate tickets before routing.
        </div>
      )}

      {/* Not a bug */}
      {result.notABug && (
        <div className="rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-800 ring-1 ring-inset ring-sky-200">
          <strong>Possible feature request</strong> — this report reads like an enhancement, not a defect. Confirm whether this is a bug before routing.
        </div>
      )}

      {/* Impact conflict */}
      {result.impactConflict && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
          <strong>Impact conflict:</strong> {result.impactConflict}
        </div>
      )}

      {/* Override notice */}
      {overridden && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
          Human override active. Engine recommended{" "}
          <strong>{result.primaryBucket}</strong> /{" "}
          <strong>{SEVERITY_LABELS[result.severity]}</strong>.
        </div>
      )}

      {/* ── Evidence ── */}
      <SectionCard label="Evidence">
        <div className="rounded-md bg-stone-50 p-3 ring-1 ring-inset ring-stone-100 text-sm leading-relaxed">
          <EvidenceText report={report} evidence={result.evidence} />
        </div>
        <div className="mt-2 flex gap-3 text-[11px] text-stone-400">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded bg-violet-200" /> bucket signal
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded bg-amber-200" /> exposure cue
          </span>
        </div>
      </SectionCard>

      {/* ── Signals matched (always visible) ── */}
      <SectionCard label="Signals matched">
        <div className="space-y-2">
          {/* Decision rule */}
          <div className="rounded-md bg-stone-50 px-3 py-2 text-xs text-stone-600 ring-1 ring-inset ring-stone-100">
            <span className="font-semibold text-stone-700">Decision rule: </span>
            {result.ruleApplied}
          </div>

          {/* Per-bucket score rows */}
          <div className="space-y-1">
            {BUCKETS.map((d) => {
              const bs = result.bucketScores[d.key];
              const isPrimary = d.key === result.primaryBucket;
              const isSecondary = result.secondaryTags.includes(d.key);
              const hasSignals = bs.score > 0 && !bs.suppressedBy;

              return (
                <div
                  key={d.key}
                  className={`flex items-start gap-2 rounded-md px-3 py-2 text-xs ring-1 ring-inset ${
                    isPrimary
                      ? "bg-stone-900 text-white ring-stone-700"
                      : isSecondary
                        ? "bg-stone-100 text-stone-700 ring-stone-200"
                        : "bg-stone-50 text-stone-500 ring-stone-100"
                  }`}
                >
                  <span
                    className={`shrink-0 w-3 text-center font-bold text-[11px] ${
                      isPrimary ? "text-white/60" : "text-stone-400"
                    }`}
                  >
                    {hasSignals ? "✓" : "—"}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0 text-[10px] font-bold leading-4 ${
                      isPrimary ? "bg-white/20 text-white" : BUCKET_STYLE[d.key]
                    }`}
                  >
                    {d.key}
                  </span>
                  <div className="flex-1 min-w-0">
                    {bs.suppressedBy ? (
                      <span className="italic">{bs.suppressedBy}</span>
                    ) : bs.score === 0 ? (
                      <span>No signals matched</span>
                    ) : (
                      <span>
                        {bs.signals.map((sig, i) => (
                          <span key={i}>
                            <code
                              className={`rounded px-1 ${
                                isPrimary
                                  ? "bg-white/20"
                                  : "bg-stone-200 text-stone-700"
                              }`}
                            >
                              {sig}
                            </code>
                            {i < bs.signals.length - 1 ? " · " : ""}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                  <span
                    className={`shrink-0 font-mono text-[11px] font-bold ${
                      isPrimary ? "text-white/70" : "text-stone-400"
                    }`}
                  >
                    {bs.suppressedBy ? "—" : bs.score}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </SectionCard>

      {/* ── Why not other buckets (collapsible) ── */}
      <WhyNotOthers result={result} primaryBucket={bucket} />

      {/* ── Check first ── */}
      {result.routing.checkFirst.length > 0 && (
        <SectionCard label="Check first">
          <ul className="ml-4 list-disc space-y-1 text-sm text-stone-700">
            {result.routing.checkFirst.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* ── Next questions ── */}
      <SectionCard label="Next questions">
        <ol className="ml-4 list-decimal space-y-1 text-sm text-stone-700">
          {result.nextQuestions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ol>
      </SectionCard>
    </div>
  );
}
