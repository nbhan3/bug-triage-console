import { useMemo } from "react";
import type { EvidenceSpan } from "../lib/triage";

interface Props {
  report: string;
  evidence: EvidenceSpan[];
}

interface Segment {
  text: string;
  span?: EvidenceSpan;
}

const KIND_STYLE: Record<EvidenceSpan["kind"], string> = {
  bucket: "bg-violet-200/70 text-violet-900 rounded px-0.5",
  tag: "bg-amber-200/80 text-amber-950 rounded px-0.5 underline decoration-dotted",
};

/**
 * Re-renders the original report with matched evidence substrings highlighted.
 * Color encodes kind (bucket signal vs exposure tag); the tooltip shows the
 * label (why it matched). Matching is done on the lowercased text so spans line
 * up with what the engine actually matched.
 */
export default function EvidenceText({ report, evidence }: Props) {
  const segments = useMemo(() => buildSegments(report, evidence), [report, evidence]);

  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap text-stone-700">
      {segments.map((seg, i) =>
        seg.span ? (
          <mark
            key={i}
            data-label={seg.span.label}
            title={`${seg.span.kind === "tag" ? "Exposure" : "Bucket"}: ${seg.span.label}`}
            className={KIND_STYLE[seg.span.kind]}
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </p>
  );
}

function buildSegments(report: string, evidence: EvidenceSpan[]): Segment[] {
  const lower = report.toLowerCase();

  // Collect all match ranges. Each evidence.text is the original-cased matched
  // substring; find every occurrence.
  interface Range {
    start: number;
    end: number;
    span: EvidenceSpan;
  }
  const ranges: Range[] = [];
  for (const span of evidence) {
    const needle = span.text.toLowerCase();
    if (!needle) continue;
    let from = 0;
    while (true) {
      const idx = lower.indexOf(needle, from);
      if (idx === -1) break;
      ranges.push({ start: idx, end: idx + needle.length, span });
      from = idx + needle.length;
    }
  }

  // Sort by start, then widest span first, then prefer exposure (tag) over
  // bucket on a tie; greedily drop overlaps so we never double-highlight.
  const kindRank = (k: EvidenceSpan["kind"]) => (k === "tag" ? 0 : 1);
  ranges.sort(
    (a, b) =>
      a.start - b.start ||
      b.end - a.end ||
      kindRank(a.span.kind) - kindRank(b.span.kind),
  );
  const chosen: Range[] = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start >= cursor) {
      chosen.push(r);
      cursor = r.end;
    }
  }

  const segments: Segment[] = [];
  let pos = 0;
  for (const r of chosen) {
    if (r.start > pos) segments.push({ text: report.slice(pos, r.start) });
    segments.push({ text: report.slice(r.start, r.end), span: r.span });
    pos = r.end;
  }
  if (pos < report.length) segments.push({ text: report.slice(pos) });
  return segments;
}
