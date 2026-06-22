// display.ts — presentation helpers shared by the UI components.
// Pure formatting only; no engine logic here.

import type { Severity, Bucket, Confidence, ExposureTag } from "./triage";
import { SEVERITY_LABELS } from "./rules";

export { SEVERITY_LABELS };

// Color-coded severity throughout: Sev0 red, Sev1 orange, Sev2 amber, Sev3 gray.
export const SEVERITY_STYLE: Record<Severity, { badge: string; dot: string; text: string }> = {
  0: { badge: "bg-red-600 text-white", dot: "bg-red-600", text: "text-red-700" },
  1: { badge: "bg-orange-500 text-white", dot: "bg-orange-500", text: "text-orange-700" },
  2: { badge: "bg-amber-400 text-amber-950", dot: "bg-amber-400", text: "text-amber-700" },
  3: { badge: "bg-gray-400 text-white", dot: "bg-gray-400", text: "text-gray-600" },
};

export const CONFIDENCE_STYLE: Record<Confidence, string> = {
  High: "bg-emerald-100 text-emerald-800 border border-emerald-300",
  Medium: "bg-sky-100 text-sky-800 border border-sky-300",
  Low: "bg-zinc-100 text-zinc-700 border border-zinc-300",
};

export const BUCKET_STYLE: Record<Bucket, string> = {
  STT: "bg-violet-100 text-violet-800 border border-violet-300",
  TTS: "bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-300",
  LLM: "bg-indigo-100 text-indigo-800 border border-indigo-300",
  "Post-call": "bg-teal-100 text-teal-800 border border-teal-300",
  Infrastructure: "bg-rose-100 text-rose-800 border border-rose-300",
};

export const EXPOSURE_LABEL: Record<ExposureTag, string> = {
  "compliance-threat": "Compliance — threat",
  "compliance-misrep": "Compliance — misrep",
  financial: "Financial",
  "data-loss": "Data loss / audit",
};

export const BUCKET_TOOLTIP: Record<Bucket, string> = {
  STT: "STT — Speech-to-Text: the transcription layer that converts caller audio to text",
  TTS: "TTS — Text-to-Speech: the voice synthesis layer that reads agent responses aloud",
  LLM: "LLM — Large Language Model: the conversation and reasoning layer",
  "Post-call": "Post-call: CRM writes, call summaries, and disposition codes after the call ends",
  Infrastructure: "Infrastructure: telephony, carrier, storage, and API transport layer",
};

export const SEVERITY_TOOLTIP: Record<Severity, string> = {
  0: "Sev0 — Critical: outage or systemic compliance risk; page immediately",
  1: "Sev1 — High: many callers affected or compliance floor; escalate within the hour",
  2: "Sev2 — Medium: isolated single-caller impact; route in normal queue",
  3: "Sev3 — Low: intermittent or non-reproducible; backlog",
};

export const CONFIDENCE_TOOLTIP: Record<Confidence, string> = {
  High: "High confidence: rules and LLM agree on the bucket",
  Medium: "Medium confidence: structural rule fired but signals are sparse",
  Low: "Low confidence: signals are ambiguous, thin, or LLM disagrees — human review recommended",
};

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
