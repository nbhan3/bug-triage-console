/**
 * Tooltip — portal-based hover tooltip.
 *
 * Renders into document.body via a React portal so it is never clipped by
 * overflow:hidden parents (the 3-column workstation grid, scrollable panels,
 * etc.). Uses position:fixed with live viewport coordinates so it tracks the
 * trigger correctly even inside scrollable containers.
 *
 * The tooltip is left-aligned to the trigger element.
 * Visibility is controlled globally by TooltipsContext.
 */
import { useState, useRef } from "react";
import ReactDOM from "react-dom";
import { useTooltipsEnabled } from "../lib/tooltipContext";

export default function Tooltip({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  const enabled = useTooltipsEnabled();
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = () => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      // Place tooltip above the trigger, left-edge aligned with trigger's left edge.
      setPos({ top: r.top - 6, left: r.left });
    }
    setVisible(true);
  };

  // When disabled, render children unwrapped — zero layout impact.
  if (!enabled) return <>{children}</>;

  return (
    <span
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setVisible(false)}
      className="inline-flex"
    >
      {children}

      {visible &&
        ReactDOM.createPortal(
          <div
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              transform: "translateY(-100%)",
              zIndex: 9999,
              pointerEvents: "none",
            }}
            className="max-w-[280px] rounded bg-stone-800 px-2.5 py-1.5 text-[11px] leading-snug text-white"
          >
            {text}
            {/* Downward caret, anchored to the left so it points at the trigger */}
            <span
              style={{
                position: "absolute",
                top: "100%",
                left: 10,
                width: 0,
                height: 0,
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderTop: "5px solid #1c1917", // stone-800
              }}
            />
          </div>,
          document.body,
        )}
    </span>
  );
}
