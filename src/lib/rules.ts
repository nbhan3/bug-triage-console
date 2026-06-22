// rules.ts — the rubric, expressed as data.
//
// This file holds the editable lexicons and configuration for the triage engine.
// It contains NO logic; triage.ts reads these tables and applies them. Keeping the
// rubric here means a reviewer (or a CS/Eng lead) can tune the rules without
// touching the engine.
//
// Matching is always case-insensitive substring match of a `signal` inside the
// report text, unless noted otherwise.

export type Bucket = "STT" | "TTS" | "LLM" | "Post-call" | "Infrastructure";

export type ExposureTag =
  | "compliance-threat"
  | "compliance-misrep"
  | "financial"
  | "data-loss";

export interface BucketDef {
  key: Bucket;
  /** Human label shown in the UI. */
  label: string;
  /** Default technical owner this bucket routes to. */
  owner: string;
  /** Signal lexicon — distinct matches become the bucket score and evidence. */
  signals: string[];
  /** Bucket-specific "check first" steps surfaced in routing. */
  checkFirst: string[];
  /** Default disambiguating questions for this bucket. */
  questions: string[];
}

// ---------------------------------------------------------------------------
// Buckets + their signal lexicons (classify by ROOT-CAUSE LAYER, not symptom).
// ---------------------------------------------------------------------------
export const BUCKETS: BucketDef[] = [
  {
    key: "STT",
    label: "STT (speech-to-text)",
    owner: "Voice AI",
    // NOTE: "hear" is added so "hearing"/"hears"/"heard"/"mishear" all match a
    // single root cue. The narrower "hears"/"heard" from the original rubric are
    // kept for readability; "hear" subsumes them.
    signals: [
      "transcript",
      "[inaudible]",
      "inaudible",
      "mishear",
      "hear",
      "hears",
      "heard",
      "recognition",
      "diarization",
      "partial transcript",
      "accent",
      "language",
      "spanish",
      "responds in english",
      "habla",
      "misunderstood",
      "couldn't understand",
      "didn't recognize",
      "background noise",
      "french",
      "portuguese",
      "asr",
      "mistranscri",
      "dialect",
    ],
    checkFirst: [
      "ASR vendor status page",
      "recent recognition model or config change",
      "is the audio itself clean vs the transcript wrong",
    ],
    questions: [
      "What is the call ID and a short transcript snippet?",
      "Which language or accent was the caller using?",
      "Is the underlying audio clean?",
    ],
  },
  {
    key: "TTS",
    label: "TTS (text-to-speech)",
    owner: "Voice AI",
    signals: [
      "robotic",
      "garbled",
      "voice quality",
      "voice sounds",
      "pronunciation",
      "pronounce",
      "reads the amount",
      "reads",
      "cuts off",
      "cut off",
      "mid-sentence",
      "barge-in",
      "barge in",
      "interrupt",
      "slow to speak",
      "seconds to speak",
      "response starts taking",
      "latency",
    ],
    checkFirst: [
      "TTS vendor status page",
      "recent voice or config change",
      "is the symptom on output audio specifically",
    ],
    questions: [
      "Can you share one sample utterance that failed?",
      "Does it happen on every call or specific phrases?",
      "Was the voice or prompt changed recently?",
    ],
  },
  {
    key: "LLM",
    label: "LLM / Conversation",
    owner: "LLM / Conversation",
    signals: [
      "wrong intent",
      "hallucinat",
      "made up",
      "refus",
      "loop",
      "repeats",
      "same question",
      "won't check",
      "wont check",
      "insists",
      "threat",
      "arrested",
      "told",
      "policy",
      "tool use",
      "tool misuse",
      "account lookup",
      "bad reasoning",
      "fabricat",
      "wrong information",
      "incorrect information",
      "gave wrong",
      "social security",
    ],
    checkFirst: [
      "most recent prompt or policy deploy",
      "tool/function-call logs",
      "is the behavior coming from the script (likely systemic)",
    ],
    questions: [
      "What exactly did the agent say, word for word?",
      "Is it reproducible across different borrowers?",
      "Was the prompt or policy changed recently?",
    ],
  },
  {
    key: "Post-call",
    label: "Post-call process",
    owner: "Integrations / Post-call",
    signals: [
      "summary",
      "disposition",
      "crm",
      "salesforce",
      "call notes",
      "notes in",
      "qa label",
      "webhook delivery",
      "logged",
      "double-log",
      "double log",
      "disposition code",
    ],
    checkFirst: [
      "did the call and transport succeed but post-processing fail",
      "idempotency keys on writes",
      "CRM write logs",
    ],
    questions: [
      "Did the call complete normally?",
      "Which records are missing or duplicated?",
      "Did this start after a recent deploy?",
    ],
  },
  {
    key: "Infrastructure",
    label: "Infrastructure",
    owner: "Platform / Infra",
    signals: [
      "500",
      "error",
      "endpoint",
      "dial",
      "connect",
      "call dropped",
      "call drops",
      "line dropped",
      "timeout",
      "timed out",
      " ring", // leading space: avoid matching "hearing" / "during"
      "carrier",
      "storage",
      "file not found",
      "recording",
      "retrieve",
      "auth",
      "rate limit",
      "outage",
      "database",
      "db write",
    ],
    checkFirst: [
      "endpoint health and error logs",
      "telephony or carrier status",
      "storage health",
      "recent deploy",
    ],
    questions: [
      "What error codes and timestamps are you seeing?",
      "How many calls are affected?",
      "Did it start suddenly?",
    ],
  },
];

// Tie-break priority order (most → least preferred) when bucket scores tie.
export const TIE_BREAK_ORDER: Bucket[] = [
  "Infrastructure",
  "LLM",
  "TTS",
  "STT",
  "Post-call",
];

// ---------------------------------------------------------------------------
// Precedence / tie-break cue sets (applied in order, before generic scoring).
// ---------------------------------------------------------------------------

// Rule 1: an explicit transport / HTTP / storage failure means Infrastructure
// wins over Post-call (a 500 on /webhook/call-ended is Infra, not Post-call).
export const INFRA_TRANSPORT_CUES = [
  "500",
  "endpoint",
  "file not found",
  "storage",
  "outage",
  "call dropped",
  "line dropped",
  "carrier",
];

// Rule 2: symptom is on OUTPUT audio → TTS wins over STT.
export const OUTPUT_AUDIO_CUES = [
  "robotic",
  "garbled",
  "pronunciation",
  "reads",
  "cuts off",
  "barge-in",
  "slow to speak",
  "seconds to speak",
];

// Rule 3: the audio itself is fine but the transcript is wrong → STT wins,
// suppress TTS / Infra.
export const AUDIO_FINE_CUES = [
  "audio is fine",
  "audio's fine",
  "sounds fine",
  "sounds clear",
  "audio is clear",
  "voice is fine",
  "voice is clear",
  "voice sounds fine",
  "audio sounds fine",
];

// Rule 3b: transcript confirmed accurate → TTS wins over STT.
export const TRANSCRIPT_FINE_CUES = [
  "transcript is accurate",
  "transcript is correct",
  "transcript is fine",
  "transcript looks fine",
  "transcription is accurate",
  "transcription is correct",
  "transcription is fine",
];

// Rule 7: transport/webhook confirmed working → Post-call beats Infra.
export const TRANSPORT_OK_CUES = [
  "200 ok",
  "returns 200",
  "returned 200",
  "transport is working",
  "webhook is working",
  "endpoint is responding",
  "endpoint is up",
];

// Rule 4: language / accent issues → STT primary, LLM added as a secondary tag.
export const LANGUAGE_CUES = [
  "spanish",
  "language",
  "responds in english",
  "habla",
  "french",
  "portuguese",
  "dialect",
];

// Rule 5: reasoning / tool failures → LLM, not Infra, even when account/lookup
// sounds infrastructural.
export const REASONING_CUES = [
  "won't check",
  "wont check",
  "insists",
  "account lookup",
  "tool use",
  "tool misuse",
];

// ---------------------------------------------------------------------------
// Exposure tags (orthogonal to buckets). Each sets a severity FLOOR and adds a
// parallel Compliance / Risk route.
// ---------------------------------------------------------------------------
export interface ExposureDef {
  key: ExposureTag;
  label: string;
  /** Severity floor (lower number = more severe). */
  floor: 0 | 1 | 2 | 3;
  /** Cue substrings that fire this tag. */
  cues: string[];
  /** Short rationale used in the severity reason line. */
  reason: string;
}

export const EXPOSURES: ExposureDef[] = [
  {
    key: "compliance-threat",
    label: "Compliance — false/illegal threat",
    floor: 0,
    // A false threat is a per-se FDCPA violation, and because it lives in the
    // prompt it is systemic across calls.
    cues: [
      "arrested",
      "arrest",
      "jail",
      "prison",
      "lawsuit",
      "sue you",
      "sue them",
      "garnish",
      "legal action",
      "take you to court",
      "warrant",
      "court proceedings",
      "legal proceedings",
    ],
    reason: "a false legal threat is prompt-driven and systemic across calls",
  },
  {
    key: "compliance-misrep",
    label: "Compliance — misrepresentation / disclosure",
    floor: 1,
    cues: [
      "already paid",
      "insists",
      "won't check",
      "wont check",
      "wrong amount",
      "still owe",
      "didn't pay",
      "missing disclosure",
      "incorrect disclosure",
      "without consent",
      "no consent",
      "consent",
      "social security",
    ],
    reason: "a possible misrepresentation / disclosure issue",
  },
  {
    key: "financial",
    label: "Financial exposure",
    floor: 1,
    cues: [
      "amount",
      "$",
      "payment",
      "payments",
      "charge",
      "transaction",
      "double-log",
      "double log",
      "refund",
      "posted",
      "collections",
      "charged twice",
      "double charged",
      "duplicate charge",
    ],
    reason: "a customer-money / financial event is involved",
  },
  {
    key: "data-loss",
    label: "Data loss / audit gap",
    floor: 1,
    cues: [
      "no summary",
      "not saved",
      "nothing is saving",
      "nothing saving",
      "file not found",
      "missing notes",
      "notes missing",
      "recording lost",
      "lost recording",
      "can't retrieve",
      "cannot retrieve",
      "cant retrieve",
      "no recording",
      "not recorded",
    ],
    reason: "audit / recording data may be lost",
  },
];

// data-loss escalates from its Sev1 floor to Sev0 when a "widespread" cue is
// present IN THE TEXT (not from the impact dropdown — that is handled by the
// base severity). NOTE: bare "all" is intentionally excluded because it is a
// substring of "calls".
export const DATA_LOSS_WIDESPREAD_CUES = [
  "many",
  "nothing",
  "across",
  "500",
  "near zero",
  "all of",
  "all calls",
  "every call",
];

// The Sev0 reason variant for widespread data loss.
export const DATA_LOSS_WIDESPREAD_REASON =
  "audit / recording data loss appears widespread";

// ---------------------------------------------------------------------------
// Severity model.
// ---------------------------------------------------------------------------
export type Severity = 0 | 1 | 2 | 3;
export type Impact = "single" | "many" | "outage";

export const IMPACT_BASE: Record<Impact, Severity> = {
  outage: 0,
  many: 1,
  single: 2,
};

// Frequency adjusters.
//
// LOWERING cues de-escalate one step (a clearly intermittent issue with a
// workaround is less urgent). RAISING cues escalate one step.
//
// Calibration note: repetition cues like "keeps" / "loop" / "half the call" are
// deliberately NOT auto-raisers. The base impact already encodes blast radius,
// and stacking a raise on top of it over-states single/many-caller reports
// (e.g. "agent keeps mishearing, many callers" is Sev1, not Sev0). Those cues
// are still captured as evidence and surfaced, just not as severity multipliers.
export const FREQ_RAISE_CUES = [
  "every",
  "always",
  "all calls",
  "every call",
  "near zero",
];

export const FREQ_LOWER_CUES = [
  "sometimes",
  "intermittent",
  "occasionally",
  "occasional",
  "workaround",
  "fluke",
  "could not reproduce",
  "not reproducible",
  "low priority",
];

// Systemic-scope override (rule 4 of the severity model):
// If the primary bucket is STT/TTS/LLM, impact is "single", and the root cause
// is clearly prompt / policy / config driven (the agent SAID something, a
// pronunciation rule, a recognition mapping), the real blast radius is systemic
// across calls — so a single-caller report gets at least a Sev1 floor.
export const SYSTEMIC_ROOTCAUSE_CUES = [
  "told",
  "said",
  "insists",
  "insist",
  "threat",
  "arrest",
  "made up",
  "hallucinat",
  "policy",
  "pronunciation",
  "pronounce",
  "reads",
];

export const SYSTEMIC_FLOOR: Severity = 1;

export const SYSTEMIC_REASON =
  "root cause appears prompt/policy-driven and systemic across calls";

export const SEVERITY_LABELS: Record<Severity, string> = {
  0: "Sev0",
  1: "Sev1",
  2: "Sev2",
  3: "Sev3",
};

export const COMPLIANCE_LANE = "Compliance / Risk" as const;

// ---------------------------------------------------------------------------
// Defensive / precision cue sets (suppress mis-classifications).
// ---------------------------------------------------------------------------

// If ANY of these appear, the agent was making a LAWFUL FDCPA disclosure
// (right to dispute, mini-Miranda, etc.) — NOT a false threat.  The compliance
// exposure tags and systemic floor are suppressed; severity is capped at Sev3.
export const COMPLIANT_DISCLOSURE_CUES = [
  "right to dispute",
  "validation notice",
  "mini-miranda",
  "required disclosure",
  "debt validation",
  "not a compliance problem",
  "legally required",
];

// Pre-speech silence → LLM inference latency, not TTS.  "Dead air" before
// the agent says its first word is an LLM think-time issue, not a voice
// quality issue.  Rule 8 fires on any of these.
export const INFERENCE_LATENCY_CUES = [
  "dead air",
  "silent pause",
  "silence before",
  "before the agent says",
  "before it says",
  "before responding",
  "before any audio",
  "before it speaks",
];

// Feature / enhancement requests — not bugs.  When any of these appear the
// engine still triages (the signal lexicon may still fire), but a notABug
// flag is set so the UI can surface a "confirm this is actually a bug" prompt.
export const FEATURE_REQUEST_CUES = [
  "could we get",
  "can we get",
  "feature request",
  "would be great if",
  "next release",
  "roadmap",
  "enhancement request",
  "would love to have",
];

// Non-systemic / non-reproducible indicators — suppress the systemic Sev1
// floor for single-caller reports.  A one-off fluke should not be treated
// as a prompt-level regression.
export const NON_SYSTEMIC_CUES = [
  "fluke",
  "could not reproduce",
  "cannot reproduce",
  "can't reproduce",
  "not reproducible",
  "low priority",
  "occasionally",
  "intermittent",
];
