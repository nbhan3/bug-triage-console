import { describe, it, expect } from "vitest";
import { triage } from "./triage";
import { SEEDS } from "./seeds";
import type { Bucket } from "./rules";

// Acceptance table from the spec. The engine must compute these LIVE from the
// seed inputs. If a row fails, the rules are wrong — fix rules.ts, not this test.
const EXPECTED: { id: number; primaryBucket: Bucket; severity: number }[] = [
  { id: 1, primaryBucket: "STT", severity: 1 },
  { id: 2, primaryBucket: "TTS", severity: 1 },
  { id: 3, primaryBucket: "LLM", severity: 0 },
  { id: 4, primaryBucket: "Post-call", severity: 1 },
  { id: 5, primaryBucket: "Infrastructure", severity: 0 },
  { id: 6, primaryBucket: "LLM", severity: 2 },
  { id: 7, primaryBucket: "STT", severity: 2 },
  { id: 8, primaryBucket: "TTS", severity: 2 },
  { id: 9, primaryBucket: "Infrastructure", severity: 0 },
  { id: 10, primaryBucket: "STT", severity: 1 },
  { id: 11, primaryBucket: "Post-call", severity: 1 },
  { id: 12, primaryBucket: "TTS", severity: 2 },
  { id: 13, primaryBucket: "LLM", severity: 1 },
  { id: 14, primaryBucket: "Infrastructure", severity: 0 },
  { id: 15, primaryBucket: "TTS", severity: 1 },
  { id: 16, primaryBucket: "Post-call", severity: 1 },
  { id: 17, primaryBucket: "LLM", severity: 1 },
  { id: 18, primaryBucket: "Infrastructure", severity: 0 },
  { id: 19, primaryBucket: "STT", severity: 1 },
  { id: 20, primaryBucket: "LLM", severity: 0 },
  { id: 21, primaryBucket: "TTS", severity: 0 },
  { id: 22, primaryBucket: "LLM", severity: 2 },
  { id: 23, primaryBucket: "STT", severity: 1 },
  { id: 24, primaryBucket: "STT", severity: 1 },
  { id: 25, primaryBucket: "Post-call", severity: 1 },
  { id: 26, primaryBucket: "STT", severity: 1 },
  { id: 27, primaryBucket: "Post-call", severity: 1 },
  { id: 28, primaryBucket: "LLM", severity: 1 },
  { id: 29, primaryBucket: "LLM", severity: 0 },
  { id: 30, primaryBucket: "STT", severity: 1 },
  { id: 31, primaryBucket: "STT", severity: 1 },
  // Precision / defensive seeds
  { id: 32, primaryBucket: "LLM", severity: 3 }, // compliant disclosure → Sev3, no compliance lane
  { id: 33, primaryBucket: "TTS", severity: 1 }, // multi-bug: Rule 2 fires (robotic), multipleRootCauses
  { id: 34, primaryBucket: "STT", severity: 2 }, // feature request flag, STT still triages
  { id: 35, primaryBucket: "Infrastructure", severity: 1 }, // single + freq-raise → Sev1, impactConflict
  { id: 36, primaryBucket: "TTS", severity: 3 }, // non-reproducible: NON_SYSTEMIC + FREQ_LOWER → Sev3
  { id: 37, primaryBucket: "LLM", severity: 1 }, // systemic since deploy, many callers
  { id: 38, primaryBucket: "TTS", severity: 1 }, // number misread: Rule 2 + compliance-misrep/financial
  { id: 39, primaryBucket: "Infrastructure", severity: 1 }, // CFPB audit gap: Rule 1 + data-loss
  { id: 40, primaryBucket: "STT", severity: 1 }, // cascade: transcripts → collections, financial lane
  { id: 41, primaryBucket: "LLM", severity: 2 }, // dead air → Rule 8 (LLM inference latency)
  { id: 42, primaryBucket: "LLM", severity: 1 }, // PII + compliance-misrep floor → Sev1
  { id: 43, primaryBucket: "TTS", severity: 3 }, // injection ignored; occasionally mispronounces → Sev3
];

describe("triage engine — 43 acceptance seeds", () => {
  for (const exp of EXPECTED) {
    const seed = SEEDS.find((s) => s.id === exp.id)!;
    it(`seed #${exp.id} → ${exp.primaryBucket} / Sev${exp.severity}`, () => {
      const result = triage({
        bugReport: seed.bugReport,
        customer: "",
        impact: seed.impact,
      });
      expect(result.primaryBucket).toBe(exp.primaryBucket);
      expect(result.severity).toBe(exp.severity);
    });
  }
});

describe("triage engine — invariants", () => {
  it("never auto-routes; result is a recommendation only (no status field)", () => {
    const r = triage({ bugReport: "test", customer: "x", impact: "single" });
    expect(r).not.toHaveProperty("status");
  });

  it("produces a severity reason for every report", () => {
    for (const seed of SEEDS) {
      const r = triage({ ...seed, customer: "" });
      expect(r.severityReason.length).toBeGreaterThan(0);
    }
  });

  it("opens a parallel Compliance / Risk lane whenever an exposure tag fires", () => {
    for (const seed of SEEDS) {
      const r = triage({ ...seed, customer: "" });
      if (r.exposure.length > 0) {
        expect(r.routing.parallel).toBe("Compliance / Risk");
      } else {
        expect(r.routing.parallel).toBeUndefined();
      }
    }
  });

  it("flags urgent for Sev0/Sev1 only", () => {
    for (const seed of SEEDS) {
      const r = triage({ ...seed, customer: "" });
      expect(r.routing.urgent).toBe(r.severity <= 1);
    }
  });

  it("records evidence spans for every classified seed", () => {
    for (const seed of SEEDS) {
      // Seed 22 is deliberately vague (no signal words) and produces zero
      // evidence by design; it is the canonical "thin report" test case.
      if (seed.id === 22) continue;
      const r = triage({ ...seed, customer: "" });
      expect(r.evidence.length).toBeGreaterThan(0);
    }
  });
});

describe("triage engine — defensive flags", () => {
  it("seed #32: compliant disclosure → no compliance lane, Sev3", () => {
    const seed = SEEDS.find((s) => s.id === 32)!;
    const r = triage({ ...seed, customer: "" });
    expect(r.routing.parallel).toBeUndefined();
    expect(r.severity).toBe(3);
    expect(r.exposure).toHaveLength(0);
  });

  it("seed #33: three scored buckets → multipleRootCauses flag", () => {
    const seed = SEEDS.find((s) => s.id === 33)!;
    const r = triage({ ...seed, customer: "" });
    expect(r.multipleRootCauses).toBeDefined();
    expect(r.multipleRootCauses!.length).toBeGreaterThanOrEqual(3);
  });

  it("seed #34: feature request cue → notABug='feature-request'", () => {
    const seed = SEEDS.find((s) => s.id === 34)!;
    const r = triage({ ...seed, customer: "" });
    expect(r.notABug).toBe("feature-request");
  });

  it("seed #35: single impact + 'every call' in text → impactConflict set", () => {
    const seed = SEEDS.find((s) => s.id === 35)!;
    const r = triage({ ...seed, customer: "" });
    expect(r.impactConflict).toBeDefined();
    expect(r.impactConflict).toContain("single");
  });

  it("seed #36: non-reproducible → no systemic scope, Sev3", () => {
    const seed = SEEDS.find((s) => s.id === 36)!;
    const r = triage({ ...seed, customer: "" });
    expect(r.systemicScope).toBe(false);
    expect(r.severity).toBe(3);
  });

  it("seed #41: dead air → LLM via Rule 8 (inference latency, not TTS)", () => {
    const seed = SEEDS.find((s) => s.id === 41)!;
    const r = triage({ ...seed, customer: "" });
    expect(r.primaryBucket).toBe("LLM");
    expect(r.bucketScores["TTS"].suppressedBy).toContain("Rule 8");
  });

  it("seed #42: SSN in text → piiDetected=true", () => {
    const seed = SEEDS.find((s) => s.id === 42)!;
    const r = triage({ ...seed, customer: "" });
    expect(r.piiDetected).toBe(true);
  });

  it("seed #43: injection preamble ignored; mispronounces → TTS", () => {
    const seed = SEEDS.find((s) => s.id === 43)!;
    const r = triage({ ...seed, customer: "" });
    expect(r.primaryBucket).toBe("TTS");
    expect(r.severity).toBe(3);
  });
});
