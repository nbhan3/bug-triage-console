// llm.ts — thin client wrapper around POST /api/classify.
//
// Returns { available: false } on any network error or when the server has no
// API key configured.  The caller (App.tsx) uses the result to recompute
// confidence: High if LLM agrees with rules, Low if it disagrees.

import type { Bucket } from "./triage";
import type { TriageInput } from "./triage";

export type LLMResponse =
  | { available: false; error?: string }
  | { available: true; bucket: Bucket; reason: string };

export async function classifyWithLLM(input: TriageInput): Promise<LLMResponse> {
  try {
    const res = await fetch("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bugReport: input.bugReport, impact: input.impact }),
      signal: AbortSignal.timeout(15_000), // 15s max; LLM calls can be slow
    });
    if (!res.ok) return { available: false };
    return (await res.json()) as LLMResponse;
  } catch {
    return { available: false };
  }
}
