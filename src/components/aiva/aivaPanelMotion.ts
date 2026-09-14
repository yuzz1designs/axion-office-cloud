const SCI_FI_EASE = [0.16, 1, 0.3, 1] as const;

export function getAivaPanelTransition(reducedMotion: boolean) {
  if (reducedMotion) {
    return {
      panel: {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15 },
      },
      content: {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15 },
      },
      showScanEffects: false,
    };
  }

  return {
    panel: {
      initial: {
        clipPath: "inset(49.8% 3% 49.8% 3% round 2px)",
        opacity: 0.42,
        scaleX: 0.72,
        filter: "brightness(1.8) blur(2px)",
      },
      animate: {
        clipPath: [
          "inset(49.8% 3% 49.8% 3% round 2px)",
          "inset(8% 1% 8% 1% round 18px)",
          "inset(0% 0% 0% 0% round 28px)",
        ],
        opacity: [0.42, 1, 1],
        scaleX: [0.72, 1.012, 1],
        filter: ["brightness(1.8) blur(2px)", "brightness(1.22) blur(0px)", "brightness(1) blur(0px)"],
      },
      exit: {
        clipPath: "inset(49.8% 4% 49.8% 4% round 2px)",
        opacity: 0,
        scaleX: 0.78,
        filter: "brightness(1.6) blur(2px)",
      },
      transition: { duration: 0.9, times: [0, 0.58, 1], ease: SCI_FI_EASE },
    },
    content: {
      initial: { opacity: 0, y: 9, filter: "blur(5px)" },
      animate: { opacity: 1, y: 0, filter: "blur(0px)" },
      exit: { opacity: 0, y: -5, filter: "blur(3px)" },
      transition: { duration: 0.5, delay: 0.28, ease: SCI_FI_EASE },
    },
    showScanEffects: true,
  };
}
