import type { ReactNode } from "react";
import { motion } from "motion/react";
import { getAivaPanelTransition } from "./aivaPanelMotion";
import { useReducedMotion } from "./useReducedMotion";

interface Props {
  key?: string;
  accentColor: string;
  children: ReactNode;
}

const CORNERS = [
  "left-2 top-2 border-l border-t",
  "right-2 top-2 border-r border-t",
  "bottom-2 left-2 border-b border-l",
  "bottom-2 right-2 border-b border-r",
];

export default function AivaPanelTransition({ accentColor, children }: Props) {
  const reducedMotion = useReducedMotion();
  const sequence = getAivaPanelTransition(reducedMotion);

  return (
    <motion.div
      initial={sequence.panel.initial}
      animate={sequence.panel.animate}
      exit={sequence.panel.exit}
      transition={sequence.panel.transition}
      className="aiva-panel relative z-10 h-full w-full overflow-y-auto pr-2"
      style={{ transformPerspective: 1200 }}
    >
      <motion.div {...sequence.content} className="relative h-full min-h-full">
        {children}
      </motion.div>

      {sequence.showScanEffects && (
        <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden rounded-[28px]" aria-hidden="true">
          <motion.div
            className="absolute left-[3%] right-[3%] top-1/2 h-px origin-center"
            style={{ backgroundColor: accentColor, boxShadow: `0 0 16px ${accentColor}, 0 0 32px ${accentColor}66` }}
            initial={{ scaleX: 0.04, opacity: 0 }}
            animate={{ scaleX: [0.04, 1, 1], opacity: [0, 0.95, 0] }}
            transition={{ duration: 0.82, times: [0, 0.24, 1], ease: [0.16, 1, 0.3, 1] }}
          />

          <motion.div
            className="absolute left-[1.5%] right-[1.5%] h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${accentColor}cc, transparent)`, boxShadow: `0 0 22px ${accentColor}88` }}
            initial={{ top: "5%", opacity: 0 }}
            animate={{ top: ["5%", "94%"], opacity: [0, 0.75, 0] }}
            transition={{ duration: 0.68, delay: 0.17, times: [0, 0.16, 1], ease: "easeInOut" }}
          />

          {CORNERS.map((className, index) => (
            <motion.span
              key={className}
              className={`absolute h-8 w-8 ${className}`}
              style={{ borderColor: `${accentColor}a8`, filter: `drop-shadow(0 0 7px ${accentColor}88)` }}
              initial={{ opacity: 0, scale: 0.65 }}
              animate={{ opacity: [0, 0.9, 0.28], scale: [0.65, 1.08, 1] }}
              transition={{ duration: 0.78, delay: 0.12 + index * 0.025, times: [0, 0.42, 1], ease: [0.16, 1, 0.3, 1] }}
            />
          ))}

          <motion.div
            className="absolute left-7 top-5 font-mono text-[7px] uppercase tracking-[0.28em]"
            style={{ color: accentColor }}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: [0, 0.72, 0], x: 0 }}
            transition={{ duration: 0.84, delay: 0.2, times: [0, 0.35, 1] }}
          >
            AIVA // Neural interface online
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
