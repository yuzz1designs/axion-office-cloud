import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { consumeDesktopOAuthHandoff, getSupabaseBrowserClient, type SupabasePublicConfig } from "../../lib/supabaseBrowser";

interface AxionLoginScreenProps {
  config: SupabasePublicConfig;
  desktop?: boolean;
  onAuthenticated?: () => void;
}

export default function AxionLoginScreen({ config, desktop = false, onAuthenticated }: AxionLoginScreenProps) {
  const [handoffState, setHandoffState] = useState(() => sessionStorage.getItem("axion_desktop_auth_state") || "");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!desktop || !handoffState) return;
    let stopped = false;
    let timer = 0;
    const poll = async () => {
      try {
        const complete = await consumeDesktopOAuthHandoff(config, handoffState);
        if (complete) {
          sessionStorage.removeItem("axion_desktop_auth_state");
          if (!stopped) onAuthenticated?.();
          return;
        }
      } catch (error) {
        sessionStorage.removeItem("axion_desktop_auth_state");
        if (!stopped) {
          setHandoffState("");
          setNotice(error instanceof Error ? error.message : "Não foi possível concluir o login.");
        }
        return;
      }
      if (!stopped) timer = window.setTimeout(() => void poll(), 700);
    };
    void poll();
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [config, desktop, handoffState, onAuthenticated]);

  const signIn = async () => {
    const client = getSupabaseBrowserClient(config);
    if (!client) return;
    setNotice("");
    let state = "";
    if (desktop) {
      const start = await fetch("/api/auth/desktop/start", { method: "POST" });
      const body = await start.json() as { state?: string; error?: string };
      if (!start.ok || !body.state) return setNotice(body.error || "Não foi possível iniciar o login desktop.");
      state = body.state;
      sessionStorage.setItem("axion_desktop_auth_state", state);
      setHandoffState(state);
    }
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        scopes: "openid email profile",
        queryParams: { prompt: "select_account" },
        skipBrowserRedirect: desktop,
      },
    });
    if (error) {
      sessionStorage.removeItem("axion_desktop_auth_state");
      setHandoffState("");
      return setNotice(error.message);
    }
    if (desktop && data.url) window.location.assign(data.url);
  };

  return (
    <div className="w-full h-full bg-[#050609] text-white flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.10),transparent_42%)]" />
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md border border-white/10 bg-[#0a0d14]/90 rounded-3xl p-8 shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-7">
          <ShieldCheck size={22} className="text-emerald-400" />
        </div>
        <p className="text-[10px] font-mono tracking-[0.28em] text-white/35 uppercase mb-2">AXION OFFICE · Acesso privado</p>
        <h1 className="text-3xl font-semibold tracking-tight">Entrar no workspace</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/45">Utiliza uma das contas Google autorizadas pela direção AXION.</p>
        <button disabled={Boolean(handoffState)} onClick={signIn} className="mt-8 w-full h-12 bg-white text-black hover:bg-white/90 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:cursor-wait disabled:opacity-70">
          <KeyRound size={16} /> {handoffState ? "A aguardar pelo Google…" : "Continuar com Google"}
        </button>
        {notice && <p className="mt-4 text-center text-xs text-rose-300">{notice}</p>}
        <p className="mt-5 text-[10px] font-mono text-center text-white/25">ACESSO REGISTADO · DISPOSITIVO RECONHECIDO</p>
      </motion.div>
    </div>
  );
}
