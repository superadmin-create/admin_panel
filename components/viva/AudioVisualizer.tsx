"use client";

interface AudioVisualizerProps {
  isActive: boolean;
  bars?: number;
}

export function AudioVisualizer({
  isActive,
  bars = 12,
}: AudioVisualizerProps) {
  // Generate bar heights for animation
  const barHeights = Array.from({ length: bars }, (_, i) => {
    return 20 + (i % 4) * 8;
  });

  return (
    <div className="flex items-end justify-center gap-1.5 h-24">
      {barHeights.map((height, i) => {
        const delay = (i * 0.08) % 0.8;
        const duration = 0.5 + (i % 3) * 0.15;
        return (
          <div
            key={i}
            className={`w-1 bg-blue-500 rounded-full transition-opacity duration-150 ${
              isActive ? "opacity-100" : "opacity-30"
            }`}
            style={{
              height: `${height}px`,
              ...(isActive
                ? {
                    animation: `visualizer ${duration}s ease-in-out infinite`,
                    animationDelay: `${delay}s`,
                  }
                : { animation: "none" }),
            }}
          />
        );
      })}
    </div>
  );
}
