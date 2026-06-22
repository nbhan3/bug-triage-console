import { useEffect, useMemo, useState } from "react";
import type { QueueItem, ItemStatus } from "../lib/storage";
import type { Bucket, Severity } from "../lib/triage";
import { BUCKETS, SEVERITY_LABELS } from "../lib/rules";
import {
  SEVERITY_STYLE,
  BUCKET_STYLE,
  CONFIDENCE_STYLE,
  BUCKET_TOOLTIP,
  SEVERITY_TOOLTIP,
  CONFIDENCE_TOOLTIP,
  formatTimestamp,
} from "../lib/display";
import Tooltip from "./Tooltip";

interface Props {
  items: QueueItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onStatusChange: (id: string, status: ItemStatus) => void;
  initialSevFilter?: Severity;
}

const STATUSES: ItemStatus[] = ["New", "In Review", "Routed", "Resolved"];
const SEVS: Severity[] = [0, 1, 2, 3];

const STATUS_STYLE: Record<ItemStatus, string> = {
  New: "bg-blue-100 text-blue-800",
  "In Review": "bg-purple-100 text-purple-800",
  Routed: "bg-emerald-100 text-emerald-800",
  Resolved: "bg-gray-200 text-gray-600",
};

export default function TriageQueue({ items, selectedId, onSelect, onStatusChange, initialSevFilter }: Props) {
  const [bucketF, setBucketF] = useState<Bucket | "">("");
  const [sevF, setSevF] = useState<Severity | "">(initialSevFilter ?? "");

  useEffect(() => {
    if (initialSevFilter !== undefined) setSevF(initialSevFilter);
  }, [initialSevFilter]);
  const [statusF, setStatusF] = useState<ItemStatus | "">("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (bucketF && i.bucket !== bucketF) return false;
      if (sevF !== "" && i.severity !== sevF) return false;
      if (statusF && i.status !== statusF) return false;
      if (search && !i.input.customer.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [items, bucketF, sevF, statusF, search]);

  const selCls = "rounded-md border border-stone-200 bg-white px-2 py-1 text-xs text-stone-700 focus:border-ink focus:outline-none";

  return (
    <div className="rounded-xl border border-cream-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-4 py-3">
        <h2 className="mr-2 text-sm font-bold text-ink">Triage queue</h2>
        <select value={bucketF} onChange={(e) => setBucketF(e.target.value as Bucket | "")} className={selCls}>
          <option value="">All buckets</option>
          {BUCKETS.map((d) => (
            <option key={d.key} value={d.key}>{d.key}</option>
          ))}
        </select>
        <select
          value={sevF === "" ? "" : String(sevF)}
          onChange={(e) => setSevF(e.target.value === "" ? "" : (Number(e.target.value) as Severity))}
          className={selCls}
        >
          <option value="">All severities</option>
          {SEVS.map((s) => (
            <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
          ))}
        </select>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value as ItemStatus | "")} className={selCls}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer…"
          className={`${selCls} w-44 placeholder:text-stone-300`}
        />
        <div className="ml-auto flex gap-2">
          {(bucketF || sevF !== "" || statusF || search) && (
            <button
              onClick={() => { setBucketF(""); setSevF(""); setStatusF(""); setSearch(""); }}
              className="rounded-md px-2.5 py-1 text-xs font-semibold text-stone-400 hover:text-stone-600"
            >
              Clear filters ✕
            </button>
          )}
          <button
            onClick={() => exportJSON(filtered)}
            className="rounded-md border border-stone-200 px-2.5 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-50"
          >
            Export JSON
          </button>
          <button
            onClick={() => exportCSV(filtered)}
            className="rounded-md border border-stone-200 px-2.5 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 text-center text-sm text-stone-400">
          {items.length === 0
            ? "Nothing in the queue yet. Triage a report and Save it."
            : "No items match the current filters."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-[10px] uppercase tracking-widest text-stone-400">
                <th className="px-4 py-2.5 font-semibold">Customer</th>
                <th className="px-4 py-2.5 font-semibold">Bucket</th>
                <th className="px-4 py-2.5 font-semibold">Severity</th>
                <th className="px-4 py-2.5 font-semibold">Confidence</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr
                  key={i.id}
                  onClick={() => onSelect(i.id)}
                  className={`cursor-pointer border-b border-stone-50 transition-colors hover:bg-stone-50 ${
                    selectedId === i.id ? "bg-cream/60" : ""
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-ink">{i.input.customer || "—"}</div>
                    <div className="max-w-[28ch] truncate text-xs text-stone-400">
                      {i.input.bugReport}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Tooltip text={BUCKET_TOOLTIP[i.bucket]}>
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${BUCKET_STYLE[i.bucket]}`}>
                        {i.bucket}
                      </span>
                    </Tooltip>
                    {i.overrides.length > 0 && (
                      <span className="ml-1 text-[10px] text-amber-600" title="Human-overridden">✎</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Tooltip text={SEVERITY_TOOLTIP[i.severity]}>
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${SEVERITY_STYLE[i.severity].badge}`}>
                        {SEVERITY_LABELS[i.severity]}
                      </span>
                    </Tooltip>
                  </td>
                  <td className="px-4 py-2.5">
                    <Tooltip text={CONFIDENCE_TOOLTIP[i.recommendation.confidence]}>
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${CONFIDENCE_STYLE[i.recommendation.confidence]}`}>
                        {i.recommendation.confidence}
                      </span>
                    </Tooltip>
                  </td>
                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={i.status}
                      onChange={(e) => onStatusChange(i.id, e.target.value as ItemStatus)}
                      className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[i.status]}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-stone-400">
                    {formatTimestamp(i.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- export helpers --------------------------------------------------------

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJSON(items: QueueItem[]) {
  download("triage-queue.json", JSON.stringify(items, null, 2), "application/json");
}

function exportCSV(items: QueueItem[]) {
  const headers = [
    "id",
    "createdAt",
    "customer",
    "callId",
    "impact",
    "bucket",
    "severity",
    "confidence",
    "status",
    "exposure",
    "overrides",
    "bugReport",
  ];
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = items.map((i) =>
    [
      i.id,
      i.createdAt,
      i.input.customer,
      i.input.callId ?? "",
      i.input.impact,
      i.bucket,
      `Sev${i.severity}`,
      i.recommendation.confidence,
      i.status,
      i.recommendation.exposure.join("|"),
      String(i.overrides.length),
      i.input.bugReport,
    ]
      .map(esc)
      .join(","),
  );
  download("triage-queue.csv", [headers.join(","), ...rows].join("\n"), "text/csv");
}
