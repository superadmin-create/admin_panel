"use client";

export function SuccessCheckmark() {
  return (
    <div className="relative w-24 h-24 mx-auto mb-6">
      <svg
        className="w-full h-full transform scale-0 animate-success-check"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Circle background */}
        <circle cx="50" cy="50" r="48" fill="#10b981" />
        {/* Checkmark */}
        <path
          d="M30 50 L45 65 L70 35"
          stroke="white"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          className="animate-draw-check"
        />
      </svg>
    </div>
  );
}
