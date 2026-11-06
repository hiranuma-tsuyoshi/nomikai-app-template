import { formatTime } from "@/lib/format";

type TimerRingProps = {
  remainingSeconds: number;
  totalSeconds: number;
  isLow: boolean;
  isClosed: boolean;
};

export function TimerRing({
  remainingSeconds,
  totalSeconds,
  isLow,
  isClosed,
}: TimerRingProps) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(
    0,
    Math.min(1, remainingSeconds / Math.max(1, totalSeconds)),
  );
  const offset = circumference * (1 - progress);

  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={`残り時間 ${formatTime(remainingSeconds)}`}
      className={`relative grid size-14 shrink-0 place-items-center rounded-full ${
        isLow ? "animate-timer-pulse" : ""
      }`}
    >
      <svg
        viewBox="0 0 52 52"
        className="absolute inset-0 -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="26"
          cy="26"
          r={radius}
          fill="none"
          stroke="#e5e5e5"
          strokeWidth="5"
        />
        <circle
          cx="26"
          cy="26"
          r={radius}
          fill="none"
          stroke={isClosed ? "#afafaf" : isLow ? "#ff4b4b" : "#58cc02"}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none"
        />
      </svg>
      <span
        className={`font-numeric text-[14px] font-extrabold tabular-nums ${
          isClosed
            ? "text-pencil-gray"
            : isLow
              ? "text-alert-red-ink"
              : "text-charcoal"
        }`}
      >
        {formatTime(remainingSeconds)}
      </span>
    </div>
  );
}
