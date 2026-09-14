import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { appendAivaMessage, type AivaConversation } from "../../lib/aivaConversation";
import type { BrainAvailability, DesktopStatus } from "../../lib/aivaCapabilities";
import { MAC_MUTATIONS } from "../../lib/aivaCapabilities";
import { normalizeAivaBrain, type AivaBrainId } from "../../lib/aivaBrain";
import { DEFAULT_AIVA_VOICE, normalizeRealtimeVoice, type AivaRealtimeVoice } from "../../lib/aivaRealtimeVoice";
import type { AivaSection, AivaToolCall, AivaToolResult } from "../../lib/aivaTools";
import { executeAivaToolCall, type AivaActionHost } from "./aivaActionRegistry";
import { mapRealtimeStatusToVisualState, shouldRestartRealtimeSession } from "./aivaRealtimeCore";
import { useAivaRealtimeVoice } from "./useAivaRealtimeVoice";
import { useAivaVisualState } from "./useAivaVisualState";
import { useAivaWakeWord, type AivaWakeWordStatus } from "./useAivaWakeWord";

const AIVA_VOICE_STORAGE_KEY = "axion_aiva_voice_v2";
const AIVA_VOICE_OPT_IN_KEY = "axion_aiva_voice_opt_in";
const readVoice = (): AivaRealtimeVoice => { try { return normalizeRealtimeVoice(localStorage.getItem(AIVA_VOICE_STORAGE_KEY)); } catch { return DEFAULT_AIVA_VOICE; } };
const readBrain = (): AivaBrainId => { try { return normalizeAivaBrain(localStorage.getItem("axion_aiva_brain")); } catch { return "mark-i"; } };

interface AivaSessionValue {
  state: ReturnType<typeof useAivaVisualState>["state"];
  userMessage: string;
  response: string;
  notice: string;
  configured: boolean | null;
  muted: boolean;
  voice: AivaRealtimeVoice;
  brain: AivaBrainId;
  brains: BrainAvailability[];
  desktop: DesktopStatus;
  switching: boolean;
  executing: boolean;
  pairDesktop: (code: string) => Promise<void>;
  revokeDesktop: () => Promise<void>;
  refreshDesktop: () => Promise<void>;
  realtimeStatus: ReturnType<typeof useAivaRealtimeVoice>["status"];
  wakeWordStatus: AivaWakeWordStatus;
  setMuted: (muted: boolean) => void;
  setVoice: (voice: AivaRealtimeVoice) => void;
  setBrain: (brain: AivaBrainId) => void;
  setCurrentSection: (section: AivaSection) => void;
  toggleHandsFree: () => void;
  useManualVoice: () => void;
  submitText: (message: string) => void;
  stop: () => void;
  newSession: () => void;
  registerNavigation: (navigate: (section: AivaSection) => void, openClient: (query: string) => void, openDocument: (query: string) => void, openMeeting: (meetingId: string) => void) => () => void;
}

const AivaSessionContext = createContext<AivaSessionValue | null>(null);

export function AivaSessionProvider({ children }: { children: ReactNode }) {
  const [muted, setMuted] = useState(false);
  const [voice, setVoiceState] = useState<AivaRealtimeVoice>(readVoice);
  const [voiceOptIn, setVoiceOptIn] = useState(() => { try { return localStorage.getItem(AIVA_VOICE_OPT_IN_KEY) === "1"; } catch { return false; } });
  const [brain, setBrainState] = useState<AivaBrainId>(readBrain);
  const [brains, setBrains] = useState<BrainAvailability[]>([]);
  const [desktop, setDesktop] = useState<DesktopStatus>({ connected: false, capabilities: [] });
  const [switching, setSwitching] = useState(false);
  const [brainNotice, setBrainNotice] = useState("");
  const [queuedBrain, setQueuedBrain] = useState<AivaBrainId | null>(null);
  const conversation = useRef<AivaConversation>({ id: crypto.randomUUID(), messages: [] });
  const [currentSection, setCurrentSection] = useState<AivaSection>("overview");
  const [realtimeUserMessage, setRealtimeUserMessage] = useState("");
  const [realtimeResponse, setRealtimeResponse] = useState("");
  const navigation = useRef<Pick<AivaActionHost, "navigate" | "openClient" | "openDocument" | "openMeeting">>({ navigate: () => undefined });
  const runtime = useRef<{ setHandsFree: (enabled: boolean) => Promise<void>; setBrain: (brain: AivaBrainId) => Promise<void>; consultBrain: (query: string) => Promise<string | undefined>; brain: AivaBrainId }>({ setHandsFree: async () => undefined, setBrain: async () => undefined, consultBrain: async () => undefined, brain: "mark-i" });
  const refreshCapabilities = useCallback(async () => {
    try {
      const response = await fetch("/api/aiva/capabilities");
      if (!response.ok) throw new Error();
      const data = await response.json();
      setBrains(data.brains); setDesktop(data.desktop);
    } catch { setDesktop({ connected: false, capabilities: [], reason: "Não foi possível verificar a ligação." }); }
  }, []);
  useEffect(() => { void refreshCapabilities(); const timer = window.setInterval(() => void refreshCapabilities(), 30000); return () => clearInterval(timer); }, [refreshCapabilities]);
  const pairDesktop = useCallback(async (code: string) => {
    const response = await fetch("/api/aiva/desktop/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    await refreshCapabilities();
  }, [refreshCapabilities]);
  const revokeDesktop = useCallback(async () => {
    const response = await fetch("/api/aiva/desktop/revoke", { method: "POST" });
    if (!response.ok) throw new Error("Não foi possível revogar a ligação.");
    await refreshCapabilities();
  }, [refreshCapabilities]);

  const executeTool = useCallback(async (call: AivaToolCall, signal?: AbortSignal) => {
    if (signal?.aborted) return { callId: call.id, ok: false, output: { cancelled: true } };
    const result = await executeAivaToolCall(call, {
      ...navigation.current,
      setHandsFree: runtime.current.setHandsFree,
      setBrain: runtime.current.setBrain,
      brain: runtime.current.brain,
      consultBrain: runtime.current.consultBrain,
      fetch: (url, init) => fetch(url, { ...init, signal }),
    });
    if (!MAC_MUTATIONS.has(call.name) && !["navigate_to_section", "open_client", "open_document", "open_meeting", "set_aiva_brain", "set_hands_free"].includes(call.name)) return result;
    if (MAC_MUTATIONS.has(call.name)) return result; // Audited by the authenticated device API.
    let audited = false;
    for (let attempt = 0; attempt < 3 && !audited; attempt += 1) {
      try {
        const response = await fetch("/api/aiva/audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tool: call.name, ok: result.ok }) });
        audited = response.ok;
      } catch { /* repetido abaixo */ }
    }
    return audited ? result : { ...result, output: { ...result.output, auditWarning: "A ação foi executada, mas o registo de auditoria falhou." } };
  }, []);
  const executeTools = useCallback(async (calls: AivaToolCall[], signal?: AbortSignal): Promise<AivaToolResult[]> => {
    const results: AivaToolResult[] = [];
    for (const call of calls) { if (signal?.aborted) break; results.push(await executeTool(call, signal)); }
    return results;
  }, [executeTool]);

  const manual = useAivaVisualState({ muted, voice, conversation, brain, context: currentSection, onToolCalls: executeTools });
  const realtime = useAivaRealtimeVoice({
    voice,
    muted,
    onUserTranscript: setRealtimeUserMessage,
    onAssistantTranscript: setRealtimeResponse,
    onToolCall: executeTool,
    onStopPhrase: manual.stop,
    brain,
    context: currentSection,
    conversation,
    onTurnComplete: (role, text) => appendAivaMessage(conversation.current, role, text),
  });
  const realtimeEngaged = realtime.status !== "off";

  const applyBrain = useCallback(async (next: AivaBrainId) => {
    if (next === brain) return;
    if (!brains.find(item => item.id === next)?.available) throw new Error("Este cérebro está indisponível nesta conta.");
    setSwitching(true); setBrainNotice("");
    try {
      await realtime.updateConfiguration(next, currentSection);
      setBrainState(next);
      try { localStorage.setItem("axion_aiva_brain", next); } catch { /* mantém a sessão */ }
    } finally { setSwitching(false); }
  }, [brain, brains, currentSection, realtime.updateConfiguration]);
  const busy = realtime.executing || ["thinking", "speaking", "connecting"].includes(realtime.status) || ["thinking", "speaking"].includes(manual.state);
  const setBrain = useCallback((next: AivaBrainId) => {
    if (busy) { setQueuedBrain(next); setBrainNotice("Troca de cérebro após concluir esta operação."); return; }
    void applyBrain(next).catch(error => setBrainNotice(error.message));
  }, [applyBrain, busy]);
  useEffect(() => { if (queuedBrain && !busy && !switching) { setQueuedBrain(null); void applyBrain(queuedBrain).catch(error => setBrainNotice(error.message)); } }, [queuedBrain, busy, switching, applyBrain]);
  const contextVersion = `${currentSection}:${desktop.connected}:${desktop.capabilities.join(",")}`;
  const appliedContext = useRef("");
  useEffect(() => {
    if (realtime.active && !busy && appliedContext.current !== contextVersion) {
      appliedContext.current = contextVersion;
      void realtime.updateConfiguration(brain, currentSection).catch(() => { appliedContext.current = ""; });
    }
  }, [contextVersion, busy, realtime.active, brain, currentSection, realtime.updateConfiguration]);

  const setHandsFree = useCallback(async (enabled: boolean) => {
    if (enabled && !realtime.active) {
      manual.stop();
      setRealtimeUserMessage("");
      setRealtimeResponse("");
      const started = await realtime.start();
      if (!started) throw new Error("Não foi possível ligar o modo Hands Free.");
      setVoiceOptIn(true);
      try { localStorage.setItem(AIVA_VOICE_OPT_IN_KEY, "1"); } catch { /* mantém a sessão */ }
    } else if (!enabled && realtimeEngaged) { realtime.stop(); manual.stop(); }
  }, [manual, realtime, realtimeEngaged]);
  runtime.current = { setHandsFree, setBrain: applyBrain, consultBrain: query => manual.runInteraction(query, false), brain };

  const wakeAiva = useCallback(() => {
    if (realtimeEngaged || manual.state === "listening") return;
    manual.stop();
    setRealtimeUserMessage("Olá AIVA");
    setRealtimeResponse("");
    void realtime.start(voice, brain, "Olá AIVA");
  }, [brain, manual, realtime, realtimeEngaged, voice]);
  const wakeWordStatus = useAivaWakeWord({ enabled: voiceOptIn, paused: realtimeEngaged || manual.state === "listening", onWake: wakeAiva });

  const setVoice = useCallback((next: AivaRealtimeVoice) => {
    const restart = shouldRestartRealtimeSession({ active: realtime.active, previousVoice: voice, nextVoice: next });
    setVoiceState(next);
    try { localStorage.setItem(AIVA_VOICE_STORAGE_KEY, next); } catch { /* sessão atual mantém o valor */ }
    if (restart) void realtime.start(next);
  }, [realtime, voice]);

  const registerNavigation = useCallback((navigate: (section: AivaSection) => void, openClient: (query: string) => void, openDocument: (query: string) => void, openMeeting: (meetingId: string) => void) => {
    navigation.current = { navigate, openClient, openDocument, openMeeting };
    return () => { navigation.current = { navigate: () => undefined }; };
  }, []);

  const value = useMemo<AivaSessionValue>(() => ({
    state: realtimeEngaged ? mapRealtimeStatusToVisualState(realtime.status) : manual.state,
    userMessage: realtimeEngaged ? realtimeUserMessage : manual.userMessage,
    response: realtimeEngaged ? realtimeResponse : manual.response,
    notice: brainNotice || (realtime.executing ? "A executar" : realtimeEngaged ? realtime.notice : manual.notice),
    configured: manual.configured,
    muted,
    voice,
    brain,
    brains, desktop, switching, executing: realtime.executing || manual.notice.startsWith("A executar"), pairDesktop, revokeDesktop, refreshDesktop: refreshCapabilities,
    realtimeStatus: realtime.status,
    wakeWordStatus,
    setMuted,
    setVoice,
    setBrain,
    setCurrentSection,
    toggleHandsFree: () => void setHandsFree(!realtimeEngaged).catch(() => undefined),
    useManualVoice: () => { realtime.stop(); manual.toggleListening(); },
    submitText: (message) => { realtime.stop(); void manual.runInteraction(message); },
    stop: () => { realtime.stop(); manual.stop(); },
    newSession: () => { realtime.stop(); manual.newSession(); setRealtimeUserMessage(""); setRealtimeResponse(""); },
    registerNavigation,
  }), [brain, brains, desktop, switching, pairDesktop, revokeDesktop, refreshCapabilities, brainNotice, manual, muted, realtime, realtimeEngaged, realtimeResponse, realtimeUserMessage, registerNavigation, setBrain, setHandsFree, setVoice, voice, wakeWordStatus]);

  return <AivaSessionContext.Provider value={value}>{children}</AivaSessionContext.Provider>;
}

export function useAivaSession() {
  const value = useContext(AivaSessionContext);
  if (!value) throw new Error("useAivaSession requer AivaSessionProvider");
  return value;
}
