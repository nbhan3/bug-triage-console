import { useState } from "react";
import { newId, saveFlag, type FlagCategory } from "../lib/storage";
import { BUCKET_STYLE, SEVERITY_STYLE, SEVERITY_LABELS } from "../lib/display";
import type { Bucket, Severity } from "../lib/triage";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const BUCKETS: { key: Bucket; owner: string; layer: string; description: string }[] = [
  {
    key: "STT",
    owner: "Voice AI",
    layer: "Speech-to-text",
    description:
      "The agent mis-recognized the caller's words. Transcripts, [inaudible] spans, accent or language mismatches, recognition mapping gaps.",
  },
  {
    key: "TTS",
    owner: "Voice AI",
    layer: "Text-to-speech",
    description:
      "The agent's output audio is wrong: robotic or garbled voice, mispronunciation, cut-offs, broken barge-in, slow speech.",
  },
  {
    key: "LLM",
    owner: "LLM / Conversation",
    layer: "LLM / Conversation policy",
    description:
      "The agent reasoned, decided, or spoke wrongly: wrong intent, hallucination, loops, refusals, threats, tool or lookup misuse. Usually prompt/policy-driven and therefore systemic.",
  },
  {
    key: "Post-call",
    owner: "Integrations / Post-call",
    layer: "Post-call processing",
    description:
      "The call succeeded but downstream did not: missing or duplicate CRM writes, bad summaries, wrong dispositions, QA label errors, webhook delivery failures.",
  },
  {
    key: "Infrastructure",
    owner: "Platform / Infra",
    layer: "Transport / Platform",
    description:
      "Transport or platform failed: 5xx errors, endpoint or DB failures, telephony or carrier issues, storage, recording retrieval, auth, rate limits, outages.",
  },
];

const SEVERITIES: { sev: Severity; when: string }[] = [
  { sev: 0, when: "Outage — or any compliance threat (FDCPA false/illegal threat)" },
  { sev: 1, when: "Many callers affected — or compliance misrep, financial impact, data loss" },
  { sev: 2, when: "Single caller, systemic root cause (prompt / policy / config)" },
  { sev: 3, when: "Single caller, isolated, no regulatory exposure" },
];

const PRECEDENCE = [
  {
    rule: "Explicit transport / HTTP / storage failure",
    outcome: "Infrastructure wins over Post-call.",
    example: "A 500 on /webhook/call-ended is an Infra failure, not a post-call logic bug.",
  },
  {
    rule: "Output-audio symptom present",
    outcome: "TTS wins over STT.",
    example: '"Robotic", "garbled", "mispronounced", "cuts off", "slow to speak".',
  },
  {
    rule: '"Audio is fine" but transcript is wrong',
    outcome: "STT wins; TTS and Infra suppressed.",
    example: "The caller's words were clear — recognition failed.",
  },
  {
    rule: "Language / accent cue",
    outcome: "STT primary, LLM tagged secondary.",
    example: "Agent keeps answering in English to a Spanish caller.",
  },
  {
    rule: "Reasoning or tool failure",
    outcome: "LLM, not Infra.",
    example: 'Agent "insists" or "won\'t check" — that is policy, not a DB failure.',
  },
  {
    rule: "All else equal",
    outcome: "Highest score wins; ties break by Infra → LLM → TTS → STT → Post-call.",
    example: "A tie caps confidence at Medium.",
  },
];

const EXPOSURE_ROWS = [
  {
    tag: "Compliance — threat",
    floor: "Sev0",
    why: "A false or illegal threat (arrested, lawsuit, garnish, legal action) is a per-se FDCPA violation. Prompt-driven = systemic across all calls.",
  },
  {
    tag: "Compliance — misrep",
    floor: "Sev1",
    why: "Misrepresentation or consent/disclosure problems: wrong amount, missing disclosure, agent insists on incorrect information.",
  },
  {
    tag: "Financial",
    floor: "Sev1",
    why: "Customer money is involved: payments, charges, refunds, double-logging, collections amounts.",
  },
  {
    tag: "Data loss / audit",
    floor: "Sev1 → Sev0 if widespread",
    why: "Missing summaries, unsaved records, lost recordings — an audit gap that escalates when the text shows breadth.",
  },
];

const FLAG_CATEGORIES: { value: FlagCategory; label: string }[] = [
  { value: "wrong-bucket", label: "Wrong bucket (root-cause layer)" },
  { value: "wrong-severity", label: "Wrong severity" },
  { value: "missing-evidence", label: "Missing or incorrect evidence" },
  { value: "false-positive", label: "False positive exposure tag" },
  { value: "other", label: "Other" },
];

// ---------------------------------------------------------------------------
// Sub-sections
// ---------------------------------------------------------------------------

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-bold text-ink border-b border-cream-border pb-2">
      {children}
    </h2>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">
      {children}
    </div>
  );
}

function BucketTable() {
  return (
    <div className="overflow-x-auto rounded-xl border border-cream-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-cream-border bg-cream/60 text-[10px] uppercase tracking-widest text-stone-400">
            <th className="px-4 py-2.5 text-left font-semibold">Bucket</th>
            <th className="px-4 py-2.5 text-left font-semibold">Root-cause layer</th>
            <th className="px-4 py-2.5 text-left font-semibold">Owner</th>
            <th className="px-4 py-2.5 text-left font-semibold">What it covers</th>
          </tr>
        </thead>
        <tbody className="bg-card">
          {BUCKETS.map((b, i) => (
            <tr key={b.key} className={i < BUCKETS.length - 1 ? "border-b border-cream-border" : ""}>
              <td className="px-4 py-3">
                <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${BUCKET_STYLE[b.key]}`}>
                  {b.key}
                </span>
              </td>
              <td className="px-4 py-3 font-medium text-stone-700">{b.layer}</td>
              <td className="px-4 py-3 text-stone-500">{b.owner}</td>
              <td className="px-4 py-3 text-stone-600">{b.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeverityTable() {
  return (
    <div className="space-y-2">
      {SEVERITIES.map(({ sev, when }) => (
        <div key={sev} className="flex items-start gap-3 rounded-xl border border-cream-border bg-card px-4 py-3">
          <span className={`mt-0.5 shrink-0 rounded px-2 py-0.5 text-xs font-bold ${SEVERITY_STYLE[sev].badge}`}>
            {SEVERITY_LABELS[sev]}
          </span>
          <span className="text-sm text-stone-600">{when}</span>
        </div>
      ))}
      <p className="text-xs text-stone-400 pt-1">
        Severity adjusters: intermittent reports ("sometimes", "occasionally", workaround present) de-escalate one step.
        Exposure floors can only raise severity, never lower it.
        Prompt / policy / config root causes trigger a systemic floor of at least Sev1.
      </p>
    </div>
  );
}

function TwoAxisDiagram() {
  const W = 640;
  const H = 400;

  // Plot bounds
  const px0 = 132, px1 = 590, py0 = 55, py1 = 335;

  // Column x positions
  const xSingle = 197;
  const xMany = 363;
  const xOutage = 528;

  // Row y positions
  const yNone = 315;
  const yFinancial = 210;
  const yIllegal = 100;

  // Harm zone: from plot top to midpoint between None and Financial
  const harmZoneBottom = (yNone + yFinancial) / 2; // 262.5

  const SEV_COLOR = ["#dc2626", "#f97316", "#a16207", "#a1a1aa"];
  const SEV_LEGEND = ["Sev0 — page on-call", "Sev1 — same-day", "Sev2 — backlog", "Sev3 — monitor"];

  const POINTS: Array<{
    cx: number; cy: number; sev: number;
    label: string; lx: number; ly: number; anchor: "start" | "middle" | "end";
  }> = [
    { cx: xSingle, cy: yNone,        sev: 3, label: "cosmetic one-off",              lx: xSingle,      ly: yNone + 18,      anchor: "middle" },
    { cx: 268,     cy: yNone,        sev: 2, label: "#6  loops a question",           lx: 268,          ly: yNone - 14,      anchor: "middle" },
    { cx: xMany,   cy: yNone,        sev: 1, label: "#2  robotic voice (many)",       lx: xMany,        ly: yNone + 18,      anchor: "middle" },
    { cx: xOutage, cy: yNone,        sev: 0, label: "#9  carrier connect ~0",         lx: xOutage,      ly: yNone - 14,      anchor: "middle" },
    { cx: xSingle, cy: yFinancial,   sev: 1, label: '#13  insists "not paid"',        lx: xSingle + 13, ly: yFinancial + 4,  anchor: "start"  },
    { cx: 278,     cy: yFinancial+8, sev: 1, label: "#11  double-logs payment",       lx: 278 + 13,     ly: yFinancial + 14, anchor: "start"  },
    { cx: xMany+18,cy: yFinancial-20,sev: 1, label: "#15  misreads $1,020 as $120",  lx: xMany + 32,   ly: yFinancial - 22, anchor: "start"  },
    { cx: 420,     cy: 152,          sev: 0, label: "#14  recordings lost (many)",    lx: 420 + 13,     ly: 156,             anchor: "start"  },
    { cx: xSingle, cy: yIllegal,     sev: 0, label: '#3  "you\'ll be arrested"',      lx: xSingle + 13, ly: yIllegal + 4,   anchor: "start"  },
  ];

  return (
    <figure className="rounded-xl border border-cream-border bg-white overflow-hidden">
      {/* Title */}
      <div className="pt-4 pb-1 text-center">
        <span className="text-sm font-bold text-stone-800">The Two-Axis Severity Model</span>
        <span className="text-sm text-stone-400 mx-1">·</span>
        <span className="text-sm text-stone-500">example cases plotted</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}
        aria-label="Two-axis severity model chart"
      >
        <defs>
          <marker id="sev-arrow" markerWidth="7" markerHeight="5" refX="5.5" refY="2.5" orient="auto">
            <polygon points="0 0, 7 2.5, 0 5" fill="#dc2626" />
          </marker>
        </defs>

        {/* Harm override zone background */}
        <rect x={px0} y={py0} width={px1 - px0} height={harmZoneBottom - py0} fill="#fef2f2" />

        {/* Plot border */}
        <rect x={px0} y={py0} width={px1 - px0} height={py1 - py0}
          fill="none" stroke="#d6d3d1" strokeWidth="1" />

        {/* Harm zone dashed boundary */}
        <line x1={px0} y1={harmZoneBottom} x2={px1} y2={harmZoneBottom}
          stroke="#fca5a5" strokeWidth="1" strokeDasharray="5 3" />

        {/* Horizontal level guide lines */}
        <line x1={px0} y1={yNone}      x2={px1} y2={yNone}      stroke="#d6d3d1" strokeWidth="0.75" />
        <line x1={px0} y1={yFinancial} x2={px1} y2={yFinancial} stroke="#e7e5e4" strokeWidth="0.75" strokeDasharray="3 3" />
        <line x1={px0} y1={yIllegal}   x2={px1} y2={yIllegal}   stroke="#e7e5e4" strokeWidth="0.75" strokeDasharray="3 3" />

        {/* Vertical column guide lines */}
        {[xSingle, xMany, xOutage].map((x) => (
          <line key={x} x1={x} y1={py0} x2={x} y2={py1}
            stroke="#e7e5e4" strokeWidth="0.75" strokeDasharray="3 3" />
        ))}

        {/* HARM OVERRIDE ZONE label */}
        <text x={px1 - 8} y={py0 + 16} textAnchor="end"
          fontSize="9" fontWeight="700" fill="#ef4444" letterSpacing="0.08em">
          HARM OVERRIDE ZONE
        </text>

        {/* Y-axis labels */}
        <text x={px0 - 9} y={yIllegal + 4}  textAnchor="end" fontSize="10.5" fontWeight="500" fill="#57534e">Illegal threat</text>
        <text x={px0 - 9} y={yIllegal + 16} textAnchor="end" fontSize="10"   fill="#78716c">(FDCPA)</text>
        <text x={px0 - 9} y={yFinancial - 5} textAnchor="end" fontSize="10.5" fontWeight="500" fill="#57534e">Financial /</text>
        <text x={px0 - 9} y={yFinancial + 8} textAnchor="end" fontSize="10"   fill="#78716c">misrepresentation</text>
        <text x={px0 - 9} y={yNone + 4}      textAnchor="end" fontSize="10.5" fontWeight="500" fill="#57534e">None</text>

        {/* Y-axis tick marks */}
        {[yIllegal, yFinancial, yNone].map((y) => (
          <line key={y} x1={px0 - 4} y1={y} x2={px0} y2={y} stroke="#a8a29e" strokeWidth="1" />
        ))}

        {/* Y-axis label (rotated) */}
        <text
          transform={`translate(16, ${(py0 + py1) / 2}) rotate(-90)`}
          textAnchor="middle" fontSize="11" fontWeight="700" fill="#292524"
        >
          Axis 2 — Compliance / financial harm  →
        </text>

        {/* Y-axis arrow tip */}
        <polygon points={`${px0},${py0} ${px0 - 4},${py0 + 7} ${px0 + 4},${py0 + 7}`} fill="#a8a29e" />

        {/* X-axis labels */}
        {[
          { x: xSingle, label: "Single caller" },
          { x: xMany,   label: "Many callers"  },
          { x: xOutage, label: "Outage"         },
        ].map(({ x, label }) => (
          <text key={x} x={x} y={py1 + 18} textAnchor="middle" fontSize="11" fill="#57534e">{label}</text>
        ))}

        {/* X-axis tick marks */}
        {[xSingle, xMany, xOutage].map((x) => (
          <line key={x} x1={x} y1={py1} x2={x} y2={py1 + 4} stroke="#a8a29e" strokeWidth="1" />
        ))}

        {/* X-axis arrow tip */}
        <polygon points={`${px1},${py1} ${px1 - 7},${py1 - 3} ${px1 - 7},${py1 + 3}`} fill="#a8a29e" />

        {/* X-axis label */}
        <text x={(px0 + px1) / 2} y={H - 10} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#292524">
          Axis 1 — Operational impact  →
        </text>

        {/* Annotation arrow: text to point #3 */}
        <line
          x1={270} y1={162}
          x2={xSingle + 9} y2={yIllegal + 6}
          stroke="#dc2626" strokeWidth="1.5" markerEnd="url(#sev-arrow)"
        />
        <text x={275} y={153} fontSize="10" fontWeight="700" fill="#dc2626">Single caller, but Sev0:</text>
        <text x={275} y={165} fontSize="10" fontWeight="700" fill="#dc2626">harm overrides volume</text>

        {/* Data points (rendered last so they sit on top) */}
        {POINTS.map((p, i) => (
          <g key={i}>
            <circle cx={p.cx} cy={p.cy} r={8} fill={SEV_COLOR[p.sev]} opacity={0.9} />
            <text x={p.lx} y={p.ly} textAnchor={p.anchor} fontSize="10" fill="#292524">
              {p.label}
            </text>
          </g>
        ))}

        {/* Legend — 2×2 in top-left of plot */}
        {[0, 1, 2, 3].map((sev) => {
          const col = sev % 2;
          const row = Math.floor(sev / 2);
          const lx = px0 + 8 + col * 150;
          const ly = py0 + 8 + row * 17;
          return (
            <g key={sev}>
              <rect x={lx} y={ly} width={110 + (col === 0 ? 8 : 0)} height={14} rx={2} fill="white" fillOpacity={0.75} />
              <circle cx={lx + 7} cy={ly + 7} r={5} fill={SEV_COLOR[sev]} opacity={0.9} />
              <text x={lx + 17} y={ly + 10} fontSize="9.5" fill="#57534e">{SEV_LEGEND[sev]}</text>
            </g>
          );
        })}
      </svg>

      {/* Caption */}
      <figcaption className="px-5 pb-4 text-xs text-center text-stone-500 italic leading-relaxed">
        Severity is the higher of the two axes. Operational impact sets a floor; a compliance or financial
        harm raises it regardless of volume.
      </figcaption>
    </figure>
  );
}

function PrecedenceList() {
  return (
    <ol className="space-y-3">
      {PRECEDENCE.map((p, i) => (
        <li key={i} className="rounded-xl border border-cream-border bg-card px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-white">
              {i + 1}
            </span>
            <div>
              <div className="text-sm font-semibold text-ink">{p.rule} → {p.outcome}</div>
              <div className="mt-0.5 text-xs text-stone-500">{p.example}</div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ExposureTable() {
  return (
    <div className="overflow-x-auto rounded-xl border border-cream-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-cream-border bg-cream/60 text-[10px] uppercase tracking-widest text-stone-400">
            <th className="px-4 py-2.5 text-left font-semibold">Tag</th>
            <th className="px-4 py-2.5 text-left font-semibold">Severity floor</th>
            <th className="px-4 py-2.5 text-left font-semibold">Why it matters</th>
          </tr>
        </thead>
        <tbody className="bg-card">
          {EXPOSURE_ROWS.map((e, i) => (
            <tr key={e.tag} className={i < EXPOSURE_ROWS.length - 1 ? "border-b border-cream-border" : ""}>
              <td className="px-4 py-3 font-semibold text-red-700">{e.tag}</td>
              <td className="px-4 py-3 font-mono text-xs font-bold text-stone-700">{e.floor}</td>
              <td className="px-4 py-3 text-stone-600">{e.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flag form
// ---------------------------------------------------------------------------

function FlagForm() {
  const [category, setCategory] = useState<FlagCategory>("wrong-bucket");
  const [queueItemId, setQueueItemId] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = description.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    saveFlag({
      id: newId(),
      at: new Date().toISOString(),
      category,
      queueItemId: queueItemId.trim() || undefined,
      description: description.trim(),
    });
    setDescription("");
    setQueueItemId("");
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  };

  const inputCls =
    "w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-300 focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink";

  return (
    <div className="rounded-xl border border-cream-border bg-card p-5 space-y-4">
      <div>
        <Label>Category</Label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as FlagCategory)}
          className={inputCls}
        >
          {FLAG_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <Label>Queue item ID <span className="normal-case text-stone-300">(optional)</span></Label>
        <input
          value={queueItemId}
          onChange={(e) => setQueueItemId(e.target.value)}
          placeholder="BTC-..."
          className={`${inputCls} font-mono`}
        />
      </div>

      <div>
        <Label>Description <span className="text-red-400">*</span></Label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Describe what the engine got wrong and what the correct classification should be..."
          className={`${inputCls} resize-y`}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
        >
          Submit flag
        </button>
        {submitted && (
          <span className="text-sm font-medium text-emerald-600">
            Flag recorded — thank you.
          </span>
        )}
      </div>
      <p className="text-xs text-stone-400">
        Flags are stored locally and reviewed by the CS &amp; Engineering team to improve the rules engine.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function Methodology() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">

      {/* Overview */}
      <section className="space-y-3">
        <SectionHeading>How this tool works</SectionHeading>
        <p className="text-sm leading-relaxed text-stone-600">
          The Bug Triage Console is a deterministic, rules-based triage engine for Salient voice agent
          issues. It classifies every report by the <strong className="text-ink">root-cause layer</strong> —
          not the surface symptom — because the same symptom can originate in different parts of the
          pipeline, and the layer determines who owns the fix.
        </p>
        <p className="text-sm leading-relaxed text-stone-600">
          There are no model calls. Every decision is a case-insensitive substring match against the
          signal lexicons in <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">rules.ts</code>.
          This makes every recommendation reproducible, auditable, and tunable by the team without
          touching engine logic.
        </p>
        <div className="flex flex-wrap gap-4 pt-1">
          {[
            { label: "Auditable", detail: "Matched evidence highlighted in every result" },
            { label: "Safe", detail: "Recommendation only — routing requires explicit confirmation" },
            { label: "Deterministic", detail: "Same input always produces the same output" },
          ].map((p) => (
            <div key={p.label} className="rounded-xl border border-cream-border bg-card px-4 py-3 flex-1 min-w-[160px]">
              <div className="text-sm font-bold text-ink">{p.label}</div>
              <div className="text-xs text-stone-500 mt-0.5">{p.detail}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Buckets */}
      <section className="space-y-3">
        <SectionHeading>The five buckets</SectionHeading>
        <p className="text-sm text-stone-600">
          A voice call passes through: telephony / infra → speech-to-text → LLM / conversation policy →
          text-to-speech → post-call processing. Each bucket maps to one of these layers.
        </p>
        <BucketTable />
      </section>

      {/* Precedence */}
      <section className="space-y-3">
        <SectionHeading>Precedence rules</SectionHeading>
        <p className="text-sm text-stone-600">
          When signals from multiple buckets fire, these rules resolve the collision in order.
          They encode the "classify by root cause, not symptom" principle.
        </p>
        <PrecedenceList />
      </section>

      {/* Severity */}
      <section className="space-y-3">
        <SectionHeading>Severity model</SectionHeading>
        <p className="text-sm text-stone-600">
          Severity runs Sev0 (most severe) to Sev3 (least). The base comes from the Impact dropdown;
          exposure floors and the systemic-scope rule can only raise it, never lower it.
        </p>
        <SeverityTable />
        <TwoAxisDiagram />
      </section>

      {/* Exposure */}
      <section className="space-y-3">
        <SectionHeading>Compliance &amp; financial exposure</SectionHeading>
        <p className="text-sm text-stone-600">
          Exposure tags are detected independently of the bucket. When any tag fires, a parallel
          <strong className="text-ink"> Compliance / Risk</strong> lane opens alongside the technical owner,
          and the item is flagged urgent if it is Sev0 or Sev1.
        </p>
        <ExposureTable />
      </section>

      {/* Confidence */}
      <section className="space-y-3">
        <SectionHeading>Confidence</SectionHeading>
        <div className="space-y-2">
          {[
            { level: "High", condition: "Top bucket leads by ≥ 2 distinct signals and there are ≥ 2 total signals." },
            { level: "Medium", condition: "Everything else — some signal, not dominant." },
            { level: "Low", condition: "Margin is 0, ≤ 1 total signal, report is very short/vague, or primary came from a tie." },
          ].map((c) => (
            <div key={c.level} className="flex items-start gap-3 rounded-xl border border-cream-border bg-card px-4 py-3">
              <span className="shrink-0 text-sm font-bold text-ink w-16">{c.level}</span>
              <span className="text-sm text-stone-600">{c.condition}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-stone-400">
          When confidence is Low, the recommended next questions lead with a disambiguating question
          naming the competing root-cause layers.
        </p>
      </section>

      {/* Flag */}
      <section className="space-y-3">
        <SectionHeading>Flag an engine error</SectionHeading>
        <p className="text-sm text-stone-600">
          If the engine classified a report incorrectly — wrong bucket, wrong severity, missed evidence,
          or a spurious exposure tag — flag it here. Flags are reviewed by the CS &amp; Engineering team
          to improve the rules lexicon.
        </p>
        <FlagForm />
      </section>

    </div>
  );
}
