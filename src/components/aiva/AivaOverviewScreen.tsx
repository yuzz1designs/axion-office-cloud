import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import { AIVA_BRAINS, type AivaBrainId } from "../../lib/aivaBrain";
import type { AccentColorOption } from "../../types/settings";
import AivaEntity from "./AivaEntity";
import AivaInteractionBar from "./AivaInteractionBar";
import { getAivaStatePresets } from "./aivaStatePresets";
import { useAivaSession } from "./AivaSessionProvider";
import { useAudioSimulation } from "./useAudioSimulation";
import { useReducedMotion } from "./useReducedMotion";
import "./aiva.css";
import AivaDevicePanel from "./AivaDevicePanel";
import AivaResponseText from "./AivaResponseText";

interface Props { accentColor?: AccentColorOption; onBackToOverview?: () => void; }
const DEFAULT_ACCENT: AccentColorOption = { id: "axion-blue", name: "AXION Blue", hex: "#00f0ff", secondary: "#0284c7", glow: "rgba(0, 240, 255, 0.4)" };

export default function AivaOverviewScreen({ accentColor = DEFAULT_ACCENT, onBackToOverview }: Props) {
  const session = useAivaSession();
  const { state, userMessage, response, notice, muted, voice, brain } = session;
  const reducedMotion = useReducedMotion();
  const audioLevel = useAudioSimulation(muted ? "idle" : state);
  const presets = useMemo(() => getAivaStatePresets(accentColor.hex), [accentColor.hex]);
  const preset = presets[state];

  return (
    <section data-brain={brain} data-switching={session.switching} className="aiva-screen relative isolate flex min-h-[720px] w-full flex-col overflow-hidden rounded-[28px] border border-white/[0.055] bg-[#03050a] text-white md:h-full md:min-h-[650px]" aria-labelledby="aiva-title">
      <div className="aiva-atmosphere absolute inset-0" aria-hidden="true" />
      <div className="aiva-grid absolute inset-x-0 bottom-0 h-[44%]" aria-hidden="true" />
      <header className="relative z-20 flex items-start justify-between px-5 pt-5 md:px-8 md:pt-7">
        <div className="flex items-center gap-3">
          {onBackToOverview && <button type="button" onClick={onBackToOverview} className="aiva-secondary-control" aria-label="Voltar ao painel"><ChevronLeft size={17} /></button>}
          <div>
            <h1 id="aiva-title" className="font-display text-sm font-semibold tracking-[0.32em] text-white md:text-base">AIVA</h1>
            <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.24em] text-white/30">AXION Intelligent Virtual Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="aiva-brain-switch" aria-label="Cérebro AIVA">
            {(Object.keys(AIVA_BRAINS) as AivaBrainId[]).map((id) => { const availability = session.brains.find(item => item.id === id); return <button key={id} type="button" aria-pressed={brain === id} disabled={session.switching || !availability?.available} title={availability?.reason || AIVA_BRAINS[id].description} onClick={() => session.setBrain(id)} className={brain === id ? "is-active" : ""}>{AIVA_BRAINS[id].label}{id === "mark-ii" && <span>{availability?.available ? "ASTRA" : availability ? "indisponível" : "a verificar"}</span>}</button>; })}
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-black/20 px-3 py-1.5 backdrop-blur-md" role="status" aria-live="polite">
          <span className={`aiva-status-dot ${state}`} style={{ backgroundColor: preset.color, boxShadow: `0 0 10px ${preset.color}` }} />
          <span className="font-mono text-[9px] tracking-[0.18em] text-white/55">{session.switching ? "A ALTERAR CORE" : session.executing ? "A EXECUTAR" : preset.label}</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 grid min-h-0 flex-1 grid-rows-[minmax(270px,1fr)_auto] items-center px-4 pb-5 pt-1 md:grid-rows-[minmax(300px,1fr)_auto] md:px-8 md:pb-7">
        <div className="relative mx-auto h-full w-full max-w-5xl">
          <AivaEntity state={state} brain={brain} executing={session.executing} accentColor={accentColor.hex} audioLevel={audioLevel} reducedMotion={reducedMotion} />
          <div className="aiva-core-caption" style={{ color: accentColor.hex }}>{brain === "mark-ii" ? "CORE II · ASTRA" : "CORE I"}</div>
        </div>
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 text-center">
          <AnimatePresence mode="wait">
            <motion.div key={response ? "response" : "prompt"} initial={{ opacity: 0, y: reducedMotion ? 0 : 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reducedMotion ? 0 : -5 }} transition={{ duration: reducedMotion ? 0.01 : 0.3 }} className="min-h-[70px]">
              {response ? <div className="mx-auto max-w-2xl">{userMessage && <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-white/30">{userMessage}</p>}<p className="max-h-44 overflow-y-auto whitespace-pre-wrap break-words text-sm font-light leading-relaxed tracking-[0.01em] text-white/75 md:text-[15px]"><AivaResponseText text={response} /></p>{notice && <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.18em]" style={{ color: preset.color }}>{notice}</p>}</div> : <div><h2 className="text-xl font-medium tracking-tight text-white/95 md:text-2xl">Como posso ajudar?</h2><p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: `${preset.color}a8` }}>{notice || preset.description}</p></div>}
            </motion.div>
          </AnimatePresence>
          <AivaInteractionBar state={state} accentColor={preset.color} muted={muted} onMutedChange={session.setMuted} onSubmit={session.submitText} onVoice={session.useManualVoice} onStop={session.stop} onNewSession={session.newSession} handsFreeStatus={session.realtimeStatus} onHandsFree={session.toggleHandsFree} voice={voice} onVoiceChange={session.setVoice} />
        </div>
      </main>

      <footer className="relative z-20 flex items-center border-t border-white/[0.045] px-5 py-3 md:px-8">
        <AivaDevicePanel />
        <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.2em] text-white/25"><ShieldCheck size={12} /><span>{session.configured === null ? "A verificar núcleo seguro" : session.configured ? `AIVA ligada · ${AIVA_BRAINS[brain].label} · ${session.wakeWordStatus === "listening" ? "Olá AIVA ativo" : session.wakeWordStatus === "blocked" ? "Wake word sem permissão" : session.wakeWordStatus === "unsupported" ? "Wake word indisponível" : "Realtime pronto"} · ${voice}` : "Núcleo local · falta configurar API key"}</span></div>
      </footer>
    </section>
  );
}
