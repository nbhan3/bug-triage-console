// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface Feature {
  term: string;
  detail: string;
}

interface HorizonConfig {
  version: "v1" | "v2" | "v3";
  phase: "Now" | "Next" | "Later";
  title: string;
  subtitle: string;
  features: Feature[];
  colors: {
    versionBadge: string;
    phasePill: string;
    leftBar: string;
    stepDot: string;
    stepLine: string;
    stepLabel: string;
  };
}

const HORIZONS: HorizonConfig[] = [
  {
    version: "v1",
    phase: "Now",
    title: "Make it real in the workflow",
    subtitle: "Plug into where the work already happens",
    colors: {
      versionBadge: "bg-emerald-100 text-emerald-700 border border-emerald-200",
      phasePill:    "bg-emerald-50 text-emerald-600 border border-emerald-200",
      leftBar:      "bg-emerald-400",
      stepDot:      "bg-emerald-500 ring-4 ring-emerald-100",
      stepLine:     "bg-emerald-200",
      stepLabel:    "text-emerald-700",
    },
    features: [
      {
        term: "Real intake, not paste.",
        detail: "Pull reports straight from Slack, Zendesk, and email, and auto-fill the customer, call ID, and timestamps so CS isn't retyping.",
      },
      {
        term: "Close the loop with engineering.",
        detail: "On Confirm & Route, file straight to Linear or Jira with the evidence and questions attached, and sync status back.",
      },
      {
        term: "SLA timers by severity.",
        detail: "Tie each level to a real timer and escalation, so severity drives action instead of just labeling it.",
      },
      {
        term: "Give the Compliance/Risk lane its own queue.",
        detail: "Its own owner and SLA, because in lending that's the one that can't wait.",
      },
    ],
  },
  {
    version: "v2",
    phase: "Next",
    title: "Make it learn",
    subtitle: "It gets better the more it's used",
    colors: {
      versionBadge: "bg-violet-100 text-violet-700 border border-violet-200",
      phasePill:    "bg-violet-50 text-violet-600 border border-violet-200",
      leftBar:      "bg-violet-400",
      stepDot:      "bg-violet-400 ring-4 ring-violet-100",
      stepLine:     "bg-violet-200",
      stepLabel:    "text-violet-700",
    },
    features: [
      {
        term: "Overrides train it.",
        detail: "Every correction is labeled data: it shows where the lexicon is weak and where to retune confidence. The agreement % becomes the number you push up over time.",
      },
      {
        term: "Cluster recurring issues.",
        detail: "Group similar reports so a spike in one bucket is an early warning, not 50 tickets.",
      },
      {
        term: "Suggest fixes from history.",
        detail: "Link a new report to past ones and what resolved them, so no one starts from scratch.",
      },
      {
        term: "Calibrate confidence.",
        detail: "If high-confidence calls keep getting overridden, the thresholds are off, and the data shows where.",
      },
    ],
  },
  {
    version: "v3",
    phase: "Later",
    title: "Make it enterprise-grade and compliant",
    subtitle: "Built for audits, leadership, and scale",
    colors: {
      versionBadge: "bg-amber-100 text-amber-700 border border-amber-200",
      phasePill:    "bg-amber-50 text-amber-600 border border-amber-200",
      leftBar:      "bg-amber-400",
      stepDot:      "bg-amber-400 ring-4 ring-amber-100",
      stepLine:     "bg-amber-200",
      stepLabel:    "text-amber-700",
    },
    features: [
      {
        term: "Real datastore + role-based access.",
        detail: "Replace localStorage; separate CS, eng, and compliance views, with retention rules.",
      },
      {
        term: "Exam-ready audit export.",
        detail: "One click pulls the full history of every call, override, and route — which is what a CFPB exam asks for.",
      },
      {
        term: "Leadership analytics.",
        detail: "Trends by bucket, severity, time-to-route, MTTR, and compliance catch rate.",
      },
      {
        term: "Generalize past the voice agent.",
        detail: "The engine is lexicon-driven, so it ports to other Salient surfaces.",
      },
    ],
  },
];

interface MetricConfig {
  term: string;
  target: "up" | "down";
  detail: string;
  priority?: boolean;
}

const METRICS: MetricConfig[] = [
  {
    term: "Time-to-route and MTTR (down).",
    target: "down",
    detail: "The core promise: faster from report to the right owner.",
  },
  {
    term: "Routing accuracy up, reassignments down.",
    target: "up",
    detail: "Fewer wrong-owner hand-offs as the lexicon sharpens.",
  },
  {
    term: "Override rate (down).",
    target: "down",
    detail: "At steady volume, fewer overrides means it's learning.",
  },
  {
    term: "Agreement % up, high-confidence overrides down.",
    target: "up",
    detail: "Shows the calibration is working.",
  },
  {
    term: "Compliance catch rate (up).",
    target: "up",
    detail: "Exposure caught before it escalates — the one a lender cares about most.",
    priority: true,
  },
];

const CHAIN = [
  "better lexicon",
  "→ higher agreement",
  "→ fewer overrides",
  "→ faster routing",
  "→ lower MTTR",
  "→ more compliance catches",
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RoadmapCard() {
  return (
    <div className="rounded-xl border border-cream-border bg-card overflow-hidden">
      {/* Stepper */}
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start">
          {HORIZONS.map((h, i) => (
            <div key={h.version} className="flex-1 flex flex-col items-center relative">
              {i < HORIZONS.length - 1 && (
                <div
                  className={`absolute top-[10px] w-full h-0.5 ${h.colors.stepLine}`}
                  style={{ left: "50%" }}
                />
              )}
              <div className={`relative z-10 w-5 h-5 rounded-full ${h.colors.stepDot} mb-2`} />
              <span className={`text-[10px] font-bold uppercase tracking-widest ${h.colors.stepLabel}`}>
                {h.phase}
              </span>
              <span className="text-[11px] font-semibold text-stone-700 mt-0.5">{h.version}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-cream-border" />

      {/* Three-column feature list */}
      <div className="grid grid-cols-3 divide-x divide-cream-border">
        {HORIZONS.map((h) => (
          <div key={h.version} className="p-4 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2.5">
              {h.title}
            </p>
            <ul className="space-y-2">
              {h.features.map((f, i) => (
                <li key={i} className="flex gap-2 items-start">
                  <span className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${h.colors.leftBar}`} />
                  <span className="text-[13px] font-semibold text-stone-700 leading-snug">
                    {f.term}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricRow({ m }: { m: MetricConfig }) {
  const isUp = m.target === "up";
  return (
    <li className={`flex gap-3 rounded-xl border px-4 py-3 ${
      m.priority ? "border-red-200 bg-red-50" : "border-cream-border bg-white"
    }`}>
      <span
        className={`mt-0.5 shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold ${
          isUp ? "bg-emerald-100 text-emerald-600" : "bg-sky-100 text-sky-600"
        }`}
        aria-label={isUp ? "should increase" : "should decrease"}
      >
        {isUp ? "↑" : "↓"}
      </span>
      <div>
        <p className="text-sm text-stone-600 leading-relaxed">
          <strong className="font-semibold text-stone-800">{m.term}</strong>{" "}{m.detail}
        </p>
        {m.priority && (
          <span className="mt-0.5 inline-block text-[10px] font-semibold uppercase tracking-widest text-red-500">
            Highest priority for a lender
          </span>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function Roadmap() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-ink">The Roadmap</h2>
        <p className="text-sm text-stone-400 mt-0.5">Now → Next → Later</p>
      </div>

      {/* Stepper + three-column terms */}
      <RoadmapCard />

      {/* Metrics */}
      <section className="space-y-3">
        <div className="border-b border-cream-border pb-2">
          <h2 className="text-base font-bold text-ink">Metrics that prove it's working</h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Five metrics that move together; improve one and the rest follow.
          </p>
        </div>

        <ul className="space-y-2">
          {METRICS.map((m, i) => (
            <MetricRow key={i} m={m} />
          ))}
        </ul>

        {/* Chain */}
        <div className="rounded-xl border border-cream-border bg-card px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-2">
            How they connect
          </p>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
            {CHAIN.map((node, i) => (
              <span
                key={i}
                className={i % 2 === 0 ? "font-semibold text-stone-700" : "text-stone-400"}
              >
                {node}
              </span>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
