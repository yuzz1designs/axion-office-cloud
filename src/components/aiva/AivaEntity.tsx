import { motion } from "motion/react";
import type { CSSProperties } from "react";
import type { AudioLevelRef, AivaVisualState } from "./aivaVisual.types";
import AivaParticleScene from "./AivaParticleScene";
import type { AivaBrainId } from "../../lib/aivaBrain";

interface AivaEntityProps {
  state: AivaVisualState;
  accentColor: string;
  audioLevel: AudioLevelRef;
  reducedMotion: boolean;
  brain: AivaBrainId;
  executing: boolean;
}

export default function AivaEntity(props: AivaEntityProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: props.reducedMotion ? 0.01 : 1.1, ease: [0.16, 1, 0.3, 1] }}
      className="aiva-entity relative h-full min-h-0 w-full"
    >
      <div
        className={`aiva-entity__halo absolute inset-0 ${props.state === "idle" ? "is-idle" : ""}`}
        style={{ "--aiva-halo-color": props.accentColor } as CSSProperties}
      />
      <AivaParticleScene {...props} />
    </motion.div>
  );
}
