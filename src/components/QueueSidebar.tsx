import type { QueueItem, ItemStatus } from "../lib/storage";
import type { Severity } from "../lib/triage";
import { SEVERITY_STYLE, SEVERITY_LABELS, BUCKET_STYLE, BUCKET_TOOLTIP, SEVERITY_TOOLTIP, formatTimestamp } from "../lib/display";
import Tooltip from "./Tooltip";

interface Props {
  items: QueueItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewReport: () => void;
  sevFilter: Severity | "";
  onSevFilter: (sev: Severity | "") => void;
}

const SEVS: Severity[] = [0, 1, 2, 3];

const STATUS_DOT: Record<ItemStatus, string> = {
  New: "bg-blue-400",
  "In Review": "bg-purple-400",
  Routed: "bg-emerald-400",
  Resolved: "bg-stone-300",
};

export default function QueueSidebar({
  items,
  selectedId,
  onSelect,
  onNewReport,
  sevFilter,
  onSevFilter,
}: Props) {
  const filtered =
    sevFilter === "" ? items : items.filter((i) => i.severity === sevFilter);

  return (
    <div className="flex flex-col h-full overflow-hidden border-r border-cream-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-cream-border shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
          Queue
          {items.length > 0 && (
            <span className="ml-1 text-ink">({items.length})</span>
          )}
        </span>
        <button
          onClick={onNewReport}
          className="rounded-md bg-ink px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-stone-800 transition-colors"
        >
          + New report
        </button>
      </div>

      {/* Sev filter pills */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-stone-100 shrink-0 flex-wrap">
        <button
          onClick={() => onSevFilter("")}
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
            sevFilter === ""
              ? "bg-ink text-white"
              : "text-stone-400 hover:text-stone-600"
          }`}
        >
          All
        </button>
        {SEVS.map((s) => (
          <button
            key={s}
            onClick={() => onSevFilter(sevFilter === s ? "" : s)}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
              sevFilter === s
                ? SEVERITY_STYLE[s].badge
                : "text-stone-400 hover:text-stone-600"
            }`}
          >
            <Tooltip text={SEVERITY_TOOLTIP[s]}>
              <span>{SEVERITY_LABELS[s]}</span>
            </Tooltip>
          </button>
        ))}
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-xs text-stone-400">
            {items.length === 0
              ? "Queue is empty. Triage a report to get started."
              : "No items match this filter."}
          </div>
        ) : (
          <ul>
            {filtered.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => onSelect(item.id)}
                  className={`w-full text-left px-3 py-2.5 border-b border-stone-50 hover:bg-cream/60 transition-colors ${
                    selectedId === item.id
                      ? "bg-cream border-l-2 border-l-ink"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Tooltip text={SEVERITY_TOOLTIP[item.severity]}>
                      <span
                        className={`rounded px-1.5 py-0 text-[10px] font-bold leading-4 ${SEVERITY_STYLE[item.severity].badge}`}
                      >
                        Sev{item.severity}
                      </span>
                    </Tooltip>
                    <Tooltip text={BUCKET_TOOLTIP[item.bucket]}>
                      <span
                        className={`rounded px-1.5 py-0 text-[10px] font-semibold leading-4 ${BUCKET_STYLE[item.bucket]}`}
                      >
                        {item.bucket}
                      </span>
                    </Tooltip>
                    {item.overrides.length > 0 && (
                      <span
                        className="text-[10px] text-amber-500"
                        title="Human override applied"
                      >
                        ✎
                      </span>
                    )}
                    <span
                      className={`ml-auto inline-block h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[item.status]}`}
                      title={item.status}
                    />
                  </div>
                  <div className="text-xs font-semibold text-ink truncate">
                    {item.input.customer || "—"}
                  </div>
                  <div className="text-[11px] text-stone-400 truncate leading-tight">
                    {item.input.bugReport}
                  </div>
                  <div className="mt-0.5 text-[10px] text-stone-300 font-mono">
                    {formatTimestamp(item.createdAt)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
