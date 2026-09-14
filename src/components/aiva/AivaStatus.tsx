import React, { useState } from "react";
import { motion } from "motion/react";
import { Sparkles, Terminal, AudioLines, Power } from "lucide-react";

interface AivaStatusProps {
  statusText?: string;
  isOnline?: boolean;
  onOpenAiva?: () => void;
  isLight?: boolean;
}

export default function AivaStatus({ 
  statusText = "AIVA • ALL SYSTEMS OPERATIONAL", 
  isOnline = true,
  onOpenAiva,
  isLight = false
}: AivaStatusProps) {
  const [hovered, setHovered] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [aivaMessage, setAivaMessage] = useState<string | null>(null);

  // Micro-interaction: clicking Aiva triggers a sleek system-message simulation
  const handleAivaClick = () => {
    setClickCount(prev => prev + 1);
    const messages = [
      "AIVA: System calibration complete. Command Center is optimal.",
      "AIVA: I am ready to process voice queries in your next workflow step.",
      "AIVA: Ready to orchestrate Projects, CRM, and task telemetry.",
      "AIVA: Connection secure. Latency 14ms. AXION Cloud synced."
    ];
    const randomIndex = Math.floor(Math.random() * messages.length);
    setAivaMessage(messages[randomIndex]);
    
    // Clear message after 4s
    setTimeout(() => {
      setAivaMessage(null);
    }, 4000);
  };

  return (
    <div 
      className="relative flex flex-col items-end gap-2 text-right"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Dynamic Simulated AI speech bubble */}
      {aivaMessage && (
        <motion.div
          initial={{ opacity: 0, y: 10, filter: "blur(5px)", scale: 0.95 }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }}
          exit={{ opacity: 0, y: -10, filter: "blur(5px)" }}
          className={`px-4 py-2.5 rounded text-[10px] max-w-xs font-mono text-right leading-relaxed mb-1 shadow-md ${
            isLight
              ? "bg-white text-[var(--axion-accent-secondary)] border border-[var(--axion-accent)]/40"
              : "glass-panel-accent text-brand-accent/90 border-[var(--axion-accent)]/30"
          }`}
        >
          {aivaMessage}
        </motion.div>
      )}

      {/* Main trigger container */}
      <button
        onClick={handleAivaClick}
        className={`group flex items-center gap-4 px-4 py-2.5 rounded-sm transition-all duration-500 ease-out text-right cursor-pointer ${
          isLight
            ? "bg-white hover:bg-slate-50 border border-slate-200 hover:border-[var(--axion-accent)]/50 shadow-sm"
            : "bg-brand-bg/40 hover:bg-brand-bg/80 border border-white/5 hover:border-brand-accent/30"
        }`}
      >
        {/* Breathing system pulse */}
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-mono tracking-widest transition-colors duration-300 ${
              isLight ? "text-slate-500 group-hover:text-slate-900" : "text-white/40 group-hover:text-white/60"
            }`}>
              AIVA INTERNAL DAEMON
            </span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent/60 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent"></span>
            </span>
          </div>
          
          <div className={`font-mono text-[10px] transition-colors duration-500 ${
            isLight ? "text-slate-800 group-hover:text-[var(--axion-accent-secondary)]" : "text-white/70 group-hover:text-brand-accent"
          }`}>
            {statusText}
          </div>
        </div>

        {/* Neural Waveform/Equalizer Visualiser */}
        <div className="flex items-end gap-[2px] h-6 w-8 pb-[2px]">
          {[1, 2, 3, 4, 5, 6].map((bar) => {
            // Animate each bar at different speeds
            const heights = hovered 
              ? ["15%", "95%", "45%", "85%", "25%", "65%", "15%"]
              : ["20%", "40%", "25%", "60%", "15%", "35%", "20%"];
            const duration = hovered ? 0.6 + bar * 0.1 : 1.2 + bar * 0.2;

            return (
              <motion.span
                key={bar}
                animate={{
                  height: heights
                }}
                transition={{
                  duration: duration,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className={`w-[3px] rounded-full ${
                  hovered 
                    ? "bg-brand-accent" 
                    : isLight ? "bg-slate-400" : "bg-white/40"
                } transition-colors duration-300`}
                style={{ height: `${20 + bar * 10}%` }}
              />
            );
          })}
        </div>
      </button>

      {/* Subtle secondary helper tag */}
      <div className={`flex items-center gap-1.5 text-[8px] font-mono tracking-wider mr-2 select-none ${
        isLight ? "text-slate-400" : "text-white/20"
      }`}>
        <Terminal size={10} className={isLight ? "text-slate-400" : "text-white/30"} />
        <span>CLICK TO INITIALIZE TELEMETRY DIALOG</span>
      </div>
    </div>
  );
}
