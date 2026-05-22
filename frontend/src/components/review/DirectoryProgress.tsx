'use client';

import { useEffect, useState } from 'react';

const STAGES = [
  { label: 'Fetching directory contents', duration: 3000 },
  { label: 'Building project context', duration: 4000 },
  { label: 'Running parallel analysis (security, performance, architecture, best practices)', duration: 8000 },
  { label: 'Aggregating findings', duration: 2000 },
  { label: 'Generating inline comments & summary', duration: 3000 },
];

export default function DirectoryProgress() {
  const [stageIndex, setStageIndex] = useState(0);
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    let elapsed = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    STAGES.forEach((stage, i) => {
      const t = setTimeout(() => setStageIndex(i), elapsed);
      timers.push(t);
      elapsed += stage.duration;
    });

    // Animate progress bar
    const interval = setInterval(() => {
      const total = STAGES.reduce((s, st) => s + st.duration, 0);
      setBarWidth((prev) => Math.min(prev + (100 / (total / 200)), 95));
    }, 200);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="space-y-4 py-6">
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-200 rounded-full"
          style={{ width: `${barWidth}%` }}
        />
      </div>

      <div className="space-y-2">
        {STAGES.map((stage, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 text-sm transition-opacity duration-300 ${
              i < stageIndex
                ? 'opacity-40'
                : i === stageIndex
                ? 'opacity-100 font-medium'
                : 'opacity-25'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                i < stageIndex
                  ? 'bg-green-500'
                  : i === stageIndex
                  ? 'bg-primary animate-pulse'
                  : 'bg-muted-foreground'
              }`}
            />
            {stage.label}
          </div>
        ))}
      </div>
    </div>
  );
}
