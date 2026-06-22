// storage.ts — localStorage persistence for the triage queue and audit log.
//
// No backend. The queue and every override audit entry live in the browser.
// Load on mount, save on change.

import { triage } from "./triage";
import type { TriageInput, TriageResult, Bucket, Severity } from "./triage";

export type ItemStatus = "New" | "In Review" | "Routed" | "Resolved";

export interface OverrideEntry {
  at: string; // ISO timestamp
  fromBucket: Bucket;
  toBucket: Bucket;
  fromSeverity: Severity;
  toSeverity: Severity;
  note: string; // required "why changed"
}

export interface QueueItem {
  id: string;
  createdAt: string; // ISO
  input: TriageInput;
  /** The original engine recommendation (immutable — for the agreement metric). */
  recommendation: TriageResult;
  /** Current effective bucket / severity (may differ after a human override). */
  bucket: Bucket;
  severity: Severity;
  status: ItemStatus;
  overrides: OverrideEntry[];
}

export type FlagCategory =
  | "wrong-bucket"
  | "wrong-severity"
  | "missing-evidence"
  | "false-positive"
  | "other";

export interface FlagEntry {
  id: string;
  at: string;
  category: FlagCategory;
  queueItemId?: string;
  description: string;
}

const QUEUE_KEY = "btc.queue.v1";
const FLAGS_KEY = "btc.flags.v1";

export function loadFlags(): FlagEntry[] {
  try {
    const raw = localStorage.getItem(FLAGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FlagEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveFlag(flag: FlagEntry): void {
  try {
    const existing = loadFlags();
    localStorage.setItem(FLAGS_KEY, JSON.stringify([flag, ...existing]));
  } catch {
    // fail silently
  }
}

export function loadQueue(): QueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Migrate items saved before bucketScores/ruleApplied were added to TriageResult.
    return (parsed as QueueItem[]).map((item) => {
      if (item.recommendation.bucketScores) return item;
      return {
        ...item,
        recommendation: triage(item.input),
      };
    });
  } catch {
    return [];
  }
}

export function saveQueue(items: QueueItem[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // Storage full / unavailable — fail silently; this is a local tool.
  }
}

/** Simple unique id without external deps. */
export function newId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `BTC-${Date.now().toString(36)}-${rand}`.toUpperCase();
}
