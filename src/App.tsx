/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import WelcomeScreen from "./components/welcome/WelcomeScreen";
import CommandCenter from "./components/command/CommandCenter";
import { AppearanceSettings, CommandCenterConfig, LanguageRegionSettings } from "./types/settings";
import { ACCENT_COLOR_OPTIONS, DEFAULT_APPEARANCE, DEFAULT_COMMAND_CENTER, DEFAULT_LANGUAGE_REGION } from "./data/settingsMockData";
import { LanguageProvider } from "./i18n/LanguageContext";
import type { AxionProfile } from "./types/profile";
import AxionLoginScreen from "./components/auth/AxionLoginScreen";
import { bridgeSupabaseSession, completeDesktopOAuthHandoff, getDesktopOAuthReturnState, hasSupabaseOAuthReturn, isAxionDesktop, shouldEnterAfterOAuth, signOutAxionSession, subscribeAxionRealtime, subscribeSupabaseSession, type SupabasePublicConfig } from "./lib/supabaseBrowser";
import { normalizeAppearanceSettings } from "./lib/appearance";
import { sanitizeCommandCenterConfig, sanitizeLanguageRegionSettings } from "./components/settings/settingsCore";
import { AivaSessionProvider } from "./components/aiva/AivaSessionProvider";
import { AIVA_ENABLED } from "./lib/features";

interface AuthStatus {
  authConfigured?: boolean;
  authRequired?: boolean;
  hasProfile: boolean;
  profile?: AxionProfile | null;
  profileRequired: boolean;
  currentDeviceId?: string;
}

const INITIAL_QUOTES_GMAIL_RETURN = new URLSearchParams(window.location.search).get("quotes-gmail");

export default function App() {
  const reducedMotion = useReducedMotion();
  const quotesGmailReturn = INITIAL_QUOTES_GMAIL_RETURN;
  const [enteringOffice, setEnteringOffice] = useState(false);
  const desktop = isAxionDesktop(window.location.href);
  const initialDesktopOAuthReturn = getDesktopOAuthReturnState(window.location.href);
  const initialOAuthReturn = hasSupabaseOAuthReturn(window.location.href);
  const [desktopOAuthReturn, setDesktopOAuthReturn] = useState(initialDesktopOAuthReturn);
  const [oauthBootstrap, setOauthBootstrap] = useState(initialOAuthReturn);
  const bootstrapStarted = useRef(false);
  const [screen, setScreen] = useState<"welcome" | "command-center">("welcome");
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [supabaseConfig, setSupabaseConfig] = useState<SupabasePublicConfig>({ configured: false });
  const [desktopReturnStatus, setDesktopReturnStatus] = useState<"working" | "complete" | "error">("working");
  const [bootstrapError, setBootstrapError] = useState("");

  // Global Appearance State initialized from LocalStorage or Defaults
  const [appearance, setAppearance] = useState<AppearanceSettings>(() => {
    try {
      const cached = localStorage.getItem("axion_office_appearance");
      if (cached) {
        return normalizeAppearanceSettings(JSON.parse(cached));
      }
    } catch (e) {
      // Storage unavailable fallback
    }
    return DEFAULT_APPEARANCE;
  });

  const isLight = false;
  const activeAccent = ACCENT_COLOR_OPTIONS.find((option) => option.id === appearance.accentColor) ?? ACCENT_COLOR_OPTIONS[0];

  const [commandCenterConfig, setCommandCenterConfig] = useState<CommandCenterConfig>(() => {
    try {
      const cached = localStorage.getItem("axion_office_command");
      if (cached) return sanitizeCommandCenterConfig(JSON.parse(cached));
    } catch (e) {
      // Storage unavailable fallback
    }
    return sanitizeCommandCenterConfig(DEFAULT_COMMAND_CENTER);
  });
  const [languageRegion, setLanguageRegion] = useState<LanguageRegionSettings>(() => {
    try {
      const cached = localStorage.getItem("axion_office_language");
      if (cached) return sanitizeLanguageRegionSettings(JSON.parse(cached));
    } catch (e) {
      // Storage unavailable fallback
    }
    return sanitizeLanguageRegionSettings(DEFAULT_LANGUAGE_REGION);
  });
  const [isLanguageTransitioning, setIsLanguageTransitioning] = useState(false);

  // Sync data-theme attribute with document body and root element
  useEffect(() => {
    const themeValue = isLight ? "light" : "dark";
    document.body.setAttribute("data-theme", themeValue);
    if (isLight) {
      document.documentElement.classList.add("theme-light");
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.remove("theme-light");
      document.documentElement.classList.add("dark");
    }
  }, [isLight]);

  useEffect(() => {
    document.documentElement.lang = languageRegion.language === "pt" ? "pt-PT" : "en-US";
  }, [languageRegion.language]);

  const refreshAuthStatus = async () => {
    const response = await fetch("/api/profile/status");
    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("AXION_API_UNAVAILABLE");
    setAuthStatus(await response.json());
  };

  useEffect(() => {
    if (bootstrapStarted.current) return;
    bootstrapStarted.current = true;
    const bootstrap = async () => {
      try {
        const oauthReturn = hasSupabaseOAuthReturn(window.location.href);
        const configResponse = await fetch("/api/auth/config");
        if (!configResponse.ok || !configResponse.headers.get("content-type")?.includes("application/json")) throw new Error("AXION_API_UNAVAILABLE");
        const config = await configResponse.json() as SupabasePublicConfig;
        setSupabaseConfig(config);
        let handoffState = desktopOAuthReturn;
        if (!desktop && oauthReturn && !handoffState) {
          const pendingResponse = await fetch("/api/auth/desktop/pending");
          const pending = await pendingResponse.json() as { state?: string | null };
          handoffState = pending.state || null;
          if (handoffState) setDesktopOAuthReturn(handoffState);
        }
        if (handoffState) {
          const complete = config.configured && await completeDesktopOAuthHandoff(config, window.location.href, handoffState);
          setDesktopReturnStatus(complete ? "complete" : "error");
          if (complete) window.setTimeout(() => window.location.assign(`axion-office://auth/callback?state=${encodeURIComponent(handoffState)}`), 100);
          return;
        }
        const sessionBridged = config.configured ? await bridgeSupabaseSession(config) : false;
        await refreshAuthStatus();
        if (quotesGmailReturn || shouldEnterAfterOAuth(oauthReturn, sessionBridged)) {
          setScreen("command-center");
          if (!quotesGmailReturn) window.history.replaceState({}, document.title, window.location.pathname);
        }
        setOauthBootstrap(false);
      } catch (error) {
        setOauthBootstrap(false);
        setBootstrapError(error instanceof Error && error.message === "AXION_API_UNAVAILABLE"
          ? "O servidor do AXION OFFICE não está disponível nesta publicação."
          : "Não foi possível iniciar o AXION OFFICE.");
      }
    };
    void bootstrap();
  }, []);

  useEffect(() => {
    if (!supabaseConfig.configured) return;
    const stopSession = subscribeSupabaseSession(supabaseConfig, () => void refreshAuthStatus());
    const stopRealtime = subscribeAxionRealtime(supabaseConfig, (table) => {
      if (table === "profiles") void refreshAuthStatus();
      window.dispatchEvent(new CustomEvent("axion:realtime", { detail: { table } }));
    });
    return () => { stopSession(); stopRealtime(); };
  }, [supabaseConfig.configured, supabaseConfig.url, supabaseConfig.publishableKey]);

  const handleAppearanceChange = (updated: AppearanceSettings) => {
    setAppearance(updated);
    try {
      localStorage.setItem("axion_office_appearance", JSON.stringify(updated));
    } catch (e) {}
  };

  const handleLanguageRegionChange = (updated: LanguageRegionSettings) => {
    if (updated.language !== languageRegion.language) {
      setIsLanguageTransitioning(true);
      window.setTimeout(() => setIsLanguageTransitioning(false), 520);
    }
    setLanguageRegion(updated);
    try {
      localStorage.setItem("axion_office_language", JSON.stringify(updated));
    } catch (e) {}
  };

  const handleSignOut = async () => {
    await signOutAxionSession(supabaseConfig);
    setAuthStatus({ authConfigured: supabaseConfig.configured, authRequired: supabaseConfig.configured, hasProfile: false, profile: null, profileRequired: true });
    setScreen("welcome");
  };

  return (
    <LanguageProvider language={languageRegion.language}>
    <div 
      id="axion-office-application-root" 
      data-theme={isLight ? "light" : "dark"}
      style={{
        "--axion-accent": activeAccent.hex,
        "--axion-accent-secondary": activeAccent.secondary,
        "--axion-accent-glow": activeAccent.glow,
        "--axion-accent-hover": `color-mix(in srgb, ${activeAccent.hex} 82%, white)`,
      } as CSSProperties}
      className={`relative w-screen h-screen overflow-hidden select-none transition-colors duration-500 ${
        isLight ? "bg-[#ffffff] text-slate-900 theme-light" : "bg-[#050609] text-white"
      }`}
    >
      <AnimatePresence>
        {isLanguageTransitioning && (
          <motion.div
            key={`language-transition-${languageRegion.language}`}
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: [0, 1, 0], backdropFilter: ["blur(0px)", "blur(10px)", "blur(0px)"] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="fixed inset-0 z-[10000] pointer-events-none bg-[#050609]/20"
          />
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {bootstrapError ? (
          <motion.div key="bootstrap-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full flex items-center justify-center bg-[#050609] px-6">
            <div className="max-w-lg rounded-3xl border border-rose-400/20 bg-rose-400/[0.06] p-8 text-center">
              <p className="text-[10px] font-mono tracking-[0.28em] text-rose-200/60 uppercase">AXION OFFICE · Serviço indisponível</p>
              <h1 className="mt-3 text-2xl font-semibold">Dashboard temporariamente indisponível</h1>
              <p className="mt-3 text-sm leading-6 text-white/55">{bootstrapError} A publicação web precisa da API para autenticar utilizadores e carregar dados reais.</p>
              <button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-xl border border-white/15 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/5">Tentar novamente</button>
            </div>
          </motion.div>
        ) : desktopOAuthReturn || oauthBootstrap ? (
          <motion.div key="desktop-auth-return" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full flex items-center justify-center bg-[#050609] px-6">
            <div className="max-w-md text-center">
              <p className="text-[10px] font-mono tracking-[0.28em] text-white/35 uppercase">AXION OFFICE · Desktop</p>
              <h1 className="mt-3 text-2xl font-semibold">{desktopReturnStatus === "working" ? "A concluir o login…" : desktopReturnStatus === "complete" ? "Login concluído" : "Não foi possível concluir o login"}</h1>
              <p className="mt-3 text-sm text-white/45">{desktopReturnStatus === "complete" ? "A regressar à aplicação. Já podes fechar este separador." : desktopReturnStatus === "error" ? "Volta à aplicação e tenta novamente." : "A sessão está a ser transferida de forma segura para a aplicação."}</p>
            </div>
          </motion.div>
        ) : screen === "welcome" ? (
          <motion.div
            key="welcome"
            initial={{ opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.12, y: -35, filter: "blur(8px)" }}
            transition={{ duration: reducedMotion ? 0.15 : 0.55, ease: [0.76, 0, 0.24, 1] }}
            className="w-full h-full"
          >
            <WelcomeScreen onEnter={() => { setEnteringOffice(true); setScreen("command-center"); }} />
          </motion.div>
        ) : authStatus?.authRequired ? (
          <motion.div key="axion-login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
            <AxionLoginScreen config={supabaseConfig} desktop={desktop} onAuthenticated={() => void refreshAuthStatus()} />
          </motion.div>
        ) : (
          <motion.div
            key="command-center"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.965, y: 28, filter: "blur(6px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.15 : 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-full"
          >
            {AIVA_ENABLED ? <AivaSessionProvider><CommandCenter
              initialTab={quotesGmailReturn ? "quotes" : undefined}
              appearance={appearance}
              onAppearanceChange={handleAppearanceChange}
              commandCenterConfig={commandCenterConfig}
              onCommandCenterConfigChange={setCommandCenterConfig}
              languageRegion={languageRegion}
              onLanguageRegionChange={handleLanguageRegionChange}
              profile={authStatus?.profile ?? null}
              profileRequired={authStatus?.profileRequired ?? false}
              currentDeviceId={authStatus?.currentDeviceId}
              onProfileSaved={(profile, currentDeviceId) => setAuthStatus({ hasProfile: true, profile, profileRequired: false, currentDeviceId })}
              onBackToWelcome={() => void handleSignOut()}
              aivaEnabled
            /></AivaSessionProvider> : <CommandCenter
              initialTab={quotesGmailReturn ? "quotes" : undefined}
              appearance={appearance}
              onAppearanceChange={handleAppearanceChange}
              commandCenterConfig={commandCenterConfig}
              onCommandCenterConfigChange={setCommandCenterConfig}
              languageRegion={languageRegion}
              onLanguageRegionChange={handleLanguageRegionChange}
              profile={authStatus?.profile ?? null}
              profileRequired={authStatus?.profileRequired ?? false}
              currentDeviceId={authStatus?.currentDeviceId}
              onProfileSaved={(profile, currentDeviceId) => setAuthStatus({ hasProfile: true, profile, profileRequired: false, currentDeviceId })}
              onBackToWelcome={() => void handleSignOut()}
              aivaEnabled={false}
            />}
          </motion.div>
        )}
      </AnimatePresence>
      {enteringOffice && <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[100] overflow-hidden"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: reducedMotion ? 0 : 0.8, duration: reducedMotion ? 0.15 : 0.45 }}
        onAnimationComplete={() => setEnteringOffice(false)}
      >
        {!reducedMotion && <>
          <motion.div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 48%, ${activeAccent.hex}24, transparent 65%)` }} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: [0, 1, 0], scale: [0.5, 1.1, 1.6] }} transition={{ duration: 1.2, times: [0, 0.4, 1] }} />
          {[0, 1, 2].map((index) => <motion.div key={index}
            className="absolute left-1/2 top-1/2 rounded-full border"
            style={{ width: "70vmax", height: "70vmax", marginLeft: "-35vmax", marginTop: "-35vmax", borderColor: `${activeAccent.hex}${index === 0 ? "65" : "25"}` }}
            initial={{ scale: 0.04, opacity: 0 }}
            animate={{ scale: 2.2, opacity: [0, 0.7, 0] }}
            transition={{ duration: 1.05, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
          />)}
        </>}
      </motion.div>}
    </div>
    </LanguageProvider>
  );
}
