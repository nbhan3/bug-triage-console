import { useState } from "react";
import type { TriageInput, Impact } from "../lib/triage";
import { SEEDS } from "../lib/seeds";

interface Props {
  onTriage: (input: TriageInput) => void;
}

const EMPTY: TriageInput = {
  bugReport: "",
  customer: "",
  callId: "",
  startedWhen: "",
  impact: "single",
};

const IMPACT_OPTIONS: { value: Impact; label: string }[] = [
  { value: "single", label: "Single caller" },
  { value: "many", label: "Many callers" },
  { value: "outage", label: "Outage" },
];

export default function InputForm({ onTriage }: Props) {
  const [form, setForm] = useState<TriageInput>(EMPTY);

  const set = <K extends keyof TriageInput>(key: K, value: TriageInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const canSubmit = form.bugReport.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    onTriage({ ...form, bugReport: form.bugReport.trim() });
  };

  const loadSeed = (id: string) => {
    if (!id) return;
    const seed = SEEDS.find((s) => String(s.id) === id);
    if (!seed) return;
    setForm({
      ...EMPTY,
      bugReport: seed.bugReport,
      impact: seed.impact,
      customer: "",
    });
  };

  const labelCls = "block text-[11px] font-semibold uppercase tracking-widest text-stone-400 mb-1.5";
  const inputCls =
    "w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-300 focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink";

  return (
    <div className="rounded-xl border border-cream-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">New bug report</h2>
        <select
          aria-label="Load example"
          defaultValue=""
          onChange={(e) => {
            loadSeed(e.target.value);
            e.target.value = "";
          }}
          className="rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
        >
          <option value="">Load example…</option>
          {SEEDS.map((s) => (
            <option key={s.id} value={s.id}>
              #{s.id} — {s.bugReport.slice(0, 48)}
              {s.bugReport.length > 48 ? "…" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        <div>
          <label className={labelCls} htmlFor="bugReport">
            Bug report <span className="text-red-500">*</span>
          </label>
          <textarea
            id="bugReport"
            value={form.bugReport}
            onChange={(e) => set("bugReport", e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
            }}
            rows={5}
            placeholder="Paste the customer's free-text report…"
            className={`${inputCls} resize-y`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="customer">
              Customer
            </label>
            <input
              id="customer"
              value={form.customer}
              onChange={(e) => set("customer", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="callId">
              Call ID
            </label>
            <input
              id="callId"
              value={form.callId}
              onChange={(e) => set("callId", e.target.value)}
              placeholder="optional"
              className={`${inputCls} font-mono`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="startedWhen">
              When did it start
            </label>
            <input
              id="startedWhen"
              value={form.startedWhen}
              onChange={(e) => set("startedWhen", e.target.value)}
              placeholder="optional"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="impact">
              Impact
            </label>
            <select
              id="impact"
              value={form.impact}
              onChange={(e) => set("impact", e.target.value as Impact)}
              className={inputCls}
            >
              {IMPACT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
          >
            Triage report
          </button>
          <span className="text-xs text-stone-400">⌘/Ctrl + Enter</span>
        </div>
      </div>
    </div>
  );
}
