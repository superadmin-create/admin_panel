"use client";

interface TimerProps {
  seconds: number;
}

export function Timer({ seconds }: TimerProps) {
  const formatTime = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className="text-4xl font-mono font-semibold text-gray-300 tabular-nums">
      {formatTime(seconds)}
    </div>
  );
}
