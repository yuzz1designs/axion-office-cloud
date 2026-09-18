import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  LayoutGrid, 
  Users,
  MapPin, 
  PieChart, 
  Calendar, 
  Settings, 
  Bell, 
  Sparkles,
  Database,
  FolderArchive,
  CreditCard
} from "lucide-react";
import { AccentColorOption } from "../../types/settings";
import { useLanguage } from "../../i18n/LanguageContext";
import type { AxionProfile } from "../../types/profile";

export type NavTabId = "overview" | "clients" | "database" | "documents" | "calendar" | "payments" | "aiva" | "settings" | "profile" | "notifications";

interface NavItem {
  id: NavTabId;
  label: string;
  sublabel?: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Painel Principal", sublabel: "Visão Geral", icon: LayoutGrid },
  { id: "clients", label: "Clientes", sublabel: "Ecossistemas & CRM", icon: Users },
  { id: "database", label: "Base de Dados", sublabel: "Excel Data Sync", icon: Database },
  { id: "documents", label: "Depósito de Documentos", sublabel: "Vault Digital", icon: FolderArchive },
  { id: "calendar", label: "Agenda & Reuniões", sublabel: "Google Calendar & Tasks", icon: Calendar },
  { id: "payments", label: "Financeiro", sublabel: "Despesas & Pagamentos", icon: CreditCard },
  { id: "aiva", label: "AIVA Intelligence", sublabel: "Assistente Operacional", icon: Sparkles },
  { id: "settings", label: "Definições", sublabel: "Configurações", icon: Settings },
];

interface SidebarNavProps {
  activeTab?: NavTabId;
  onSelectTab?: (tabId: NavTabId) => void;
  unreadNotifications?: number;
  onOpenNotifications?: () => void;
  onOpenProfile?: () => void;
  profile?: AxionProfile | null;
  profileRequired?: boolean;
  accentColor?: AccentColorOption;
  isLight?: boolean;
  aivaEnabled?: boolean;
}

export default function SidebarNav({
  activeTab = "overview",
  onSelectTab,
  unreadNotifications = 0,
  onOpenNotifications,
  onOpenProfile,
  profile,
  profileRequired = false,
  accentColor = {
    id: "axion-blue",
    name: "AXION Blue",
    hex: "#00f0ff",
    secondary: "#0284c7",
    glow: "rgba(0, 240, 255, 0.4)"
  },
  isLight = false,
  aivaEnabled = false,
}: SidebarNavProps) {
  const { t, language } = useLanguage();
  const [currentTab, setCurrentTab] = useState<NavTabId>(activeTab);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  const handleTabClick = (id: NavTabId) => {
    setCurrentTab(id);
    if (onSelectTab) {
      onSelectTab(id);
    }
  };

  const selected = onSelectTab ? activeTab : currentTab;
  const translatedNavItems: NavItem[] = ([
    { id: "overview", label: t("nav.main"), sublabel: t("nav.overview"), icon: LayoutGrid },
    { id: "clients", label: t("nav.clients"), sublabel: "Ecossistemas & CRM", icon: Users },
    { id: "database", label: t("nav.database"), sublabel: t("nav.databaseSub"), icon: Database },
    { id: "documents", label: t("nav.documents"), sublabel: t("nav.documentsSub"), icon: FolderArchive },
    { id: "calendar", label: t("nav.calendar"), sublabel: t("nav.calendarSub"), icon: Calendar },
    { id: "payments", label: t("nav.payments"), sublabel: t("nav.paymentsSub"), icon: CreditCard },
    { id: "aiva", label: t("nav.aiva"), sublabel: language === "pt" ? "Assistente Operacional" : "Operational Assistant", icon: Sparkles },
    { id: "settings", label: t("nav.settings"), sublabel: t("nav.settingsSub"), icon: Settings },
  ] satisfies NavItem[]).filter((item) => aivaEnabled || item.id !== "aiva");

  return (
    <nav
      id="floating-sidebar-nav"
      aria-label={t("nav.aria")}
      className={`fixed left-3 md:left-5 top-4 bottom-4 w-16 md:w-[72px] backdrop-blur-2xl rounded-[32px] shadow-2xl flex flex-col items-center justify-between py-5 px-1.5 z-40 select-none transition-all duration-300 ${
        isLight 
          ? "bg-white/90 border border-slate-200/90 shadow-slate-300/40 text-slate-800" 
          : "bg-[#0c1017]/85 border border-white/10 shadow-black/80 text-white"
      }`}
    >
      {/* ================= TOP SECTION: BRAND ICON & TITLE ================= */}
      <div className="flex flex-col items-center gap-1 w-full">
        <button
          onClick={() => handleTabClick("overview")}
          className={`group relative flex flex-col items-center justify-center p-2 rounded-2xl border border-transparent transition-all duration-300 cursor-pointer outline-none ${
            isLight ? "hover:bg-slate-100/80" : "hover:bg-white/5"
          }`}
          title="Axion Office - Painel Principal"
        >
          <span 
            className="py-2 font-display text-[8px] font-semibold uppercase tracking-[0.18em] transition-all duration-300 group-hover:scale-105"
            style={{
              color: selected === "overview" ? accentColor.hex : (isLight ? "#334155" : "rgba(255,255,255,0.76)"),
              textShadow: selected === "overview" ? `0 0 8px ${accentColor.hex}70` : undefined,
            }}
          >
            AXION
          </span>
        </button>

        {/* Minimalist Divider Line */}
        <div className={`w-7 h-[1px] my-2 ${isLight ? "bg-slate-200" : "bg-white/10"}`} />
      </div>

      {/* ================= MIDDLE SECTION: NAVIGATION ICONS ================= */}
      <div className="flex flex-col items-center gap-2 w-full my-auto">
        {translatedNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = selected === item.id;
          const isHovered = hoveredTab === item.id;

          return (
            <div key={item.id} className="relative flex items-center justify-center w-full">
              <button
                id={`nav-item-${item.id}`}
                onClick={() => handleTabClick(item.id)}
                onMouseEnter={() => setHoveredTab(item.id)}
                onMouseLeave={() => setHoveredTab(null)}
                style={{
                  backgroundColor: isActive ? `${accentColor.hex}18` : undefined,
                  borderColor: isActive ? `${accentColor.hex}40` : undefined,
                }}
                className={`relative w-12 h-12 md:w-13 md:h-13 rounded-2xl flex items-center justify-center transition-all duration-300 outline-none cursor-pointer group border border-transparent ${
                  isActive 
                    ? (isLight ? "text-slate-950 font-bold" : "text-white") 
                    : (isLight ? "text-slate-400 hover:text-slate-800 hover:bg-slate-100" : "text-white/40 hover:text-white hover:bg-white/5")
                }`}
                aria-label={item.label}
              >
                {/* Active Left Indicator Bar - Powered by the customizable accent light */}
                {isActive && (
                  <motion.div
                    layoutId="sidebarActiveIndicator"
                    className="absolute left-0 w-[3.5px] h-6 rounded-r-md"
                    style={{
                      backgroundColor: accentColor.hex,
                      boxShadow: `0 0 10px ${accentColor.hex}`
                    }}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}

                {/* Nav Icon with clean, subtle accent color when active */}
                {item.id === "aiva" ? (
                  <span
                    className={`font-display text-[7px] font-bold tracking-[0.12em] transition-all duration-300 ${isActive ? "scale-105" : "group-hover:scale-105"}`}
                    style={{
                      color: isActive ? accentColor.hex : undefined,
                      textShadow: isActive ? `0 0 7px ${accentColor.hex}90` : undefined,
                    }}
                    aria-hidden="true"
                  >
                    AIVA
                  </span>
                ) : (
                  <Icon 
                    size={20} 
                    style={{
                      color: isActive ? accentColor.hex : undefined,
                      filter: isActive ? `drop-shadow(0 0 4px ${accentColor.hex}80)` : undefined,
                    }}
                    className={`transition-all duration-300 ${
                      isActive 
                        ? "scale-105" 
                        : (isLight ? "group-hover:scale-105 group-hover:text-slate-900" : "group-hover:scale-105 group-hover:text-white")
                    }`} 
                  />
                )}
              </button>

              {/* Floating Tooltip with smooth entry */}
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, x: -6, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -4, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute left-full ml-3.5 px-3 py-1.5 backdrop-blur-xl rounded-xl shadow-2xl z-50 pointer-events-none flex flex-col gap-0.5 whitespace-nowrap border ${
                      isLight 
                        ? "bg-white/95 border-slate-200 text-slate-900 shadow-slate-300/50" 
                        : "bg-[#121722]/95 border-white/15 text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-sans font-semibold tracking-wide ${isLight ? "text-slate-900" : "text-white"}`}>
                        {item.label}
                      </span>
                      {item.badge && (
                        <span 
                          className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border"
                          style={{
                            color: accentColor.hex,
                            backgroundColor: `${accentColor.hex}15`,
                            borderColor: `${accentColor.hex}30`
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    {item.sublabel && (
                      <span className={`text-[10px] font-mono tracking-wider ${isLight ? "text-slate-500" : "text-white/40"}`}>
                        {item.sublabel}
                      </span>
                    )}
                    {/* Tooltip caret */}
                    <div className={`absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent ${
                      isLight ? "border-r-white/95" : "border-r-[#121722]/95"
                    }`} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* ================= BOTTOM SECTION: NOTIFICATIONS & USER AVATAR ================= */}
      <div className="flex flex-col items-center gap-3 w-full pt-2">
        {/* Notification Bell Button */}
        <div className="relative flex items-center justify-center">
          <button
            id="sidebar-notifications-btn"
            onClick={onOpenNotifications}
            onMouseEnter={() => setHoveredTab("notifications")}
            onMouseLeave={() => setHoveredTab(null)}
            style={selected === "notifications" ? { color: accentColor.hex, borderColor: `${accentColor.hex}50`, backgroundColor: `${accentColor.hex}15` } : undefined}
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer outline-none group border ${
              isLight 
                ? "bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-950 hover:bg-slate-200" 
                : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20"
            }`}
            aria-label="Notificações"
          >
            <Bell size={18} className="transition-transform group-hover:rotate-12 duration-300" />
            
            {/* Unread Alert Red Dot Badge */}
            {unreadNotifications > 0 && (
              <span className={`absolute -right-1.5 -top-1.5 flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 py-0.5 text-[8px] font-bold leading-none text-white ring-2 ${isLight ? "ring-white" : "ring-[#0c1017]"}`}>
                {unreadNotifications > 99 ? "99+" : unreadNotifications}
              </span>
            )}
          </button>

          {/* Notifications Tooltip */}
          <AnimatePresence>
            {hoveredTab === "notifications" && (
              <motion.div
                initial={{ opacity: 0, x: -6, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className={`absolute left-full ml-3.5 px-3 py-1.5 backdrop-blur-xl rounded-xl shadow-2xl z-50 pointer-events-none whitespace-nowrap border ${
                  isLight 
                    ? "bg-white/95 border-slate-200 text-slate-900 shadow-slate-300/50" 
                    : "bg-[#121722]/95 border-white/15 text-white"
                }`}
              >
                <div className={`text-xs font-sans font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>Notificações</div>
                <div className="text-[10px] font-mono text-rose-500">
                  {unreadNotifications > 0 ? `${unreadNotifications} novas atualizações` : "Sem alertas"}
                </div>
                <div className={`absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent ${
                  isLight ? "border-r-white/95" : "border-r-[#121722]/95"
                }`} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Profile Avatar */}
        <div className="relative flex items-center justify-center">
          <button
            id="sidebar-user-avatar-btn"
            onClick={() => {
              if (onOpenProfile) {
                onOpenProfile();
              } else if (onSelectTab) {
                onSelectTab("profile");
              }
            }}
            onMouseEnter={() => setHoveredTab("profile")}
            onMouseLeave={() => setHoveredTab(null)}
            className={`relative w-10 h-10 rounded-full overflow-hidden transition-all duration-300 cursor-pointer outline-none group ring-2 ${
              activeTab === "profile" 
                ? "shadow-lg" 
                : (isLight ? "border border-slate-300 hover:border-slate-600" : "border border-white/20 hover:border-white/60")
            }`}
            style={{
              borderColor: activeTab === "profile" || hoveredTab === "profile" ? accentColor.hex : undefined,
              boxShadow: activeTab === "profile" ? `0 0 15px ${accentColor.glow}` : undefined,
              ringColor: activeTab === "profile" ? accentColor.hex : "transparent"
            }}
            aria-label="Perfil do Utilizador"
          >
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
            ) : (
              <div className={`w-full h-full flex items-center justify-center text-xs font-semibold ${
                isLight ? "bg-slate-200 text-slate-800" : "bg-gradient-to-tr from-[#1a2333] to-[#24334a] text-white/90"
              }`}>
                {profile?.initials || "AX"}
              </div>
            )}
            {/* Subtle glow underneath */}
            <div 
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" 
              style={{ backgroundColor: `${accentColor.hex}20` }}
            />
            {activeTab === "profile" && (
              <div 
                className="absolute inset-0 border-2 rounded-full pointer-events-none"
                style={{ borderColor: accentColor.hex }}
              />
            )}
          </button>

          {profileRequired && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute -right-2.5 -top-2 rounded-full border px-1.5 py-0.5 text-[7px] font-mono font-bold uppercase tracking-wider shadow-lg"
              style={{ color: accentColor.hex, borderColor: `${accentColor.hex}70`, backgroundColor: isLight ? "white" : "#121722", boxShadow: `0 0 12px ${accentColor.glow}` }}
            >
              Configurar
            </motion.span>
          )}

          {/* Profile Tooltip */}
          <AnimatePresence>
            {hoveredTab === "profile" && (
              <motion.div
                initial={{ opacity: 0, x: -6, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className={`absolute left-full ml-3.5 px-3 py-1.5 backdrop-blur-xl rounded-xl shadow-2xl z-50 pointer-events-none whitespace-nowrap border ${
                  isLight 
                    ? "bg-white/95 border-slate-200 text-slate-900 shadow-slate-300/50" 
                    : "bg-[#121722]/95 border-white/15 text-white"
                }`}
              >
                <div className={`text-xs font-sans font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>{profile?.name || "Perfil AXION"}</div>
                <div 
                  className="text-[10px] font-mono"
                  style={{ color: accentColor.hex }}
                >
                  {profileRequired ? "Configurar perfil" : activeTab === "profile" ? "Perfil Aberto" : `Ver Perfil${profile?.role ? ` • ${profile.role}` : ""}`}
                </div>
                <div className={`absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent ${
                  isLight ? "border-r-white/95" : "border-r-[#121722]/95"
                }`} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </nav>
  );
}
