/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  User, 
  Mail, 
  Phone, 
  ShieldCheck, 
  Smartphone, 
  Laptop, 
  Clock, 
  Check, 
  Sparkles, 
  Camera, 
  Copy, 
  Activity, 
  Briefcase, 
  ArrowLeft, 
  Fingerprint,
  Building,
  KeyRound,
  History,
  Shield,
  Layers,
  MapPin,
  ChevronRight
} from "lucide-react";
import { AccentColorOption } from "../../types/settings";
import type { AxionProfile } from "../../types/profile";

interface UserProfileScreenProps {
  accentColor?: AccentColorOption;
  onBackToOverview?: () => void;
  initialProfile?: AxionProfile | null;
  setupRequired?: boolean;
  currentDeviceId?: string;
  onProfileSaved?: (profile: AxionProfile, currentDeviceId?: string) => void;
}

type ProfileTab = "general" | "permissions" | "devices" | "activity";

interface UserProfileData {
  fullName: string;
  displayName: string;
  roleTitle: string;
  department: string;
  email: string;
  phone: string;
  deskLocation: string;
  timezone: string;
  bio: string;
  passkeyId: string;
  avatarUrl: string;
}

const EMPTY_PROFILE: UserProfileData = {
  fullName: "",
  displayName: "",
  roleTitle: "",
  department: "",
  email: "",
  phone: "",
  deskLocation: "",
  timezone: "Europe/Lisbon",
  bio: "",
  passkeyId: "",
  avatarUrl: ""
};

function toFormProfile(profile?: AxionProfile | null): UserProfileData {
  if (!profile) return EMPTY_PROFILE;
  return {
    fullName: profile.name || "",
    displayName: profile.displayName || "",
    roleTitle: profile.role || "",
    department: profile.department || "",
    email: profile.email || "",
    phone: profile.phone || "",
    deskLocation: profile.deskLocation || "",
    timezone: profile.timezone || "Europe/Lisbon",
    bio: profile.bio || "",
    passkeyId: profile.axKey || "",
    avatarUrl: profile.avatarUrl || "",
  };
}

const RECENT_ACTIVITIES = [
  { action: "Atualizou o ponto de ajuste de temperatura da Sala de Reunião para 21.5°C", time: "Hoje às 16:40", tag: "CLIMA & IOT" },
  { action: "Aprovou a publicação da nova versão do projeto Orion Alpha", time: "Hoje às 14:15", tag: "PROJETOS" },
  { action: "Ativou a credencial de convidado VIP para a reunião de investidores", time: "Hoje às 11:30", tag: "SEGURANÇA" },
  { action: "Sessão de Foco Profundo de 90 minutos concluída com sucesso", time: "Ontem às 18:00", tag: "PRODUTIVIDADE" },
  { action: "Sincronizou parâmetros de calibração neural com a AIVA", time: "Ontem às 15:20", tag: "AIVA INTEL" },
];

export default function UserProfileScreen({
  accentColor = {
    id: "axion-blue",
    name: "AXION Blue",
    hex: "#00f0ff",
    secondary: "#0284c7",
    glow: "rgba(0, 240, 255, 0.4)"
  },
  onBackToOverview,
  initialProfile,
  setupRequired = false,
  currentDeviceId,
  onProfileSaved,
}: UserProfileScreenProps) {
  const [profile, setProfile] = useState<UserProfileData>(() => toFormProfile(initialProfile));
  const [savedProfile, setSavedProfile] = useState<AxionProfile | null>(initialProfile ?? null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("general");
  const [copiedId, setCopiedId] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [googleWorkspace, setGoogleWorkspace] = useState<{ configured: boolean; connected: boolean; email?: string } | null>(null);
  const [googleConnectError, setGoogleConnectError] = useState("");
  const [discordUserId, setDiscordUserId] = useState("");
  const [discordDisplayName, setDiscordDisplayName] = useState("");
  const [discordLinked, setDiscordLinked] = useState(false);
  const [discordSaving, setDiscordSaving] = useState(false);
  const [discordFeedback, setDiscordFeedback] = useState("");

  useEffect(() => {
    setSavedProfile(initialProfile ?? null);
    setProfile(toFormProfile(initialProfile));
  }, [initialProfile]);

  useEffect(() => {
    if (!initialProfile?.id) return;
    fetch("/api/google/workspace/status")
      .then(async (response) => response.ok ? response.json() : null)
      .then((status) => setGoogleWorkspace(status))
      .catch(() => setGoogleWorkspace(null));
  }, [initialProfile?.id]);

  useEffect(() => {
    if (!initialProfile?.id) return;
    fetch("/api/profile/discord")
      .then(async (response) => response.ok ? response.json() : null)
      .then((result) => {
        const integration = result?.integration;
        setDiscordUserId(integration?.discordUserId || "");
        setDiscordDisplayName(integration?.displayName || "");
        setDiscordLinked(Boolean(integration?.connected));
      })
      .catch(() => undefined);
  }, [initialProfile?.id]);

  const disconnectGoogleWorkspace = async () => {
    const response = await fetch("/api/google/workspace/disconnect", { method: "POST" });
    if (response.ok) setGoogleWorkspace((current) => current ? { ...current, connected: false, email: undefined } : current);
  };

  const connectGoogleWorkspace = async () => {
    setGoogleConnectError("");
    try {
      const response = await fetch("/api/google/workspace/status", { cache: "no-store" });
      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("A ligação Google não está disponível neste site: a API do AXION OFFICE não está ligada à publicação.");
      }
      const status = await response.json() as { configured?: boolean; error?: string };
      if (!response.ok) throw new Error(status.error || "Não foi possível verificar a ligação Google.");
      if (!status.configured) throw new Error("A ligação Google ainda não está configurada no servidor.");
      window.location.assign("/api/google/workspace/oauth/start");
    } catch (error) {
      setGoogleConnectError(error instanceof Error ? error.message : "Não foi possível iniciar a ligação Google.");
    }
  };

  const saveDiscordIntegration = async () => {
    setDiscordSaving(true);
    setDiscordFeedback("");
    try {
      const response = await fetch("/api/profile/discord", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ discordUserId, displayName: discordDisplayName }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível associar a conta Discord.");
      setDiscordLinked(true);
      setDiscordFeedback("Conta Discord associada.");
    } catch (error) {
      setDiscordFeedback(error instanceof Error ? error.message : "Não foi possível associar a conta Discord.");
    } finally {
      setDiscordSaving(false);
    }
  };

  const handleCopyId = () => {
    navigator.clipboard?.writeText?.(profile.passkeyId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSaveChanges = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/api/profile/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.fullName,
          displayName: profile.displayName,
          role: profile.roleTitle,
          department: profile.department,
          email: profile.email,
          phone: profile.phone,
          deskLocation: profile.deskLocation,
          timezone: profile.timezone,
          bio: profile.bio,
          avatarUrl: profile.avatarUrl,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível guardar o perfil.");
      setSavedProfile(result.profile);
      setProfile(toFormProfile(result.profile));
      setSavedSuccess(true);
      onProfileSaved?.(result.profile, result.currentDeviceId || currentDeviceId);
      window.setTimeout(() => setSavedSuccess(false), 2500);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Não foi possível guardar o perfil.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col py-6 pb-28 relative z-10 select-none">
      
      {/* ================= TOP EDITORIAL HEADER (NO HEAVY CARD) ================= */}
      <div className="flex flex-col gap-6 pb-6 border-b border-white/10">
        
        {/* Top bar with back action and save */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBackToOverview && (
              <button
                type="button"
                onClick={onBackToOverview}
                className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2 text-xs font-sans"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Voltar ao Painel</span>
              </button>
            )}
            <span className="text-[11px] font-mono tracking-widest text-white/40 uppercase">
              AXION // IDENTITY & CLEARANCE
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleSaveChanges()}
            disabled={isSaving}
            style={{
              backgroundColor: savedSuccess ? "#10b981" : accentColor.hex,
              color: "#050609",
              boxShadow: `0 0 20px ${savedSuccess ? "rgba(16, 185, 129, 0.4)" : accentColor.glow}`
            }}
            className="px-4 py-2 rounded-xl font-bold text-xs font-sans transition-all cursor-pointer hover:brightness-110 disabled:opacity-60 flex items-center gap-2"
          >
            {isSaving ? (
              <span>A guardar...</span>
            ) : savedSuccess ? (
              <>
                <Check size={14} className="stroke-[3]" />
                <span>Perfil Guardado</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>Guardar Alterações</span>
              </>
            )}
          </button>
        </div>

        {/* Profile Identity Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-2">
          
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="relative group shrink-0">
              <div 
                className="w-20 h-20 md:w-22 md:h-22 rounded-2xl overflow-hidden border relative bg-[#121824]"
                style={{ borderColor: accentColor.hex }}
              >
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.fullName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-lg font-bold text-white/70">
                    {profile.fullName ? profile.fullName.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() : "AX"}
                  </div>
                )}
                <label
                  title="Alterar Fotografia"
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-sans font-semibold transition-opacity duration-200 cursor-pointer"
                >
                  <Camera size={16} className="mb-1 text-white/90" />
                  <span>Alterar</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => setProfile((current) => ({ ...current, avatarUrl: String(reader.result || "") }));
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              </div>

              {/* Biometric pulse dot */}
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#050609] border-2 border-[#050609] flex items-center justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-pulse" />
              </div>
            </div>

            {/* Profile Info */}
            <motion.div 
              initial={{ opacity: 0, x: -28 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-1"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-sans font-bold text-white tracking-tight uppercase">
                  {profile.fullName || "CONFIGURAR"}<span className="text-white/70 font-normal"> · PERFIL DO OPERADOR</span>
                </h1>
                
                <span 
                  className="text-[10px] font-mono tracking-wider uppercase px-2.5 py-0.5 rounded-full font-bold border"
                  style={{
                    color: accentColor.hex,
                    backgroundColor: `${accentColor.hex}15`,
                    borderColor: `${accentColor.hex}30`
                  }}
                >
                  {setupRequired ? "CONFIGURAÇÃO PENDENTE" : "OPERADOR AXION"}
                </span>

                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full flex items-center gap-1.5 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {setupRequired ? "DISPOSITIVO DETETADO" : "DISPOSITIVO RECONHECIDO"}
                </span>
              </div>

              <p className="text-xs md:text-sm text-white/70 font-sans">
                {profile.roleTitle || "Define a tua função"} <span className="text-white/30 mx-1.5">•</span> <span className="text-white/50">{profile.department || "AXION OFFICE"}</span>
              </p>

              <div className="flex items-center gap-3 mt-1 text-xs text-white/50 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Mail size={12} className="text-white/40" />
                  <span className="font-mono text-[11px] text-white/70">{profile.email || "Email por configurar"}</span>
                </div>
                {profile.passkeyId && <span className="text-white/20">•</span>}
                {profile.passkeyId && <div className="flex items-center gap-1.5 font-mono text-[11px]">
                  <Fingerprint size={12} style={{ color: accentColor.hex }} />
                  <span className="text-white/60">{profile.passkeyId}</span>
                  <button
                    onClick={handleCopyId}
                    className="hover:text-white transition-colors cursor-pointer ml-0.5"
                    title="Copiar ID da Chave"
                  >
                    {copiedId ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  </button>
                </div>}
              </div>
            </motion.div>
          </div>

        </div>

      </div>

      {(setupRequired || saveError) && (
        <div className="mt-5 rounded-xl border px-4 py-3 text-xs font-sans" style={{ borderColor: saveError ? "rgba(251,113,133,.35)" : `${accentColor.hex}35`, backgroundColor: saveError ? "rgba(251,113,133,.08)" : `${accentColor.hex}0d` }}>
          <span className="font-semibold" style={{ color: saveError ? "#fda4af" : accentColor.hex }}>
            {saveError || "Configura os teus dados e guarda o perfil. Este dispositivo será associado automaticamente e receberás a tua AX KEY."}
          </span>
        </div>
      )}

      {/* ================= HORIZONTAL INLINE TELEMETRY STRIP ================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-6 border-b border-white/10">
        {[
          { label: "Horas de Foco", val: `${((savedProfile?.focusMinutes ?? 0) / 60).toFixed(1)}h`, sub: "Tarefas concluídas", icon: Clock },
          { label: "Projetos em Curso", val: "14", sub: "3 prioridade alta", icon: Briefcase },
          { label: "Eficiência", val: "99.2%", sub: "Tempo resp. < 4m", icon: Activity },
          { label: "Credencial", val: savedProfile?.axKey ? "AX KEY" : "Pendente", sub: savedProfile?.axKey ? "Credencial ativa" : "Criada ao guardar", icon: ShieldCheck },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
                  {item.label}
                </span>
                <Icon size={14} className="text-white/30" />
              </div>
              <span className="text-2xl font-sans font-bold text-white tracking-tight">
                {item.val}
              </span>
              <span className="text-[11px] text-white/45 font-sans">
                {item.sub}
              </span>
            </div>
          );
        })}
      </div>

      {/* ================= CLEAN TEXT TABS ================= */}
      <div className="flex items-center gap-6 border-b border-white/10 pt-4 overflow-x-auto">
        {[
          { id: "general" as ProfileTab, label: "Dados Pessoais", icon: User },
          { id: "permissions" as ProfileTab, label: "Permissões & Acessos", icon: ShieldCheck },
          { id: "devices" as ProfileTab, label: "Sessões & Dispositivos", icon: Laptop },
          { id: "activity" as ProfileTab, label: "Registo de Auditoria", icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-xs font-sans font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap relative ${
                isActive ? "text-white" : "text-white/40 hover:text-white/80"
              }`}
            >
              <Icon size={14} style={{ color: isActive ? accentColor.hex : undefined }} />
              <span>{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="profileTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ backgroundColor: accentColor.hex }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ================= TAB PANELS (OPEN & ARCHITECTURAL) ================= */}
      <div className="pt-6">
        <AnimatePresence mode="wait">
          {activeTab === "general" && (
            <motion.form
              key="tab-general"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              onSubmit={handleSaveChanges}
              className="flex flex-col divide-y divide-white/5"
            >
              {/* Row 1: Full Name */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-4 items-center">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white/90">Nome Completo</span>
                  <span className="text-[11px] text-white/40">Nome oficial registado na organização</span>
                </div>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    value={profile.fullName}
                    onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-white text-xs font-sans focus:outline-none focus:border-[var(--axion-accent)] transition-colors"
                  />
                </div>
              </div>

              {/* Row 2: Display Name */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-4 items-center">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white/90">Nome de Exibição</span>
                  <span className="text-[11px] text-white/40">Usado no ecrã de boas-vindas e assistente AIVA</span>
                </div>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    value={profile.displayName}
                    onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-white text-xs font-sans focus:outline-none focus:border-[var(--axion-accent)] transition-colors"
                  />
                </div>
              </div>

              {/* Row 3: Role & Department */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-4 items-center">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white/90">Função & Departamento</span>
                  <span className="text-[11px] text-white/40">Cargo e divisão corporativa</span>
                </div>
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={profile.roleTitle}
                    onChange={(e) => setProfile({ ...profile, roleTitle: e.target.value })}
                    placeholder="Cargo"
                    className="w-full px-3.5 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-white text-xs font-sans focus:outline-none focus:border-[var(--axion-accent)] transition-colors"
                  />
                  <input
                    type="text"
                    value={profile.department}
                    onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                    placeholder="Departamento"
                    className="w-full px-3.5 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-white text-xs font-sans focus:outline-none focus:border-[var(--axion-accent)] transition-colors"
                  />
                </div>
              </div>

              {/* Row 4: Contacts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-4 items-center">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white/90">Contactos</span>
                  <span className="text-[11px] text-white/40">E-mail corporativo e telefone</span>
                </div>
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-[var(--axion-accent)] transition-colors"
                  />
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-[var(--axion-accent)] transition-colors"
                  />
                </div>
              </div>

              {/* Row 5: Desk Location */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-4 items-center">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white/90">Localização Física</span>
                  <span className="text-[11px] text-white/40">Gabinete e zona no edifício</span>
                </div>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    value={profile.deskLocation}
                    onChange={(e) => setProfile({ ...profile, deskLocation: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-white text-xs font-sans focus:outline-none focus:border-[var(--axion-accent)] transition-colors"
                  />
                </div>
              </div>

              {/* Row 6: Timezone */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-4 items-center">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white/90">Fuso Horário</span>
                  <span className="text-[11px] text-white/40">Referência usada na agenda e atividade</span>
                </div>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    value={profile.timezone}
                    onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-[var(--axion-accent)] transition-colors"
                  />
                </div>
              </div>

              {/* Row 7: Bio */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-4 items-start">
                <div className="flex flex-col pt-1">
                  <span className="text-xs font-semibold text-white/90">Bio & Descrição</span>
                  <span className="text-[11px] text-white/40">Resumo profissional executivo</span>
                </div>
                <div className="md:col-span-2">
                  <textarea
                    rows={3}
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white text-xs font-sans focus:outline-none focus:border-[var(--axion-accent)] transition-colors resize-none leading-relaxed"
                  />
                </div>
              </div>
            </motion.form>
          )}

          {activeTab === "permissions" && (
            <motion.div
              key="tab-permissions"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-8"
            >
              <div className="flex items-center justify-between gap-4 border-y border-white/10 py-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-white">Google Calendar & Tasks</span>
                  <span className="text-[11px] text-white/40 font-mono">
                    {googleWorkspace?.connected ? googleWorkspace.email : "Conta pessoal ainda não ligada"}
                  </span>
                </div>
                {googleWorkspace?.connected ? (
                  <button type="button" onClick={disconnectGoogleWorkspace} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-mono text-white/60 hover:text-white">Desligar</button>
                ) : (
                  <button type="button" onClick={() => void connectGoogleWorkspace()} className="rounded-lg px-3 py-2 text-[10px] font-mono font-bold text-black" style={{ backgroundColor: accentColor.hex }}>
                    Ligar Google
                  </button>
                )}
              </div>
              {googleConnectError && <p role="alert" className="-mt-6 text-[11px] text-rose-300">{googleConnectError}</p>}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-white/10 pb-6">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-white">Conta Discord</span>
                  <span className="text-[11px] text-white/40">Associa o teu Discord ao perfil AXION autenticado.</span>
                  <span className={`text-[10px] font-mono ${discordLinked ? "text-emerald-400" : "text-white/30"}`}>{discordLinked ? "ASSOCIADA" : "NÃO ASSOCIADA"}</span>
                </div>
                <div className="md:col-span-2 flex flex-col gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input type="text" inputMode="numeric" value={discordUserId} onChange={(event) => { setDiscordUserId(event.target.value.replace(/\D/g, "")); setDiscordLinked(false); }} placeholder="Discord User ID" className="w-full px-3.5 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-white text-xs font-mono focus:outline-none" />
                    <input type="text" value={discordDisplayName} onChange={(event) => setDiscordDisplayName(event.target.value)} placeholder="Username / nome no Discord (opcional)" className="w-full px-3.5 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-white text-xs font-sans focus:outline-none" />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] text-white/40">No Discord: Definições avançadas → Modo de programador → botão direito no utilizador → Copiar ID.</span>
                    <button type="button" onClick={saveDiscordIntegration} disabled={discordSaving || !discordUserId} className="shrink-0 rounded-lg px-3 py-2 text-[10px] font-mono font-bold text-black disabled:opacity-40" style={{ backgroundColor: accentColor.hex }}>{discordSaving ? "A associar..." : "Associar Discord"}</button>
                  </div>
                  {discordFeedback && <span className={`text-[10px] font-mono ${discordLinked ? "text-emerald-400" : "text-rose-300"}`}>{discordFeedback}</span>}
                </div>
              </div>

            </motion.div>
          )}

          {activeTab === "devices" && (
            <motion.div
              key="tab-devices"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-4"
            >
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-medium text-white/60">
                  Dispositivos reconhecidos neste perfil AXION
                </span>
                <span className="text-[10px] font-mono text-white/40">
                  {savedProfile?.devices?.length ?? 0} {(savedProfile?.devices?.length ?? 0) === 1 ? "DISPOSITIVO" : "DISPOSITIVOS"}
                </span>
              </div>

              <div className="flex flex-col divide-y divide-white/5 border-t border-b border-white/10">
                {(savedProfile?.devices ?? []).map((device) => {
                  const isCurrent = device.id === currentDeviceId;
                  const Icon = /iOS|Android/i.test(device.operatingSystem) ? Smartphone : Laptop;
                  return (
                    <div
                      key={device.id}
                      className="py-3.5 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5">
                        <Icon size={18} className="text-white/50 shrink-0" />
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white font-sans">
                              {device.name}
                            </span>
                            {isCurrent && (
                              <span 
                                className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border"
                                style={{
                                  color: accentColor.hex,
                                  backgroundColor: `${accentColor.hex}15`,
                                  borderColor: `${accentColor.hex}30`
                                }}
                              >
                                SESSÃO ATUAL
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-white/40 font-sans">
                            {device.operatingSystem} • IP {device.ipAddress}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-[11px] font-mono text-white/40">
                          {isCurrent ? "Sessão atual • Ativo agora" : `Última utilização: ${new Date(device.lastSeenAt).toLocaleString("pt-PT")}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {!savedProfile?.devices?.length && (
                  <div className="py-6 text-xs text-white/40">O dispositivo atual será associado quando guardares o perfil.</div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "activity" && (
            <motion.div
              key="tab-activity"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col divide-y divide-white/5 border-t border-b border-white/10"
            >
              {RECENT_ACTIVITIES.map((act, ai) => (
                <div
                  key={ai}
                  className="py-3 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--axion-accent)] shrink-0" />
                    <span className="text-xs text-white/80 font-sans">
                      {act.action}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[9px] font-mono tracking-wider text-white/40 uppercase bg-white/5 px-2 py-0.5 rounded">
                      {act.tag}
                    </span>
                    <span className="text-[10px] font-mono text-white/40">
                      {act.time}
                    </span>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
