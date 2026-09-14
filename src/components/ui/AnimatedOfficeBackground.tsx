import { motion } from "motion/react";

interface AnimatedOfficeBackgroundProps {
  color: string;
}

const WAVE_PATHS = {
  back: [
    "M-180 500 C120 380 330 650 620 520 C900 390 1140 610 1620 440 L1620 980 L-180 980 Z",
    "M-180 430 C120 620 360 350 650 500 C930 650 1210 370 1620 560 L1620 980 L-180 980 Z",
    "M-180 540 C140 410 390 610 690 450 C980 300 1260 650 1620 470 L1620 980 L-180 980 Z",
  ],
  middle: [
    "M-180 610 C180 450 370 720 690 570 C980 430 1260 690 1620 520",
    "M-180 550 C170 730 430 430 740 600 C1040 760 1280 460 1620 630",
    "M-180 650 C160 500 430 700 760 520 C1060 360 1340 670 1620 560",
  ],
  front: [
    "M-180 690 C150 570 430 790 760 640 C1070 500 1320 760 1620 620 L1620 980 L-180 980 Z",
    "M-180 650 C170 810 470 540 790 700 C1080 840 1340 570 1620 720 L1620 980 L-180 980 Z",
    "M-180 740 C140 590 460 780 800 610 C1120 460 1380 790 1620 650 L1620 980 L-180 980 Z",
  ],
};

export default function AnimatedOfficeBackground({ color }: AnimatedOfficeBackgroundProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="absolute inset-0 z-0 overflow-hidden bg-[#020307] pointer-events-none"
      aria-hidden="true"
    >
      <motion.div
        className="absolute -left-[12%] -top-[28%] h-[70%] w-[68%] rounded-full blur-[150px]"
        style={{ backgroundColor: color, opacity: 0.08 }}
        animate={{ x: [0, 130, 35, 0], y: [0, 65, 130, 0], scale: [1, 1.18, 0.94, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-[30%] -right-[15%] h-[78%] w-[72%] rounded-full blur-[170px]"
        style={{ backgroundColor: color, opacity: 0.07 }}
        animate={{ x: [0, -110, -35, 0], y: [0, -75, -120, 0], scale: [1.08, 0.92, 1.16, 1.08] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="none">
        <defs>
          <linearGradient id="axion-wave-back" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.02" />
            <stop offset="50%" stopColor={color} stopOpacity="0.12" />
            <stop offset="100%" stopColor={color} stopOpacity="0.015" />
          </linearGradient>
          <linearGradient id="axion-wave-front" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity="0.015" />
            <stop offset="45%" stopColor={color} stopOpacity="0.09" />
            <stop offset="100%" stopColor={color} stopOpacity="0.025" />
          </linearGradient>
        </defs>

        <motion.path
          d={WAVE_PATHS.back[0]}
          fill="url(#axion-wave-back)"
          animate={{ d: WAVE_PATHS.back }}
          transition={{ duration: 18, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
        />
        <motion.path
          d={WAVE_PATHS.middle[0]}
          fill="none"
          stroke={color}
          strokeOpacity="0.2"
          strokeWidth="1.4"
          animate={{ d: WAVE_PATHS.middle, strokeOpacity: [0.1, 0.25, 0.13] }}
          transition={{ duration: 13, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
        />
        <motion.path
          d={WAVE_PATHS.front[0]}
          fill="url(#axion-wave-front)"
          stroke={color}
          strokeOpacity="0.08"
          strokeWidth="1"
          animate={{ d: WAVE_PATHS.front }}
          transition={{ duration: 10, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
        />
      </svg>

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(2,3,7,0.08)_16%,rgba(2,3,7,0.52)_68%,rgba(2,3,7,0.96)_115%)]" />
    </motion.div>
  );
}
