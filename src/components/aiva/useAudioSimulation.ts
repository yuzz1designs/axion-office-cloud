import { useEffect, useRef } from "react";
import type { AivaVisualState } from "./aivaVisual.types";

export function useAudioSimulation(state: AivaVisualState) {
  const level = useRef(0);

  useEffect(() => {
    let frame = 0;
    let start = performance.now();

    const update = (now: number) => {
      const elapsed = (now - start) / 1000;
      const target = state === "speaking"
        ? 0.28 + Math.abs(Math.sin(elapsed * 6.2)) * 0.42 + Math.abs(Math.sin(elapsed * 13.7)) * 0.22
        : 0;
      level.current += (target - level.current) * (state === "speaking" ? 0.16 : 0.1);
      if (state === "speaking" || level.current > 0.005) frame = requestAnimationFrame(update);
    };

    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [state]);

  return level;
}

