import { ArrowUp, Mic, Radio, RotateCcw, Settings2, Square, Volume2, VolumeX } from "lucide-react";
import { FormEvent, useState } from "react";
import { AIVA_REALTIME_VOICES, type AivaRealtimeVoice } from "../../lib/aivaRealtimeVoice";
import type { AivaRealtimeStatus } from "./aivaRealtimeCore";
import type { AivaVisualState } from "./aivaVisual.types";

interface Props {
  state: AivaVisualState; accentColor: string; muted: boolean;
  onMutedChange: (muted: boolean) => void; onSubmit: (message: string) => void;
  onVoice: () => void; onStop: () => void; onNewSession: () => void;
  handsFreeStatus: AivaRealtimeStatus; onHandsFree: () => void;
  voice: AivaRealtimeVoice; onVoiceChange: (voice: AivaRealtimeVoice) => void;
}

function handsFreeCopy(status: AivaRealtimeStatus) {
  if (status === "connecting") return "A ligar canal Realtime";
  if (status === "listening") return "Hands Free · microfone ativo";
  if (status === "thinking") return "Hands Free · a processar";
  if (status === "speaking") return "Hands Free · AIVA a falar";
  if (status === "error") return "Hands Free indisponível · modo manual ativo";
  return "Voz sintética · microfone sob controlo";
}

export default function AivaInteractionBar({ state, accentColor, muted, onMutedChange, onSubmit, onVoice, onNewSession, handsFreeStatus, onHandsFree, voice, onVoiceChange }: Props) {
  const [message, setMessage] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const submit = (event: FormEvent) => { event.preventDefault(); if (!message.trim()) return; onSubmit(message); setMessage(""); };
  const active = state === "listening" || state === "speaking";
  const handsFreeActive = handsFreeStatus !== "off" && handsFreeStatus !== "error";
  return (
    <div className="flex w-full max-w-[680px] flex-col items-center gap-3">
      <form onSubmit={submit} className="aiva-input-shell flex w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] p-1.5 pl-5 backdrop-blur-xl transition-colors focus-within:border-white/25">
        <label htmlFor="aiva-message" className="sr-only">Perguntar à AIVA</label>
        <input id="aiva-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Perguntar à AIVA..." className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-white/30" />
        <button type="submit" disabled={!message.trim()} aria-label="Enviar mensagem" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#050609] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-25" style={{ backgroundColor: accentColor, boxShadow: message.trim() ? `0 0 22px ${accentColor}45` : "none" }}><ArrowUp size={17} strokeWidth={2.3} /></button>
      </form>
      <div className="flex flex-wrap justify-center items-center gap-2.5">
        <button type="button" onClick={onHandsFree} aria-pressed={handsFreeActive} className={`aiva-hands-free-control ${handsFreeActive ? "is-active" : ""}`} style={handsFreeActive ? { color: accentColor, borderColor: `${accentColor}75`, boxShadow: `0 0 24px ${accentColor}20` } : undefined}>
          <Radio size={14} />
          <span>Hands Free</span>
          <span className="aiva-hands-free-dot" style={handsFreeActive ? { backgroundColor: accentColor, boxShadow: `0 0 9px ${accentColor}` } : undefined} />
        </button>
        <button type="button" onClick={onVoice} aria-label={state === "listening" ? "Terminar e processar voz" : state === "speaking" ? "Interromper e falar" : "Falar com a AIVA"} className={`aiva-voice-control ${active ? "is-active" : ""}`} style={{ color: accentColor, borderColor: active ? `${accentColor}80` : undefined, boxShadow: active ? `0 0 30px ${accentColor}25` : undefined }}>{state === "speaking" ? <Square size={17} fill="currentColor" /> : <Mic size={19} />}</button>
        <button type="button" onClick={() => onMutedChange(!muted)} className="aiva-secondary-control" aria-label={muted ? "Ativar som" : "Silenciar AIVA"} title={muted ? "Ativar som" : "Silenciar"}>{muted ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
        <button type="button" onClick={onNewSession} className="aiva-secondary-control" aria-label="Nova sessão" title="Nova sessão"><RotateCcw size={15} /></button>
        <button type="button" onClick={() => setSettingsOpen((open) => !open)} className={`aiva-secondary-control ${settingsOpen ? "is-selected" : ""}`} aria-pressed={settingsOpen} aria-label="Definições da AIVA" title="Definições da AIVA" style={settingsOpen ? { color: accentColor, borderColor: `${accentColor}70` } : undefined}><Settings2 size={15} /></button>
      </div>
      {settingsOpen && (
        <div className="aiva-voice-settings" role="group" aria-label="Definições de voz da AIVA">
          <div>
            <span className="block font-mono text-[8px] uppercase tracking-[0.22em] text-white/35">Voz Realtime</span>
            <span className="mt-1 block text-[11px] text-white/55">Mudar a voz reinicia o canal Hands Free.</span>
          </div>
          <select value={voice} onChange={(event) => onVoiceChange(event.target.value as AivaRealtimeVoice)} className="aiva-voice-select" aria-label="Voz da AIVA">
            {AIVA_REALTIME_VOICES.map((option) => <option key={option} value={option}>{option[0].toUpperCase() + option.slice(1)}</option>)}
          </select>
        </div>
      )}
      <span className="min-h-4 text-center font-mono text-[9px] uppercase tracking-[0.22em] text-white/30">{handsFreeStatus !== "off" ? handsFreeCopy(handsFreeStatus) : state === "listening" ? "A ouvir · envio após 3 s de silêncio" : state === "speaking" ? "Toque para interromper e falar" : settingsOpen ? "Preferências de voz" : "Voz sintética · microfone sob controlo"}</span>
    </div>
  );
}
