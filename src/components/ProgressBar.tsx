import { useRef, useState } from "react";

type ProgressBarProps = {
  value: number;
  total?: number;
  currentIndex?: number;
  onSeek?: (index: number) => void;
  disabled?: boolean;
  questionErrors?: boolean[];
};

export function ProgressBar({
  value,
  total,
  currentIndex,
  onSeek,
  disabled,
  questionErrors,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const trackRef = useRef<HTMLDivElement>(null);
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;
  const [isDragging, setIsDragging] = useState(false);
  const isInteractive = !!onSeek && !disabled && total !== undefined && total > 1;

  function indexFromClientX(clientX: number): number | null {
    const el = trackRef.current;
    if (!el || total === undefined) return null;
    const rect = el.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    // Snap to the nearest tick. Tick i sits at (i+1)/total.
    let nearest = 0;
    let minDist = Infinity;
    for (let i = 0; i < total; i++) {
      const dist = Math.abs(fraction - (i + 1) / total);
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    }
    return nearest;
  }

  function handleTrackClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!isInteractive || !onSeek) return;
    const index = indexFromClientX(e.clientX);
    if (index !== null) onSeek(index);
  }

  function handleKnobPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!isInteractive) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);

    const move = (ev: PointerEvent) => {
      const index = indexFromClientX(ev.clientX);
      if (index !== null) onSeekRef.current?.(index);
    };

    const up = () => {
      setIsDragging(false);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
    };

    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!onSeek || currentIndex === undefined || total === undefined) return;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onSeek(Math.min(total - 1, currentIndex + 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onSeek(Math.max(0, currentIndex - 1));
    }
  }

  const animate = !isDragging;

  return (
    <div
      className="relative mt-3 w-full py-3"
      role={isInteractive ? "slider" : "progressbar"}
      aria-valuenow={isInteractive ? (currentIndex ?? 0) : clamped}
      aria-valuemin={0}
      aria-valuemax={isInteractive ? (total! - 1) : 100}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
    >
      {/* Track + fill */}
      <div
        ref={trackRef}
        className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full"
        style={{
          backgroundColor: "var(--theme-progress-track)",
          cursor: isInteractive ? "pointer" : undefined,
        }}
        onClick={isInteractive ? handleTrackClick : undefined}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${clamped}%`,
            backgroundColor: "var(--theme-primary)",
            transition: animate ? "width 300ms ease-out" : "none",
          }}
        />
      </div>

      {/* Tick marks — vertical notches at each question stop */}
      {isInteractive &&
        total !== undefined &&
        Array.from({ length: total }, (_, i) => {
          const hasError = questionErrors?.[i] ?? false;
          return (
            <div
              key={i}
              className="pointer-events-none absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-200"
              style={{
                left: `${((i + 1) / total) * 100}%`,
                width: hasError ? "4px" : "2px",
                height: "10px",
                backgroundColor: hasError ? "#ef4444" : "rgba(255,255,255,0.75)",
              }}
            />
          );
        })}

      {/* Draggable knob */}
      {isInteractive && (
        <div
          className="absolute top-1/2 z-20 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-md"
          style={{
            left: `${clamped}%`,
            backgroundColor: "var(--theme-primary)",
            border: "2.5px solid white",
            cursor: isDragging ? "grabbing" : "grab",
            transition: animate ? "left 300ms ease-out" : "none",
          }}
          onPointerDown={handleKnobPointerDown}
        />
      )}
    </div>
  );
}
