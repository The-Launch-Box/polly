type ProgressBarProps = {
  value: number;
};

export function ProgressBar({ value }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      className="mt-3 h-1.5 w-full overflow-hidden rounded-full"
      style={{ backgroundColor: "var(--theme-progress-track)" }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-all duration-300 ease-out"
        style={{
          width: `${clamped}%`,
          backgroundColor: "var(--theme-primary)",
        }}
      />
    </div>
  );
}
