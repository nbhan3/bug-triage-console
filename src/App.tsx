import { useEffect, useMemo, useState } from "react";
import { TooltipsContext } from "./lib/tooltipContext";

function SalientLogo() {
  const lines = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40];
  return (
    <svg width="30" height="36" viewBox="0 0 30 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Salient">
      <defs>
        <clipPath id="s-clip">
          <path
            d="M 24 5 C 24 5 6 5 6 14 C 6 23 24 19 24 30 C 24 39 6 39 6 39"
            stroke="black" strokeWidth="10" fill="none"
            strokeLinecap="round" strokeLinejoin="round"
          />
        </clipPath>
      </defs>
      <g clipPath="url(#s-clip)">
        {lines.map((y) => (
          <line key={y} x1="0" y1={y} x2="30" y2={y} stroke="#111110" strokeWidth="1.8" />
        ))}
      </g>
    </svg>
  );
}

import { triage, type TriageInput, type TriageResult, type Bucket, type Severity } from "./lib/triage";
import {
  loadQueue,
  saveQueue,
  newId,
  type QueueItem,
  type ItemStatus,
  type OverrideEntry,
} from "./lib/storage";
import { classifyWithLLM } from "./lib/llm";
import StatBar from "./components/StatBar";
import InputForm from "./components/InputForm";
import ResultCard from "./components/ResultCard";
import OverrideEditor from "./components/OverrideEditor";
import QueueSidebar from "./components/QueueSidebar";
import TriageQueue from "./components/TriageQueue";
import Methodology from "./components/Methodology";
import BatchResults from "./components/BatchResults";

type Tab = "triage" | "queue" | "batch" | "methodology";

interface Draft {
  input: TriageInput;
  result: TriageResult;
  effectiveBucket: Bucket;
  effectiveSeverity: Severity;
  overrides: OverrideEntry[];
  /** True while the async LLM classify call is in flight. */
  llmPending: boolean;
}

export default function App() {
  const [queue, setQueue] = useState<QueueItem[]>(() => loadQueue());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("triage");
  // Queue tab: filter set by StatBar sev-click
  const [queueSevFilter, setQueueSevFilter] = useState<Severity | undefined>(undefined);
  // Sidebar: independent sev filter
  const [sidebarSevFilter, setSidebarSevFilter] = useState<Severity | "">("");
  // Global tooltip toggle
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true);

  useEffect(() => {
    saveQueue(queue);
  }, [queue]);

  const selected = useMemo(
    () => queue.find((i) => i.id === selectedId) ?? null,
    [queue, selectedId],
  );

  // --- triage a new report ---
  const handleTriage = (input: TriageInput) => {
    const result = triage(input);
    setDraft({
      input,
      result,
      effectiveBucket: result.primaryBucket,
      effectiveSeverity: result.severity,
      overrides: [],
      llmPending: true,
    });
    setSelectedId(null);

    // Fire async LLM call; update draft when it resolves.
    // The rules result is shown immediately; LLM is additive.
    classifyWithLLM(input).then((llm) => {
      setDraft((d) => {
        if (!d) return d;
        return {
          ...d,
          llmPending: false,
          result: llm.available
            ? { ...d.result, llmBucket: llm.bucket, llmReason: llm.reason }
            : { ...d.result },
        };
      });
    });
  };

  // --- override on the draft (before it enters the queue) ---
  const draftOverride = (toBucket: Bucket, toSeverity: Severity, note: string) => {
    setDraft((d) => {
      if (!d) return d;
      const entry: OverrideEntry = {
        at: new Date().toISOString(),
        fromBucket: d.effectiveBucket,
        toBucket,
        fromSeverity: d.effectiveSeverity,
        toSeverity,
        note,
      };
      return { ...d, effectiveBucket: toBucket, effectiveSeverity: toSeverity, overrides: [...d.overrides, entry] };
    });
  };

  // --- commit draft to queue ---
  const commitDraft = (status: ItemStatus) => {
    if (!draft) return;
    const item: QueueItem = {
      id: newId(),
      createdAt: new Date().toISOString(),
      input: draft.input,
      recommendation: draft.result,
      bucket: draft.effectiveBucket,
      severity: draft.effectiveSeverity,
      status,
      overrides: draft.overrides,
    };
    setQueue((q) => [item, ...q]);
    setDraft(null);
    setSelectedId(item.id);
  };

  // --- queue item mutations ---
  const setStatus = (id: string, status: ItemStatus) =>
    setQueue((q) => q.map((i) => (i.id === id ? { ...i, status } : i)));

  const itemOverride = (id: string, toBucket: Bucket, toSeverity: Severity, note: string) =>
    setQueue((q) =>
      q.map((i) => {
        if (i.id !== id) return i;
        const entry: OverrideEntry = {
          at: new Date().toISOString(),
          fromBucket: i.bucket,
          toBucket,
          fromSeverity: i.severity,
          toSeverity,
          note,
        };
        return { ...i, bucket: toBucket, severity: toSeverity, overrides: [...i.overrides, entry] };
      }),
    );

  const deleteItem = (id: string) => {
    setQueue((q) => q.filter((i) => i.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleQueueSelect = (id: string) => {
    setSelectedId(id);
    setDraft(null);
  };

  const handleNewReport = () => {
    setSelectedId(null);
    setDraft(null);
  };

  return (
    <TooltipsContext.Provider value={tooltipsEnabled}>
    <div className="mx-auto max-w-[1400px] p-4 lg:p-6">
      {/* Header */}
      <header className="flex items-center justify-between pb-4">
        <div className="flex items-center gap-3">
          <SalientLogo />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">Salient</span>
              <span className="text-stone-300">/</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">Customer Success &amp; Engineering</span>
            </div>
            <h1 className="text-lg font-bold leading-tight text-ink">Bug Triage Console</h1>
          </div>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-1.5">
          <p className="text-xs text-stone-400">
            deterministic · auditable · no auto-routing
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-stone-400">Tooltips</span>
            <button
              role="switch"
              aria-checked={tooltipsEnabled}
              onClick={() => setTooltipsEnabled((v) => !v)}
              className={`relative inline-flex h-4 w-7 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                tooltipsEnabled ? "bg-stone-700" : "bg-stone-300"
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                  tooltipsEnabled ? "translate-x-3.5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <nav className="flex border-b border-cream-border mb-4">
        {(
          [
            { id: "triage", label: "Triage" },
            { id: "queue", label: queue.length > 0 ? `Queue (${queue.length})` : "Queue" },
            { id: "batch", label: "Examples" },
            { id: "methodology", label: "Methodology" },
          ] as { id: Tab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? "border-ink text-ink"
                : "border-transparent text-stone-400 hover:text-stone-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ── Tab: Triage (3-column workstation) ── */}
      {activeTab === "triage" && (
        <div className="space-y-4">
          <StatBar
            items={queue}
            onSevClick={(sev) => { setQueueSevFilter(sev); setActiveTab("queue"); }}
          />

          <div
            className="grid gap-0 rounded-xl border border-cream-border overflow-hidden"
            style={{
              gridTemplateColumns: "260px 1fr 300px",
              height: "calc(100vh - 220px)",
            }}
          >
            {/* Left: Queue sidebar */}
            <QueueSidebar
              items={queue}
              selectedId={draft ? null : selectedId}
              onSelect={handleQueueSelect}
              onNewReport={handleNewReport}
              sevFilter={sidebarSevFilter}
              onSevFilter={setSidebarSevFilter}
            />

            {/* Center: InputForm or ResultCard */}
            <div className="overflow-y-auto bg-[#FAFAF9] p-4 border-r border-cream-border">
              {draft ? (
                <ResultCard
                  report={draft.input.bugReport}
                  result={draft.result}
                  effectiveBucket={draft.effectiveBucket}
                  effectiveSeverity={draft.effectiveSeverity}
                  llmPending={draft.llmPending}
                />
              ) : selected ? (
                <ResultCard
                  report={selected.input.bugReport}
                  result={selected.recommendation}
                  effectiveBucket={selected.bucket}
                  effectiveSeverity={selected.severity}
                />
              ) : (
                <div className="mx-auto max-w-lg pt-2">
                  <InputForm onTriage={handleTriage} />
                </div>
              )}
            </div>

            {/* Right: Actions panel */}
            <div className="overflow-y-auto bg-card p-4">
              {draft ? (
                <DraftActions
                  draft={draft}
                  onOverride={draftOverride}
                  onSave={() => commitDraft("New")}
                  onRoute={() => commitDraft("Routed")}
                  onDiscard={() => setDraft(null)}
                />
              ) : selected ? (
                <ItemActions
                  item={selected}
                  onStatus={(s) => setStatus(selected.id, s)}
                  onOverride={(b, s, note) => itemOverride(selected.id, b, s, note)}
                  onDelete={() => deleteItem(selected.id)}
                  onClose={() => setSelectedId(null)}
                />
              ) : (
                <div className="flex h-full min-h-[12rem] items-center justify-center text-center text-xs text-stone-300 px-4">
                  Triage a report or select an item from the queue to see actions here.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Queue ── */}
      {activeTab === "queue" && (
        <TriageQueue
          items={queue}
          selectedId={selectedId}
          onSelect={(id) => { setSelectedId(id); setActiveTab("triage"); }}
          onStatusChange={setStatus}
          initialSevFilter={queueSevFilter}
        />
      )}

      {/* ── Tab: Run all examples ── */}
      {activeTab === "batch" && <BatchResults />}

      {/* ── Tab: Methodology ── */}
      {activeTab === "methodology" && <Methodology />}
    </div>
    </TooltipsContext.Provider>
  );
}

// ---------------------------------------------------------------------------

function DraftActions({
  draft,
  onOverride,
  onSave,
  onRoute,
  onDiscard,
}: {
  draft: Draft;
  onOverride: (b: Bucket, s: Severity, note: string) => void;
  onSave: () => void;
  onRoute: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400 pb-1 border-b border-stone-100">
        Actions
      </div>

      <OverrideEditor
        bucket={draft.effectiveBucket}
        severity={draft.effectiveSeverity}
        history={draft.overrides}
        onOverride={onOverride}
      />

      <div className="flex flex-col gap-2 border-t border-stone-100 pt-3">
        <button
          onClick={onRoute}
          className="w-full rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-stone-800 transition-colors"
        >
          Confirm &amp; Route →
        </button>
        <button
          onClick={onSave}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
        >
          Save to queue
        </button>
        <button
          onClick={onDiscard}
          className="w-full py-1 text-xs text-stone-400 hover:text-stone-600 transition-colors"
        >
          Discard
        </button>
      </div>

      <p className="text-[11px] text-stone-400 border-t border-stone-100 pt-3 leading-relaxed">
        Nothing is routed automatically.{" "}
        <strong>Confirm &amp; Route</strong> is the explicit, deliberate action;
        triage alone never routes.
      </p>
    </div>
  );
}

function ItemActions({
  item,
  onStatus,
  onOverride,
  onDelete,
  onClose,
}: {
  item: QueueItem;
  onStatus: (s: ItemStatus) => void;
  onOverride: (b: Bucket, s: Severity, note: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const STATUSES: ItemStatus[] = ["New", "In Review", "Routed", "Resolved"];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-1 border-b border-stone-100">
        <span className="font-mono text-[11px] text-stone-400 truncate">{item.id}</span>
        <button
          onClick={onClose}
          className="ml-2 shrink-0 text-xs text-stone-400 hover:text-stone-600 transition-colors"
        >
          Close ✕
        </button>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1.5">
          Status
        </div>
        <select
          value={item.status}
          onChange={(e) => onStatus(e.target.value as ItemStatus)}
          className="w-full rounded-md border border-stone-200 bg-white px-2 py-1.5 text-sm text-stone-700 focus:border-ink focus:outline-none"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <OverrideEditor
        bucket={item.bucket}
        severity={item.severity}
        history={item.overrides}
        onOverride={onOverride}
      />

      <div className="border-t border-stone-100 pt-3">
        <button
          onClick={onDelete}
          className="text-xs text-red-400 hover:text-red-600 transition-colors"
        >
          Delete from queue
        </button>
      </div>
    </div>
  );
}
