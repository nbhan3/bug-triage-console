// triage.ts — the pure, deterministic triage engine.
//
// triage(input) -> TriageResult. No I/O, no network, no model. Every decision is
// a substring match against the lexicons in rules.ts, so every output is
// reproducible and auditable.

import {
  BUCKETS,
  EXPOSURES,
  TIE_BREAK_ORDER,
  INFRA_TRANSPORT_CUES,
  OUTPUT_AUDIO_CUES,
  AUDIO_FINE_CUES,
  TRANSCRIPT_FINE_CUES,
  TRANSPORT_OK_CUES,
  LANGUAGE_CUES,
  REASONING_CUES,
  DATA_LOSS_WIDESPREAD_CUES,
  DATA_LOSS_WIDESPREAD_REASON,
  IMPACT_BASE,
  FREQ_RAISE_CUES,
  FREQ_LOWER_CUES,
  SYSTEMIC_ROOTCAUSE_CUES,
  SYSTEMIC_FLOOR,
  SYSTEMIC_REASON,
  SEVERITY_LABELS,
  COMPLIANCE_LANE,
  COMPLIANT_DISCLOSURE_CUES,
  INFERENCE_LATENCY_CUES,
  FEATURE_REQUEST_CUES,
  NON_SYSTEMIC_CUES,
  type Bucket,
  type ExposureTag,
  type Severity,
  type Impact,
} from "./rules";

/** SSN pattern — used only for PII detection, never for routing. */
const PII_PATTERN = /\b\d{3}[-.\s]\d{2}[-.\s]\d{4}\b/;

export type { Bucket, ExposureTag, Severity, Impact };

export interface TriageInput {
  bugReport: string; // required, free text
  customer: string; // free text
  callId?: string;
  startedWhen?: string;
  impact: Impact; // from the dropdown
}

export type Confidence = "High" | "Medium" | "Low";

export interface EvidenceSpan {
  text: string; // matched substring (as found in the report)
  kind: "bucket" | "tag";
  label: string; // why it matched, e.g. "STT signal" or "financial"
}

export interface Routing {
  owner: string;
  parallel?: typeof COMPLIANCE_LANE;
  urgent: boolean;
  checkFirst: string[];
}

export interface BucketScore {
  score: number;
  signals: string[];
  /** If this bucket was suppressed by a precedence rule, the reason. */
  suppressedBy?: string;
}

export interface TriageResult {
  primaryBucket: Bucket;
  secondaryTags: Bucket[];
  severity: Severity;
  severityReason: string;
  confidence: Confidence;
  exposure: ExposureTag[];
  evidence: EvidenceSpan[];
  routing: Routing;
  nextQuestions: string[];
  /** Surfaced for the UI: scope was judged systemic from the root cause. */
  systemicScope: boolean;
  /** Per-bucket signal scores, used to explain why other buckets didn't win. */
  bucketScores: Record<Bucket, BucketScore>;
  /** Human-readable description of which precedence rule determined the winner. */
  ruleApplied: string;
  /**
   * Set after the optional async LLM call completes.
   * When present, confidence is overridden: High if llmBucket === primaryBucket,
   * Low if they differ (surfaces a conflict for human review).
   */
  llmBucket?: Bucket;
  llmReason?: string;

  // ── Defensive / safety flags ──────────────────────────────────────────────
  /** SSN pattern detected in the report text — handle with extra care. */
  piiDetected?: boolean;
  /** 3+ distinct buckets scored — this may be multiple independent bugs. */
  multipleRootCauses?: Bucket[];
  /** Report reads like a feature request rather than a bug. */
  notABug?: string;
  /** Impact dropdown says single but text implies broad scope. */
  impactConflict?: string;
}

// --- helpers ---------------------------------------------------------------

const has = (text: string, cue: string) => text.includes(cue.toLowerCase());

const anyCue = (text: string, cues: string[]) =>
  cues.some((c) => has(text, c));

/** Find the actual-cased occurrence of a lowercase cue inside the original text. */
function findOriginal(original: string, lowerCue: string): string {
  const idx = original.toLowerCase().indexOf(lowerCue);
  if (idx === -1) return lowerCue;
  return original.slice(idx, idx + lowerCue.length);
}

interface BucketMatch {
  bucket: Bucket;
  score: number;
  signals: string[]; // distinct matched signals (lowercased cues)
}

function scoreBuckets(text: string): Record<Bucket, BucketMatch> {
  const out = {} as Record<Bucket, BucketMatch>;
  for (const def of BUCKETS) {
    const signals: string[] = [];
    for (const sig of def.signals) {
      if (has(text, sig)) signals.push(sig.toLowerCase());
    }
    out[def.key] = { bucket: def.key, score: signals.length, signals };
  }
  return out;
}

// --- primary bucket selection ----------------------------------------------

interface PrimaryDecision {
  primary: Bucket;
  /** Buckets forced as secondary by a precedence rule (e.g. LLM for language). */
  forcedSecondary: Bucket[];
  /** Buckets suppressed by a precedence rule (rule 3). */
  suppressed: Bucket[];
  /** Human-readable description of the suppression reason, keyed by bucket. */
  suppressionReason: Partial<Record<Bucket, string>>;
  /** True when the decision came down to a tie (caps confidence at Medium). */
  tied: boolean;
  /** True for rules 1–5 (and 3b, 7); false for rule 6 fallback. */
  specificRuleFired: boolean;
  /** Human-readable description of which rule fired. */
  ruleApplied: string;
}

function pickPrimary(
  text: string,
  scores: Record<Bucket, BucketMatch>,
): PrimaryDecision {
  const s = (b: Bucket) => scores[b].score;

  // Rule 3b: transcript confirmed fine + TTS signals → TTS wins.
  if (anyCue(text, TRANSCRIPT_FINE_CUES) && s("TTS") > 0) {
    return {
      primary: "TTS",
      forcedSecondary: [],
      suppressed: ["STT"],
      suppressionReason: {
        STT: "Rule 3b: transcript confirmed accurate; speech recognition is not the issue.",
      },
      tied: false,
      specificRuleFired: true,
      ruleApplied: "Rule 3b — transcript confirmed fine but voice output is wrong: TTS wins (STT suppressed).",
    };
  }

  // Rule 3 (strongest): audio is fine but the transcript is wrong → STT,
  // suppress TTS / Infra.
  if (anyCue(text, AUDIO_FINE_CUES) && s("STT") > 0) {
    return {
      primary: "STT",
      forcedSecondary: [],
      suppressed: ["TTS", "Infrastructure"],
      suppressionReason: {
        TTS: "Rule 3: caller confirmed audio is fine, so output audio is not the issue.",
        Infrastructure: "Rule 3: audio-fine cue present; transport failure is not indicated.",
      },
      tied: false,
      specificRuleFired: true,
      ruleApplied: "Rule 3 — audio is fine but transcript is wrong: STT wins (TTS and Infrastructure suppressed).",
    };
  }

  // Rule 5: reasoning / tool failures → LLM (not Infra).
  if (anyCue(text, REASONING_CUES) && s("LLM") > 0) {
    return {
      primary: "LLM",
      forcedSecondary: [],
      suppressed: [],
      suppressionReason: {},
      tied: false,
      specificRuleFired: true,
      ruleApplied: "Rule 5 — reasoning/tool failure: LLM wins (agent behaviour is policy-driven, not an infra error).",
    };
  }

  // Rule 4: language / accent → STT primary, LLM as a secondary tag.
  if (anyCue(text, LANGUAGE_CUES) && s("STT") > 0) {
    return {
      primary: "STT",
      forcedSecondary: ["LLM"],
      suppressed: [],
      suppressionReason: {},
      tied: false,
      specificRuleFired: true,
      ruleApplied: "Rule 4 — language/accent cue: STT is primary (recognition is the root cause); LLM tagged as secondary (conversation handling is a contributing factor).",
    };
  }

  // Rule 7: transport/webhook confirmed working → Post-call beats Infra.
  if (anyCue(text, TRANSPORT_OK_CUES) && s("Post-call") > 0) {
    return {
      primary: "Post-call",
      forcedSecondary: [],
      suppressed: ["Infrastructure"],
      suppressionReason: {
        Infrastructure: "Rule 7: transport confirmed working (200 OK / endpoint up); failure is in post-call data processing, not transport.",
      },
      tied: false,
      specificRuleFired: true,
      ruleApplied: "Rule 7 — transport confirmed OK: Post-call wins (Infrastructure suppressed; issue is in data write, not the webhook transport).",
    };
  }

  // Rule 8: pre-speech silence → LLM inference latency (not TTS audio quality).
  // "Dead air" before the agent says its first word means the LLM is still
  // thinking, not that the TTS voice is broken.
  if (anyCue(text, INFERENCE_LATENCY_CUES)) {
    return {
      primary: "LLM",
      forcedSecondary: [],
      suppressed: ["TTS"],
      suppressionReason: {
        TTS: "Rule 8: silence before first word is LLM inference latency, not a TTS audio quality issue.",
      },
      tied: false,
      specificRuleFired: true,
      ruleApplied: "Rule 8 — dead air / pre-speech latency: LLM wins (TTS suppressed; silence before the first word is inference latency, not a voice quality issue).",
    };
  }

  // Rule 2: symptom on output audio → TTS wins over STT.
  if (anyCue(text, OUTPUT_AUDIO_CUES) && s("TTS") > 0) {
    return {
      primary: "TTS",
      forcedSecondary: [],
      suppressed: [],
      suppressionReason: {},
      tied: false,
      specificRuleFired: true,
      ruleApplied: "Rule 2 — output-audio symptom present: TTS wins over STT.",
    };
  }

  // Rule 1: explicit transport/HTTP/storage failure → Infrastructure wins
  // (over Post-call especially).
  if (anyCue(text, INFRA_TRANSPORT_CUES) && s("Infrastructure") > 0) {
    return {
      primary: "Infrastructure",
      forcedSecondary: [],
      suppressed: [],
      suppressionReason: {},
      tied: false,
      specificRuleFired: true,
      ruleApplied: "Rule 1 — explicit transport/HTTP/storage failure: Infrastructure wins over Post-call.",
    };
  }

  // Rule 6: highest score; tie-break by priority order.
  let best: Bucket | null = null;
  let bestScore = -1;
  let tied = false;
  for (const bucket of TIE_BREAK_ORDER) {
    const sc = s(bucket);
    if (sc > bestScore) {
      best = bucket;
      bestScore = sc;
      tied = false;
    } else if (sc === bestScore && sc > 0) {
      tied = true;
    }
  }

  const isTied = bestScore <= 0 ? true : tied;
  return {
    primary: bestScore <= 0 ? "LLM" : (best ?? "LLM"),
    forcedSecondary: [],
    suppressed: [],
    suppressionReason: {},
    tied: isTied,
    specificRuleFired: false,
    ruleApplied: isTied
      ? "Rule 6 — scores tied: winner selected by priority order (Infra → LLM → TTS → STT → Post-call); confidence capped at Medium."
      : `Rule 6 — score-based: ${best ?? "LLM"} had the most distinct signal matches.`,
  };
}

// --- exposure detection ----------------------------------------------------

interface ExposureHit {
  tag: ExposureTag;
  floor: Severity;
  reason: string;
  matched: string[]; // lowercase cues
}

function detectExposures(text: string, compliantDisclosure = false): ExposureHit[] {
  const hits: ExposureHit[] = [];
  for (const def of EXPOSURES) {
    // When the agent made a lawful FDCPA disclosure, suppress the compliance
    // exposure tags — a correct mini-Miranda or validation notice is not a
    // compliance event.
    if (
      compliantDisclosure &&
      (def.key === "compliance-threat" || def.key === "compliance-misrep")
    ) {
      continue;
    }

    const matched = def.cues.filter((c) => has(text, c)).map((c) => c.toLowerCase());
    if (matched.length === 0) continue;

    let floor = def.floor;
    let reason = def.reason;

    if (def.key === "data-loss" && anyCue(text, DATA_LOSS_WIDESPREAD_CUES)) {
      floor = 0;
      reason = DATA_LOSS_WIDESPREAD_REASON;
    }

    hits.push({ tag: def.key, floor, reason, matched });
  }
  return hits;
}

// --- severity --------------------------------------------------------------

const clamp = (n: number): Severity =>
  Math.max(0, Math.min(3, n)) as Severity;

const moreSevere = (a: Severity, b: Severity): Severity =>
  (a < b ? a : b) as Severity;

interface SeverityResult {
  severity: Severity;
  reason: string;
  systemic: boolean;
}

function computeSeverity(
  text: string,
  impact: Impact,
  primary: Bucket,
  exposures: ExposureHit[],
  compliantDisclosure = false,
): SeverityResult {
  // When the agent made a lawful FDCPA disclosure, short-circuit the whole
  // severity model: this is not a bug at all, let alone an urgent one.
  if (compliantDisclosure) {
    return {
      severity: 3,
      reason: "Lawful FDCPA disclosure confirmed — not a compliance issue: Sev3.",
      systemic: false,
    };
  }

  // 1. base from impact
  const base = IMPACT_BASE[impact];

  // 2. frequency adjusters
  const raised = anyCue(text, FREQ_RAISE_CUES);
  const lowered = anyCue(text, FREQ_LOWER_CUES);
  let adjustedBase = base;
  if (raised) adjustedBase = clamp(adjustedBase - 1);
  if (lowered && impact !== "outage") adjustedBase = clamp(adjustedBase + 1);

  // 4. systemic-scope override (single-caller but prompt/policy-driven).
  // Suppressed when NON_SYSTEMIC_CUES fire — a one-off fluke or
  // non-reproducible issue is not a systemic prompt regression.
  const nonSystemic = anyCue(text, NON_SYSTEMIC_CUES);
  const systemic =
    !nonSystemic &&
    impact === "single" &&
    (primary === "STT" || primary === "TTS" || primary === "LLM") &&
    anyCue(text, SYSTEMIC_ROOTCAUSE_CUES);

  // 3 + 5. combine: most severe of adjusted base, every exposure floor, and the
  // systemic floor.
  type Candidate = { sev: Severity; source: string; reason: string };
  const candidates: Candidate[] = [
    {
      sev: adjustedBase,
      source: "base",
      reason: baseReason(impact, raised, lowered),
    },
  ];
  for (const e of exposures) {
    candidates.push({ sev: e.floor, source: e.tag, reason: e.reason });
  }
  if (systemic) {
    candidates.push({
      sev: SYSTEMIC_FLOOR,
      source: "systemic",
      reason: SYSTEMIC_REASON,
    });
  }

  let final = candidates[0].sev;
  for (const c of candidates) final = moreSevere(final, c.sev);

  // Pick the binding reason: the most-severe candidate, preferring exposure /
  // systemic narratives over the plain base when they tie.
  const priority: Record<string, number> = {
    "compliance-threat": 6,
    "data-loss": 5,
    "compliance-misrep": 4,
    financial: 3,
    systemic: 2,
    base: 1,
  };
  const binding = candidates
    .filter((c) => c.sev === final)
    .sort((a, b) => (priority[b.source] ?? 0) - (priority[a.source] ?? 0))[0];

  // Compose a one-line reason.
  const lead = leadPhrase(impact);
  let reason: string;
  if (binding.source === "base") {
    reason = `${lead}: ${SEVERITY_LABELS[final]}.`;
  } else {
    reason = `${lead}, but ${binding.reason}: ${SEVERITY_LABELS[final]}.`;
  }
  // Add a systemic note if it applied, wasn't already the binding reason, and
  // the binding reason doesn't already convey systemic scope.
  if (systemic && binding.source !== "systemic" && !reason.includes("systemic")) {
    reason = reason.replace(
      `: ${SEVERITY_LABELS[final]}.`,
      `; ${SYSTEMIC_REASON}: ${SEVERITY_LABELS[final]}.`,
    );
  }

  return { severity: final, reason, systemic };
}

function leadPhrase(impact: Impact): string {
  switch (impact) {
    case "outage":
      return "Reported outage";
    case "many":
      return "Many-caller report";
    case "single":
      return "Single-caller report";
  }
}

function baseReason(impact: Impact, raised: boolean, lowered: boolean): string {
  let r =
    impact === "outage"
      ? "a full outage"
      : impact === "many"
        ? "broad multi-caller impact"
        : "isolated single-caller impact";
  if (raised) r += " (escalated for high frequency)";
  if (lowered) r += " (de-escalated as intermittent)";
  return r;
}

// --- confidence ------------------------------------------------------------

function computeConfidence(
  scores: Record<Bucket, BucketMatch>,
  primary: Bucket,
  tied: boolean,
  reportLength: number,
  specificRuleFired: boolean,
): Confidence {
  const sorted = Object.values(scores)
    .map((m) => m.score)
    .sort((a, b) => b - a);
  const top = scores[primary].score;
  const second = sorted.find((_, i) => i > 0) ?? 0;
  const margin = top - second;
  const total = Object.values(scores).reduce((a, m) => a + m.score, 0);

  const vague = reportLength < 25;

  if (vague) return "Low";

  // When a specific structural rule resolved ambiguity, it provides certainty
  // beyond raw signal counts — even with sparse evidence.
  if (specificRuleFired && top > 0) {
    if (margin >= 2) return "High";
    return "Medium";
  }

  // Fallback (Rule 6 — pure score-based):
  if (total <= 1 || margin === 0) return "Low";
  if (margin >= 2 && total >= 2 && !tied) return "High";
  return tied ? "Low" : "Medium";
}

// --- main ------------------------------------------------------------------

export function triage(input: TriageInput): TriageResult {
  const original = input.bugReport ?? "";
  const text = original.toLowerCase();

  const scores = scoreBuckets(text);
  const decision = pickPrimary(text, scores);

  // ── Defensive / safety flags ─────────────────────────────────────────────
  const compliantDisclosure = anyCue(text, COMPLIANT_DISCLOSURE_CUES);
  const piiDetected = PII_PATTERN.test(original) || undefined;
  const notABug = anyCue(text, FEATURE_REQUEST_CUES) ? "feature-request" : undefined;
  const impactConflict =
    input.impact === "single" && anyCue(text, FREQ_RAISE_CUES)
      ? "Impact set to single but report mentions all/every calls — confirm actual blast radius."
      : undefined;

  // Multiplicity: 3+ distinct buckets with score > 0 → likely multiple bugs.
  const scoredBuckets = BUCKETS.filter((d) => scores[d.key].score > 0).map((d) => d.key);
  const multipleRootCauses: Bucket[] | undefined =
    scoredBuckets.length >= 3 ? scoredBuckets : undefined;
  // ─────────────────────────────────────────────────────────────────────────

  const exposures = detectExposures(text, compliantDisclosure);

  const sev = computeSeverity(text, input.impact, decision.primary, exposures, compliantDisclosure);

  // Secondary tags: any other bucket that fired (excluding suppressed +
  // primary), plus precedence-forced secondaries.
  const secondarySet = new Set<Bucket>();
  for (const def of BUCKETS) {
    const b = def.key;
    if (b === decision.primary) continue;
    if (decision.suppressed.includes(b)) continue;
    if (scores[b].score > 0) secondarySet.add(b);
  }
  for (const b of decision.forcedSecondary) {
    if (b !== decision.primary) secondarySet.add(b);
  }
  const secondaryTags = BUCKETS.map((d) => d.key).filter((b) =>
    secondarySet.has(b),
  );

  // Evidence: matched bucket signals (primary + secondary, not suppressed) and
  // every exposure cue.
  const evidence: EvidenceSpan[] = [];
  const seen = new Set<string>();
  const pushEvidence = (cue: string, kind: "bucket" | "tag", label: string) => {
    const key = `${kind}:${label}:${cue}`;
    if (seen.has(key)) return;
    seen.add(key);
    evidence.push({ text: findOriginal(original, cue), kind, label });
  };

  for (const def of BUCKETS) {
    if (decision.suppressed.includes(def.key)) continue;
    if (def.key !== decision.primary && !secondarySet.has(def.key)) continue;
    for (const cue of scores[def.key].signals) {
      pushEvidence(cue, "bucket", `${def.key} signal`);
    }
  }
  for (const e of exposures) {
    for (const cue of e.matched) {
      pushEvidence(cue, "tag", e.tag);
    }
  }

  // When Rule 8 fires (dead air / inference latency → LLM), the structural cue
  // itself is the evidence — there may be no bucket-scored signals at all.
  if (decision.ruleApplied.startsWith("Rule 8")) {
    for (const cue of INFERENCE_LATENCY_CUES) {
      if (has(text, cue)) pushEvidence(cue, "bucket", "LLM signal");
    }
  }

  // Routing
  const def = BUCKETS.find((d) => d.key === decision.primary)!;
  const routing: Routing = {
    owner: def.owner,
    urgent: sev.severity <= 1,
    checkFirst: def.checkFirst,
  };
  if (exposures.length > 0) routing.parallel = COMPLIANCE_LANE;

  const confidence = computeConfidence(
    scores,
    decision.primary,
    decision.tied,
    original.trim().length,
    decision.specificRuleFired,
  );

  // Next questions: 2–5. If confidence is Low, lead with a disambiguating
  // question.
  const nextQuestions = buildQuestions(def.questions, confidence, decision, scores);

  // Build the exposed bucket scores (includes suppression reason for the UI).
  const bucketScores: Record<Bucket, BucketScore> = {} as Record<Bucket, BucketScore>;
  for (const def of BUCKETS) {
    const b = def.key;
    bucketScores[b] = {
      score: scores[b].score,
      signals: scores[b].signals,
      suppressedBy: decision.suppressionReason[b],
    };
  }

  return {
    primaryBucket: decision.primary,
    secondaryTags,
    severity: sev.severity,
    severityReason: sev.reason,
    confidence,
    exposure: exposures.map((e) => e.tag),
    evidence,
    routing,
    nextQuestions,
    systemicScope: sev.systemic,
    bucketScores,
    ruleApplied: decision.ruleApplied,
    piiDetected,
    multipleRootCauses,
    notABug,
    impactConflict,
  };
}

function buildQuestions(
  base: string[],
  confidence: Confidence,
  decision: PrimaryDecision,
  scores: Record<Bucket, BucketMatch>,
): string[] {
  const questions = [...base];
  if (confidence === "Low") {
    // Lead with a disambiguating question naming the contenders.
    const contenders = Object.values(scores)
      .filter((m) => m.score > 0 && m.bucket !== decision.primary)
      .sort((a, b) => b.score - a.score)
      .map((m) => m.bucket);
    const disambig = contenders.length
      ? `This report is ambiguous — is the root cause ${decision.primary} or ${contenders[0]}? What additional detail can you share?`
      : `This report is thin — can you share a call ID, a verbatim quote, and how many callers are affected?`;
    questions.unshift(disambig);
  }
  return questions.slice(0, 5);
}
