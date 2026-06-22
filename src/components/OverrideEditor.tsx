import { useState } from "react";
import type { Bucket, Severity } from "../lib/triage";
import { BUCKETS, SEVERITY_LABELS } from "../lib/rules";
import { formatTimestamp } from "../lib/display";
import type { OverrideEntry } from "../lib/storage";

interface Props {
  bucket: Bucket;
  severity: Severity;
  history?: OverrideEntry[];
  onOverride: (toBucket: Bucket, toSeverity: Severity, note: string) => void;
}

const SEVERITIES: Severity[] = [0, 1, 2, 3];

/**
 * Human override: editable bucket + severity plus a REQUIRED "why changed" note.
 * Saving records original vs new, the note, and a timestamp into the audit log.
 */
export default function OverrideEditor({ bucket, severity, history, onOverride }: Props) {
  const [b, setB] = useState<Bucket>(bucket);
  const [s, setS] = useState<Severity>(severity);
  const [note, setNote] = useState("");

  const changed = b !== bucket || s !== severity;
  const canSave = changed && note.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    onOverride(b, s, note.trim());
    setNote("");
  };

  const selCls =
    "rounded-md border border-stone-200 bg-white px-2 py-1 text-sm focus:border-ink focus:outline-none";

  return (
    <div className="space-y-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
        Human override
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-stone-500">
          Bucket
          <select
            value={b}
            onChange={(e) => setB(e.target.value as Bucket)}
            className={`mt-1 block ${selCls}`}
          >
            {BUCKETS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.key}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-stone-500">
          Severity
          <select
            value={s}
            onChange={(e) => setS(Number(e.target.value) as Severity)}
            className={`mt-1 block ${selCls}`}
          >
            {SEVERITIES.map((v) => (
              <option key={v} value={v}>
                {SEVERITY_LABELS[v]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={changed ? "Why are you changing this? (required)" : "Change a value above to override"}
          className="w-full rounded-md border border-stone-200 px-3 py-1.5 text-sm placeholder:text-stone-300 focus:border-ink focus:outline-none"
        />
      </div>
      <button
        onClick={save}
        disabled={!canSave}
        className="rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
      >
        Save override
      </button>

      {history && history.length > 0 && (
        <div className="mt-2 border-t border-stone-100 pt-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-stone-400">
            Override history
          </div>
          <ul className="space-y-1.5 text-xs text-stone-600">
            {history.map((h, i) => (
              <li key={i} className="rounded bg-stone-50 px-2 py-1.5">
                <span className="font-mono text-stone-400">{formatTimestamp(h.at)}</span>{" "}
                <span className="font-medium">
                  {h.fromBucket}/{SEVERITY_LABELS[h.fromSeverity]} →{" "}
                  {h.toBucket}/{SEVERITY_LABELS[h.toSeverity]}
                </span>
                <div className="text-stone-500">&ldquo;{h.note}&rdquo;</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
