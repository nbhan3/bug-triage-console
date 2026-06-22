import type { QueueItem } from "../lib/storage";
import type { Severity } from "../lib/triage";
import { SEVERITY_STYLE, SEVERITY_LABELS, SEVERITY_TOOLTIP } from "../lib/display";
import Tooltip from "./Tooltip";

interface Props {
  items: QueueItem[];
  onSevClick: (sev: Severity) => void;
}

const SEVS: Severity[] = [0, 1, 2, 3];

export default function StatBar({ items, onSevClick }: Props) {
  const total = items.length;

  const bySev = (sev: Severity) => items.filter((i) => i.severity === sev).length;

  // Rules-vs-human agreement: of routed/reviewed items, the share where the
  // human did NOT change the recommended bucket OR severity.
  const decided = items.filter((i) => i.status !== "New");
  const agreed = decided.filter(
    (i) =>
      i.bucket === i.recommendation.primaryBucket &&
      i.severity === i.recommendation.severity,
  ).length;
  const agreement = decided.length === 0 ? null : Math.round((agreed / decided.length) * 100);

  return (
    <div className="flex flex-wrap items-center gap-6 rounded-xl border border-cream-border bg-card px-6 py-4 shadow-sm">
      <Stat label="In queue" value={String(total)} />
      <div className="h-8 w-px bg-cream-border" />
      <div className="flex items-center gap-5">
        {SEVS.map((s) => (
          <button
            key={s}
            onClick={() => onSevClick(s)}
            className="flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-cream transition-colors"
          >
            <span className={`inline-block h-2 w-2 rounded-full ${SEVERITY_STYLE[s].dot}`} />
            <Tooltip text={SEVERITY_TOOLTIP[s]}>
              <span className="text-xs font-medium text-stone-500">{SEVERITY_LABELS[s]}</span>
            </Tooltip>
            <span className="text-sm font-bold text-ink">{bySev(s)}</span>
          </button>
        ))}
      </div>
      <div className="h-8 w-px bg-cream-border" />
      <Stat
        label="Rules ↔ human agreement"
        value={agreement === null ? "—" : `${agreement}%`}
        hint={
          decided.length === 0
            ? "no decided items yet"
            : `${agreed}/${decided.length} unchanged`
        }
      />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
        {label}
      </span>
      <span className="text-lg font-bold leading-tight text-ink">
        {value}
        {hint && <span className="ml-1.5 text-[11px] font-normal text-stone-400">{hint}</span>}
      </span>
    </div>
  );
}
