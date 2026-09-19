import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { 
  DEFAULT_APPEARANCE,
  DEFAULT_COMMAND_CENTER,
  ACCENT_COLOR_OPTIONS
} from "../../data/settingsMockData";
import { 
  CalendarEvent,
  IntegratedTask,
  MeetingAta, 
  MeetingInviteNotification 
} from "../../data/calendarMockData";
import { AppearanceSettings, CommandCenterConfig, LanguageRegionSettings } from "../../types/settings";
import { useLanguage } from "../../i18n/LanguageContext";
import AxionLogo from "../ui/AxionLogo";
import AivaOverviewScreen from "../aiva/AivaOverviewScreen";
import AivaPanelTransition from "../aiva/AivaPanelTransition";
import { useAivaSession } from "../aiva/AivaSessionProvider";
import UserProfileScreen from "../profile/UserProfileScreen";
import DatabaseScreen from "../database/DatabaseScreen";
import DocumentRepositoryScreen from "../documents/DocumentRepositoryScreen";
import ClientsScreen from "../clients/ClientsScreen";
import CalendarMeetingsScreen from "../calendar/CalendarMeetingsScreen";
import PaymentsScreen from "../payments/PaymentsScreen";
import QuotesScreen from "../quotes/QuotesScreen";
import NotificationsScreen from "../notifications/NotificationsScreen";
import SidebarNav, { NavTabId } from "../navigation/SidebarNav";
import SettingsPage from "../settings/SettingsPage";
import MeetingInviteBanner from "./MeetingInviteBanner";
import OfficePresence, { useOfficePresence } from "./OfficePresence";
import { officeSessionTime } from "../../lib/officePresence";
import type { AxionProfile } from "../../types/profile";
import type { FinancePayload } from "../../types/finance";
import type { TeamActivityItem } from "../../server/teamActivityStore";
import { selectNextMeeting, selectTodayTasks } from "./commandCenterCore";
import { buildNotifications, type NotificationTarget } from "../notifications/notificationCore";
import { normalizeAppearanceSettings } from "../../lib/appearance";
import AnimatedOfficeBackground from "../ui/AnimatedOfficeBackground";
import { 
  Clock, 
  ArrowRight, 
  Calendar, 
  CheckCircle2, 
  Circle, 
  ShieldAlert, 
  Activity, 
  RotateCcw,
  Sparkles,
  Map,
  MapPin,
  PieChart
} from "lucide-react";

interface CommandCenterProps {
  initialTab?: NavTabId;
  onBackToWelcome?: () => void;
  profile?: AxionProfile | null;
  profileRequired?: boolean;
  currentDeviceId?: string;
  onProfileSaved?: (profile: AxionProfile, currentDeviceId?: string) => void;
  appearance?: AppearanceSettings;
  onAppearanceChange?: (appearance: AppearanceSettings) => void;
  commandCenterConfig?: CommandCenterConfig;
  onCommandCenterConfigChange?: (config: CommandCenterConfig) => void;
  languageRegion?: LanguageRegionSettings;
  onLanguageRegionChange?: (settings: LanguageRegionSettings) => void;
  aivaEnabled?: boolean;
}

function AivaNavigationBridge({ onNavigate, onClient, onDocument, onMeeting, section }: { onNavigate: (section: NavTabId) => void; onClient: (query: string) => void; onDocument: (query: string) => void; onMeeting: (id: string) => void; section: NavTabId }) {
  const session = useAivaSession();
  useEffect(() => session.registerNavigation(onNavigate, onClient, onDocument, onMeeting), [session.registerNavigation, onNavigate, onClient, onDocument, onMeeting]);
  useEffect(() => session.setCurrentSection(section), [section, session.setCurrentSection]);
  return null;
}

export default function CommandCenter({ 
  initialTab,
  onBackToWelcome,
  profile,
  profileRequired = false,
  currentDeviceId,
  onProfileSaved,
  appearance: initialAppearance,
  onAppearanceChange,
  commandCenterConfig = DEFAULT_COMMAND_CENTER,
  onCommandCenterConfigChange,
  languageRegion,
  onLanguageRegionChange,
  aivaEnabled = false,
}: CommandCenterProps) {
  const { language, t } = useLanguage();
  const reducedMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<NavTabId>(initialTab ?? "overview");
  const [aivaClientQuery, setAivaClientQuery] = useState("");
  const [aivaDocumentQuery, setAivaDocumentQuery] = useState("");
  const [workspaceTasks, setWorkspaceTasks] = useState<IntegratedTask[]>([]);
  const pendingTaskIds = useRef(new Set<string>());
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [financeData, setFinanceData] = useState<FinancePayload | null>(null);
  const [teamActivities, setTeamActivities] = useState<TeamActivityItem[]>([]);
  const [readNotificationKeys, setReadNotificationKeys] = useState<Set<string>>(new Set());
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());
  const officePresence = useOfficePresence(profile?.id);
  const ownPresence = officePresence.snapshot?.members.find((member) => member.userId === profile?.id);
  const [systemBooted, setSystemBooted] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Shared Global Meeting & Calendar States
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [atas, setAtas] = useState<MeetingAta[]>([]);
  const [meetingInvites, setMeetingInvites] = useState<MeetingInviteNotification[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("");
  const navigateFromAiva = React.useCallback((section: NavTabId) => setActiveTab(section), []);
  const openClientFromAiva = React.useCallback((query: string) => setAivaClientQuery(query), []);
  const openDocumentFromAiva = React.useCallback((query: string) => setAivaDocumentQuery(query), []);
  const openMeetingFromAiva = React.useCallback((id: string) => setSelectedMeetingId(id), []);

  // Handler for new meeting invite notifications broadcasted by leadership
  const handleBroadcastMeetingInvite = (invite: MeetingInviteNotification) => {
    setMeetingInvites(prev => [invite, ...prev]);
  };

  const handleDismissInvite = async (inviteId: string) => {
    const notificationKey = `meeting-hidden:${inviteId}`;
    setReadNotificationKeys((current) => new Set([...current, notificationKey]));
    setMeetingInvites(prev => prev.filter(inv => inv.id !== inviteId));
    try {
      const response = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: [notificationKey] }),
      });
      if (!response.ok) throw new Error("MEETING_HIDE_FAILED");
    } catch {
      setReadNotificationKeys((current) => {
        const next = new Set(current);
        next.delete(notificationKey);
        return next;
      });
    }
  };

  const handleAcceptInviteAndOpen = (eventId: string) => {
    setSelectedMeetingId(eventId);
    setActiveTab("calendar");
  };

  // Appearance & Customizable Accent Light State
  const [appearance, setAppearance] = useState<AppearanceSettings>(() => {
    if (initialAppearance) return normalizeAppearanceSettings(initialAppearance);
    try {
      const cached = localStorage.getItem("axion_office_appearance");
      if (cached) return normalizeAppearanceSettings(JSON.parse(cached));
    } catch (e) {}
    return DEFAULT_APPEARANCE;
  });

  useEffect(() => {
    if (initialAppearance) {
      setAppearance(normalizeAppearanceSettings(initialAppearance));
    }
  }, [initialAppearance]);

  const handleAppearanceUpdate = (updated: AppearanceSettings) => {
    setAppearance(updated);
    if (onAppearanceChange) {
      onAppearanceChange(updated);
    }
  };

  const isLight = false;
  const isAnimatedBackground = appearance.theme === "animated";
  const currentAccent = ACCENT_COLOR_OPTIONS.find(c => c.id === appearance.accentColor) || ACCENT_COLOR_OPTIONS[0];
  const moduleOrder = (moduleId: string) => {
    const index = commandCenterConfig.modules.findIndex((module) => module.id === moduleId);
    return index === -1 ? commandCenterConfig.modules.length : index;
  };
  const showRightColumn = true;
  const rightColumnWidth = "lg:w-[350px] xl:w-[390px]";

  // The current interface is always dark; animated only changes its background layer.
  useEffect(() => {
    document.body.setAttribute("data-theme", "dark");
    document.documentElement.setAttribute("data-theme", "dark");
    document.body.classList.remove("theme-light");
  }, []);

  // Keep the real clock and the current Office session duration synchronized.
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setCurrentTime(new Date(now));
    }, 1000);
    
    // Start the panel reveal as soon as the dashboard mounts.
    const bootTimer = setTimeout(() => {
      setSystemBooted(true);
    }, 0);

    return () => {
      clearInterval(timer);
      clearTimeout(bootTimer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const applyWorkspace = (status: { connected?: boolean; tasks?: IntegratedTask[]; events?: CalendarEvent[] }, platform?: { tasks?: IntegratedTask[]; events?: CalendarEvent[]; invites?: MeetingInviteNotification[] }) => {
      if (!active) return;
      const platformTasks = platform?.tasks || [];
      const platformEvents = platform?.events || [];
      setWorkspaceTasks([...platformTasks, ...(status.connected ? status.tasks || [] : []).filter((task) => !platformTasks.some((item) => item.id === task.id))]);
      setEvents(platformEvents);
      if (platform) setMeetingInvites(platform.invites || []);
    };
    const refreshOverview = async (syncGoogle = false) => {
      const [workspaceResult, meetingsResult, financeResult, activityResult, readsResult] = await Promise.allSettled([
        fetch(syncGoogle ? "/api/google/workspace/sync" : "/api/google/workspace/status", syncGoogle ? { method: "POST" } : undefined).then((response) => response.ok ? response.json() : null),
        fetch("/api/meetings").then((response) => response.ok ? response.json() : null),
        fetch("/api/finance").then((response) => response.ok ? response.json() as Promise<FinancePayload> : null),
        fetch("/api/team/activity").then((response) => response.ok ? response.json() as Promise<{ activities: TeamActivityItem[] }> : null),
        fetch("/api/notifications/read").then((response) => response.ok ? response.json() as Promise<{ keys: string[] }> : null),
      ]);
      if (!active) return;
      if (workspaceResult.status === "fulfilled" && workspaceResult.value) applyWorkspace(workspaceResult.value, meetingsResult.status === "fulfilled" ? meetingsResult.value : undefined);
      if (financeResult.status === "fulfilled" && financeResult.value) {
        setFinanceData(financeResult.value);
        setMonthlyRevenue(financeResult.value.summary.monthlyRevenue || 0);
      }
      if (activityResult.status === "fulfilled" && activityResult.value) setTeamActivities(activityResult.value.activities || []);
      if (readsResult.status === "fulfilled" && readsResult.value) setReadNotificationKeys(new Set(readsResult.value.keys || []));
    };
    void refreshOverview(false).then(() => refreshOverview(true));
    const realtimeRefresh = () => void refreshOverview(false);
    window.addEventListener("axion:realtime", realtimeRefresh);
    const timer = window.setInterval(() => void refreshOverview(false), 30_000);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("axion:realtime", realtimeRefresh); };
  }, []);

  // Track mouse coordinates to provide subtle parallax on the central Core logo
  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientWidth, clientHeight } = e.currentTarget;
    const x = (e.clientX - clientWidth / 2) / 45;
    const y = (e.clientY - clientHeight / 2) / 45;
    setMousePos({ x, y });
  };

  const localDate = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, "0")}-${String(currentTime.getDate()).padStart(2, "0")}`;
  const localTime = `${String(currentTime.getHours()).padStart(2, "0")}:${String(currentTime.getMinutes()).padStart(2, "0")}`;
  const todayTasks = useMemo(() => selectTodayTasks(workspaceTasks, localDate), [workspaceTasks, localDate]);
  const nextMeeting = useMemo(() => selectNextMeeting(events, localDate, localTime), [events, localDate, localTime]);
  const notifications = useMemo(() => buildNotifications({
    now: currentTime,
    timezone: profile?.timezone,
    activities: teamActivities.filter((activity) => activity.actorUserId !== profile?.id),
    tasks: workspaceTasks,
    events,
    payments: financeData?.payments || [],
    revenues: financeData?.revenues || [],
    readKeys: readNotificationKeys,
  }), [currentTime, events, financeData, readNotificationKeys, teamActivities, workspaceTasks]);
  const unreadNotifications = notifications.filter((item) => !item.read).length;
  const visibleMeetingInvites = useMemo(
    () => meetingInvites.filter((invite) => !readNotificationKeys.has(`meeting-hidden:${invite.id}`)),
    [meetingInvites, readNotificationKeys],
  );

  const markNotificationsRead = async (keys: string[]) => {
    const pending = keys.filter((key) => !readNotificationKeys.has(key));
    if (!pending.length) return;
    setReadNotificationKeys((current) => new Set([...current, ...pending]));
    const response = await fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys: pending }) });
    if (!response.ok) {
      setReadNotificationKeys((current) => new Set([...current].filter((key) => !pending.includes(key))));
      throw new Error("NOTIFICATION_MARK_READ_FAILED");
    }
  };

  const openNotification = (target: NotificationTarget, id: string) => {
    void markNotificationsRead([id]).catch(() => undefined);
    setActiveTab(target);
  };

  const handleToggleTask = async (taskId: string) => {
    if (pendingTaskIds.current.has(taskId)) return;
    const task = workspaceTasks.find((item) => item.id === taskId);
    if (!task) return;
    const completed = !task.completed;
    pendingTaskIds.current.add(taskId);
    setWorkspaceTasks((previous) => previous.map((item) => item.id === taskId ? { ...item, completed } : item));
    try {
      const platformTask = Boolean(task.eventId && !task.googleTaskId);
      const response = await fetch(platformTask ? `/api/meetings/tasks/${encodeURIComponent(task.id)}` : `/api/google/workspace/tasks/${encodeURIComponent(task.googleTaskId || "")}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...task, completed }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "TASK_UPDATE_FAILED");
      setWorkspaceTasks((previous) => previous.map((item) => item.id === taskId ? result.task : item));
      if (profile && result.focusMinutes != null) onProfileSaved?.({ ...profile, focusMinutes: result.focusMinutes }, currentDeviceId);
    } catch {
      setWorkspaceTasks((previous) => previous.map((item) => item.id === taskId ? task : item));
    } finally {
      pendingTaskIds.current.delete(taskId);
    }
  };

  // Dynamic greeting based on time (Hour is 22 based on seed)
  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12 && hour >= 6) return t("home.goodMorning");
    if (hour < 18 && hour >= 12) return t("home.goodAfternoon");
    return t("home.goodEvening");
  };

  // Formatting date in Portuguese locale to align with elegant editorial
  const formatDate = () => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: "long", 
      day: "numeric", 
      month: "long" 
    };
    return currentTime.toLocaleDateString(language === "pt" ? "pt-PT" : "en-US", options).toUpperCase();
  };

  const formatMeetingDate = (date: string, time: string) => {
    const label = new Date(`${date}T12:00:00`).toLocaleDateString(language === "pt" ? "pt-PT" : "en-US", { day: "2-digit", month: "short" });
    return `${label} · ${time}`.toUpperCase();
  };

  const formatActivityDate = (date: string) => new Date(date).toLocaleString(language === "pt" ? "pt-PT" : "en-US", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: profile?.timezone || "Europe/Lisbon",
  });

  // Transition variants for staggered boots
  const itemVariants = {
    hidden: { opacity: 0, y: reducedMotion ? 0 : 22, filter: reducedMotion ? "blur(0px)" : "blur(4px)" },
    visible: (custom: number) => ({
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        delay: reducedMotion ? 0 : custom * 0.065,
        duration: reducedMotion ? 0.15 : 0.65,
        ease: [0.16, 1, 0.3, 1]
      }
    })
  };

  return (
    <>
      {aivaEnabled && <AivaNavigationBridge onNavigate={navigateFromAiva} onClient={openClientFromAiva} onDocument={openDocumentFromAiva} onMeeting={openMeetingFromAiva} section={activeTab} />}
    <div 
      onMouseMove={handleMouseMove}
      className={`relative w-screen h-screen overflow-hidden flex flex-col justify-between pl-20 md:pl-28 pr-6 md:pr-10 py-6 md:py-8 select-none transition-colors duration-500 ${
        isLight ? "bg-[#ffffff] text-slate-900" : "bg-brand-bg text-white/90"
      }`}
    >
      {/* Floating Left Navigation Bar (Rounded capsule floating with customizable light) */}
      <SidebarNav 
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        unreadNotifications={unreadNotifications}
        onOpenNotifications={() => setActiveTab("notifications")}
        onOpenProfile={() => setActiveTab("profile")}
        profile={profile}
        profileRequired={profileRequired}
        aivaEnabled={aivaEnabled}
        accentColor={currentAccent}
        isLight={isLight}
      />

      <AnimatePresence>
        {isAnimatedBackground && <AnimatedOfficeBackground color={currentAccent.hex} />}
      </AnimatePresence>

      {/* Background Grid & Radial Core Light */}
      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
        isAnimatedBackground ? "tech-grid opacity-[0.08]" : "tech-grid opacity-20"
      }`} />
      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
        isLight ? "tech-radial-light opacity-70" : "tech-radial"
      }`} />
      
      {/* Soft central gradient orb reacting to mouse - Powered by customizable home light */}
      <motion.div 
        animate={{
          x: mousePos.x * 0.5,
          y: mousePos.y * 0.5
        }}
        transition={{ type: "spring", stiffness: 30, damping: 25 }}
        className="absolute w-[650px] h-[650px] rounded-full left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-700"
        style={{
          background: currentAccent.glow,
          filter: "blur(140px)",
          opacity: isLight ? 0.14 : 0.22
        }}
      />

      {/* Top atmospheric radiant ambient light flare */}
      <div 
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-[900px] h-[350px] pointer-events-none transition-all duration-700"
        style={{
          background: `radial-gradient(ellipse at center top, ${currentAccent.hex}${isLight ? "10" : "18"} 0%, transparent 70%)`
        }}
      />

      {/* Persistent Ambient Background Watermark Logo for secondary tabs */}
      <AnimatePresence>
        {activeTab !== "overview" && (
          <motion.div
            key="ambient-background-watermark"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 pointer-events-none flex items-center justify-center z-0 select-none overflow-hidden pl-16 md:pl-28"
          >
            {/* Concentric Precision Orbital Rings */}
            <div className={`relative flex items-center justify-center transition-opacity duration-700 ${
              isLight ? "opacity-[0.07]" : "opacity-[0.045]"
            }`}>
              {/* Inner Orbit */}
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                className={`absolute w-[360px] h-[360px] md:w-[480px] md:h-[480px] rounded-full border border-dashed ${
                  isLight ? "border-slate-900" : "border-white"
                }`}
              />
              {/* Outer Orbit */}
              <motion.div 
                animate={{ rotate: -360 }}
                transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
                className={`absolute w-[520px] h-[520px] md:w-[700px] md:h-[700px] rounded-full border ${
                  isLight ? "border-slate-900/40" : "border-white/50"
                }`}
              />
              {/* Central Logo Group identical to Home */}
              <div className="flex flex-col items-center justify-center gap-2 transform scale-110 md:scale-135">
                <AxionLogo 
                  size="xl" 
                  variant="full" 
                  pulse={false}
                  isLight={isLight}
                />
                <div className={`font-sans text-[11px] md:text-xs font-semibold uppercase text-center tracking-[0.55em] ml-[0.55em] mt-2 ${
                  isLight ? "text-slate-900" : "text-white/80"
                }`}>
                  OFFICE OPERATING SYSTEM
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== SCREEN CONTENT CONTAINER ==================== */}
      <AnimatePresence mode="wait">
        {activeTab === "notifications" ? (
          <motion.div
            key="notifications-tab-view"
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-full overflow-y-auto pr-2 relative z-10"
          >
            <NotificationsScreen
              notifications={notifications}
              accentColor={currentAccent}
              isLight={isLight}
              timezone={profile?.timezone}
              onBack={() => setActiveTab("overview")}
              onOpen={openNotification}
              onMarkAllRead={() => markNotificationsRead(notifications.map((item) => item.id))}
            />
          </motion.div>
        ) : activeTab === "profile" ? (
          <motion.div
            key="profile-tab-view"
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-full overflow-y-auto pr-2 relative z-10"
          >
            <UserProfileScreen 
              accentColor={currentAccent}
              onBackToOverview={() => setActiveTab("overview")}
              initialProfile={profile}
              setupRequired={profileRequired}
              currentDeviceId={currentDeviceId}
              onProfileSaved={onProfileSaved}
            />
          </motion.div>
        ) : activeTab === "clients" ? (
          <motion.div
            key="clients-tab-view"
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-full overflow-y-auto pr-2 relative z-10"
          >
            <ClientsScreen 
              accentColor={currentAccent}
              onBackToOverview={() => setActiveTab("overview")}
              requestedClient={aivaClientQuery}
              onRequestedClientHandled={() => setAivaClientQuery("")}
            />
          </motion.div>
        ) : activeTab === "quotes" ? (
          <motion.div
            key="quotes-tab-view"
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-full overflow-y-auto pr-2 relative z-10"
          >
            <QuotesScreen accentColor={currentAccent} onBackToOverview={() => setActiveTab("overview")} />
          </motion.div>
        ) : activeTab === "database" ? (
          <motion.div
            key="database-tab-view"
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-full overflow-y-auto pr-2 relative z-10"
          >
            <DatabaseScreen 
              accentColor={currentAccent}
              onBackToOverview={() => setActiveTab("overview")}
            />
          </motion.div>
        ) : activeTab === "documents" ? (
          <motion.div
            key="documents-tab-view"
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-full overflow-y-auto pr-2 relative z-10"
          >
            <DocumentRepositoryScreen 
              accentColor={currentAccent}
              onBackToOverview={() => setActiveTab("overview")}
              requestedDocument={aivaDocumentQuery}
              onRequestedDocumentHandled={() => setAivaDocumentQuery("")}
            />
          </motion.div>
        ) : activeTab === "calendar" ? (
          <motion.div
            key="calendar-tab-view"
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-full overflow-y-auto pr-2 relative z-10"
          >
            <CalendarMeetingsScreen 
              accentColor={currentAccent}
              onBackToOverview={() => setActiveTab("overview")}
              events={events}
              onEventsChange={setEvents}
              atas={atas}
              onAtasChange={setAtas}
              selectedMeetingId={selectedMeetingId}
              onSelectMeetingId={setSelectedMeetingId}
              onBroadcastMeetingInvite={handleBroadcastMeetingInvite}
              currentUserRole={profile?.role || "Membro AXION"}
              currentUser={profile}
              onMeetingCreated={(event, createdTasks) => {
                setEvents((previous) => [event, ...previous.filter((item) => item.id !== event.id)]);
                const ownTasks = createdTasks.filter((task) => task.assignee.name === (profile?.name || profile?.displayName));
                setWorkspaceTasks((previous) => [...ownTasks, ...previous.filter((item) => !ownTasks.some((task) => task.id === item.id))]);
              }}
              onMeetingUpdated={(event, updatedTasks) => {
                setEvents((previous) => previous.map((item) => item.id === event.id ? event : item));
                const ownTasks = updatedTasks.filter((task) => task.assignee.name === (profile?.name || profile?.displayName));
                setWorkspaceTasks((previous) => [...ownTasks, ...previous.filter((item) => !ownTasks.some((task) => task.id === item.id))]);
              }}
              isLight={isLight}
              onFocusMinutesChange={(focusMinutes) => {
                if (profile) onProfileSaved?.({ ...profile, focusMinutes }, currentDeviceId);
              }}
            />
          </motion.div>
        ) : activeTab === "payments" ? (
          <motion.div
            key="payments-tab-view"
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-full overflow-y-auto pr-2 relative z-10"
          >
            <PaymentsScreen 
              accentColor={currentAccent}
              onBackToOverview={() => setActiveTab("overview")}
              isLight={isLight}
            />
          </motion.div>
        ) : activeTab === "settings" ? (
          <motion.div
            key="settings-tab-view"
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-full overflow-y-auto pr-2 relative z-10"
          >
              <SettingsPage 
                initialAppearance={appearance}
                onAppearanceChange={handleAppearanceUpdate}
                initialCommandCenter={commandCenterConfig}
                onCommandCenterChange={onCommandCenterConfigChange}
                initialLanguageRegion={languageRegion}
                onLanguageRegionChange={onLanguageRegionChange}
              />
          </motion.div>
        ) : aivaEnabled && activeTab === "aiva" ? (
          <AivaPanelTransition key="aiva-tab-view" accentColor={currentAccent.hex}>
            <AivaOverviewScreen 
              accentColor={currentAccent}
              onBackToOverview={() => setActiveTab("overview")}
            />
          </AivaPanelTransition>
        ) : activeTab !== "overview" ? (
          <motion.div
            key={`placeholder-${activeTab}`}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="w-full h-full max-w-4xl mx-auto flex flex-col items-center justify-center text-center gap-6 relative z-10 my-auto"
          >
            <div className="w-16 h-16 rounded-3xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-white/70 shadow-2xl">
              <Sparkles size={28} style={{ color: currentAccent.hex }} />
            </div>

            <motion.div
              initial={{ opacity: 0, x: -28 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-2 max-w-md"
            >
              <span 
                className="text-xs font-mono tracking-widest uppercase"
                style={{ color: currentAccent.hex }}
              >
                AXION OPERATING MODULE
              </span>
              <h2 className="text-2xl font-sans font-bold text-white tracking-tight uppercase">
                MÓDULO AXION, <span className="text-white/70 font-normal">EM SINCRONIZAÇÃO</span>
              </h2>
              <p className="text-xs text-white/50 leading-relaxed font-sans">
                Módulo em sincronização de telemetria. Aceda às definições para configurar permissões ou regresse ao painel principal.
              </p>
            </motion.div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab("overview")}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-sans border border-white/10 transition-colors cursor-pointer"
              >
                Voltar ao Painel Principal
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                style={{
                  backgroundColor: currentAccent.hex,
                  color: "#050609",
                  boxShadow: `0 0 15px ${currentAccent.glow}`
                }}
                className="px-4 py-2 rounded-xl font-semibold text-xs font-sans transition-all cursor-pointer hover:brightness-110"
              >
                Abrir Definições
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="overview-tab-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full max-w-[1580px] mx-auto flex flex-col justify-between relative z-10 gap-3 md:gap-5 px-2 sm:px-4"
          >
            {/* Pop-up / Alerta de Reunião Convocada pela Liderança */}
            {visibleMeetingInvites.length > 0 && (
              <MeetingInviteBanner
                invite={visibleMeetingInvites[0]}
                onAcceptAndOpen={handleAcceptInviteAndOpen}
                onDismiss={handleDismissInvite}
                accentColor={currentAccent}
                isLight={isLight}
              />
            )}
        
        {/* ==================== TOP ROW (HEADER & DATE) ==================== */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          
          {/* Top-Left: Greeting & User identity */}
          <motion.div 
            custom={0}
            initial="hidden"
            animate={systemBooted ? "visible" : "hidden"}
            variants={itemVariants}
            className="flex flex-col"
          >
            <div className="flex items-center gap-3">
              <span 
                className="text-[10px] font-mono tracking-widest uppercase px-2.5 py-0.5 rounded-full border"
                style={{
                  color: currentAccent.hex,
                  backgroundColor: `${currentAccent.hex}15`,
                  borderColor: `${currentAccent.hex}30`
                }}
              >
                {t("home.access")}
              </span>
            </div>
            
            <h1 className="text-2xl md:text-3xl font-sans font-bold tracking-tight text-white mt-2 leading-none">
              {getGreeting()}, <span className="text-white/80 font-normal">{(profile?.displayName || profile?.name || "UTILIZADOR").toUpperCase()}</span>
            </h1>
            
            <span className="text-xs text-white/40 font-mono tracking-wider mt-1.5 flex items-center gap-2">
              <span 
                className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" 
                style={{ backgroundColor: currentAccent.hex, boxShadow: `0 0 8px ${currentAccent.hex}` }}
              />
              {formatDate()}
            </span>
          </motion.div>

          {/* Top-Right: Office session duration & exit */}
          <motion.div 
            custom={1}
            initial="hidden"
            animate={systemBooted ? "visible" : "hidden"}
            variants={itemVariants}
            className="flex items-center gap-6 self-end md:self-start"
          >
            {/* Time elapsed since the user entered AXION OFFICE */}
            <div className="text-right flex flex-col">
              <div className="text-xs font-mono tracking-widest text-white/30 uppercase">{t("home.session")}</div>
              <div className="text-2xl font-mono font-medium text-white flex items-center gap-2.5 mt-1 justify-end">
                <Clock size={16} style={{ color: currentAccent.hex }} className="animate-pulse" />
                <span>{ownPresence && !officePresence.error ? officeSessionTime(ownPresence, currentTime.getTime() + officePresence.clockOffset) || "—" : "—"}</span>
              </div>
            </div>

            {/* Back button to simulated welcome for demonstration */}
            {onBackToWelcome && (
              <button 
                onClick={onBackToWelcome}
                title="Sair do sistema"
                className="group flex items-center justify-center w-10 h-10 rounded-sm bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 transition-all duration-300 cursor-pointer"
              >
                <RotateCcw size={16} className="text-white/50 group-hover:text-white transition-colors" />
              </button>
            )}
          </motion.div>

        </div>

        <OfficePresence presence={officePresence} currentUserId={profile?.id} now={currentTime.getTime()} />

        {/* ==================== MIDDLE ROW (CENTRAL CORE & REFINED SPACIOUS LAYOUT) ==================== */}
        <div className="flex-1 flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-14 my-2 relative w-full">
          
          {/* LEFT SIDE DATA COLUMN - Activity and financial signal */}
          <motion.div
            layout
            className={`w-full ${rightColumnWidth} shrink-0 flex flex-col justify-center gap-7 self-center z-20 transition-[width] duration-500`}
          >
            <motion.div
              custom={2}
              initial="hidden"
              animate={systemBooted ? "visible" : "hidden"}
              variants={itemVariants}
              className="flex flex-col gap-3 text-left"
            >
              <div className="flex items-center gap-2.5 border-b border-white/5 pb-2">
                <Activity size={12} className="text-white/30 animate-pulse" />
                <h3 className="text-xs font-mono tracking-[0.2em] text-white/60 uppercase">{t("home.activity")}</h3>
              </div>
              <div className="flex flex-col gap-2.5">
                {teamActivities.slice(0, commandCenterConfig.recentItemsCount).map((log) => (
                  <div key={log.id} className="flex flex-col gap-1 border-l border-white/10 pl-3 text-[10px] font-mono text-white/50 hover:border-brand-accent/50 hover:text-white/80 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-brand-accent/70">{formatActivityDate(log.createdAt)}</span>
                      <span className="text-white/20">•</span>
                      <span className="text-white/40 truncate">{log.actorName.toUpperCase()}</span>
                    </div>
                    <span className="text-white/60 line-clamp-2">{log.action}</span>
                  </div>
                ))}
                {teamActivities.length === 0 && (
                  <span className="text-[10px] font-mono leading-relaxed text-white/30">
                    Sem atividade recente publicada por outros utilizadores.
                  </span>
                )}
              </div>
            </motion.div>

            <motion.button
              custom={3}
              initial="hidden"
              animate={systemBooted ? "visible" : "hidden"}
              variants={itemVariants}
              onClick={() => setActiveTab("payments")}
              className="w-full border border-white/5 bg-white/[0.015] hover:bg-white/[0.03] rounded-sm px-4 py-3.5 text-left transition-colors"
            >
              <span className="text-[9px] font-mono tracking-[0.2em] text-white/30">REVENUE</span>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-xl font-light text-white/90">
                  {new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(monthlyRevenue)}
                </span>
                <span className="text-[9px] text-white/30">recebido este mês</span>
              </div>
            </motion.button>

          </motion.div>

          {/* CENTRAL CORE HERO LOGO (Centered with calibrated orbital rings & ample margin) */}
          <div className="flex-1 flex flex-col items-center justify-center relative py-6 lg:py-0 self-center min-w-0">
            
            {/* Central Core Emblem & Concentric Orbits Group */}
            <div className="relative flex flex-col items-center justify-center my-auto">
              
              {/* Visual Concentric Tech Rings (Proportionally scaled to avoid text collisions) */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {/* Radiant Center Glow Core in selected accent */}
                <div 
                  className="absolute w-[240px] h-[240px] rounded-full blur-2xl transition-all duration-700 pointer-events-none"
                  style={{
                    backgroundColor: currentAccent.hex,
                    opacity: 0.16
                  }}
                />

                {/* Inner Ring 1 (Dashed Precision Orbit) */}
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
                  className="absolute w-[230px] h-[230px] rounded-full border border-dashed transition-all duration-500"
                  style={{
                    borderColor: `${currentAccent.hex}25`
                  }}
                />
                
                {/* Mid Ring 2 (Radar Track with Orbital Node Markers) */}
                <motion.div 
                  animate={{ rotate: -360 }}
                  transition={{ duration: 65, repeat: Infinity, ease: "linear" }}
                  className="absolute w-[300px] h-[300px] rounded-full border transition-all duration-500"
                  style={{
                    borderColor: `${currentAccent.hex}15`
                  }}
                >
                  <span 
                    className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full transition-all duration-500"
                    style={{ backgroundColor: currentAccent.hex, boxShadow: `0 0 8px ${currentAccent.hex}` }}
                  />
                  <span 
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full transition-all duration-500"
                    style={{ backgroundColor: currentAccent.hex, boxShadow: `0 0 8px ${currentAccent.hex}` }}
                  />
                  <span 
                    className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full transition-all duration-500"
                    style={{ backgroundColor: currentAccent.hex, boxShadow: `0 0 8px ${currentAccent.hex}` }}
                  />
                  <span 
                    className="absolute right-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full transition-all duration-500"
                    style={{ backgroundColor: currentAccent.hex, boxShadow: `0 0 8px ${currentAccent.hex}` }}
                  />
                </motion.div>

                {/* Outer Ring 3 (Wide Atmospheric Orbit - safely bounded) */}
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
                  className="absolute w-[370px] h-[370px] rounded-full border border-dotted border-white/[0.05]"
                />
              </div>

              {/* Central Logo Group */}
              <div className="relative z-10 flex flex-col items-center justify-center gap-1.5 py-4">
                <AxionLogo 
                  size="xl" 
                  variant="full" 
                  animate={true} 
                  pulse={false} 
                  isLight={isLight}
                  className="z-10" 
                />
                
                <div className={`font-sans text-[11px] md:text-xs font-semibold uppercase text-center tracking-[0.5em] ml-[0.5em] mt-1 ${
                  isLight ? "text-slate-900" : "text-white/50"
                }`}>
                  OFFICE OPERATING SYSTEM
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT SIDE DATA COLUMN - Firmly anchored to the right */}
          {showRightColumn && (
          <motion.div
            layout
            className={`w-full ${rightColumnWidth} shrink-0 flex flex-col justify-center gap-7 self-center z-20 transition-[width] duration-500`}
          >
            
            {/* Today's Agenda Checklist */}
            <motion.div
              custom={4}
              initial="hidden"
              animate={systemBooted ? "visible" : "hidden"}
              variants={itemVariants}
              className="flex flex-col gap-3.5 text-left"
              style={{ order: moduleOrder("today") }}
            >
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <h3 
                  onClick={() => setActiveTab("calendar")}
                  className="text-xs font-mono tracking-[0.2em] text-white/60 uppercase hover:text-white cursor-pointer transition-colors"
                >
                  TASKS DE HOJE
                </h3>
                <button
                  onClick={() => setActiveTab("calendar")}
                  className="text-[10px] font-mono ml-auto flex items-center gap-1 transition-all cursor-pointer opacity-60 hover:opacity-100"
                  style={{ color: currentAccent.hex }}
                >
                  <Calendar size={11} />
                  <span>{todayTasks.length} {todayTasks.length === 1 ? "tarefa" : "tarefas"}</span>
                </button>
              </div>
              
              <div className="flex flex-col gap-2.5">
                {todayTasks.slice(0, commandCenterConfig.recentItemsCount).map((task) => (
                  <div 
                    key={task.id}
                    onClick={() => handleToggleTask(task.id)}
                    className="group flex items-start gap-2.5 p-2 hover:bg-white/[0.015] border border-transparent hover:border-white/5 rounded-sm transition-all duration-300 cursor-pointer"
                  >
                    {/* Tick box toggle */}
                    <button className="text-white/40 group-hover:text-brand-accent transition-colors duration-300 mt-0.5 outline-none">
                      {task.completed ? (
                        <CheckCircle2 size={14} style={{ color: currentAccent.hex }} />
                      ) : (
                        <Circle size={14} className="text-white/20 group-hover:text-brand-accent/50" />
                      )}
                    </button>

                    <div className="flex flex-col gap-0.5">
                      <span className={`text-xs font-sans font-medium transition-all duration-300 ${
                        task.completed ? "text-white/30 line-through decoration-brand-accent/45" : "text-white/90 group-hover:text-white"
                      }`}>
                        {task.title}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-white/30">
                        <span style={{ color: currentAccent.hex }}>{task.dueTime || "SEM HORA"}</span>
                        <span>•</span>
                        <span>{task.clientName || task.assignee.name || "Google Tasks"}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {todayTasks.length === 0 && (
                  <button onClick={() => setActiveTab("calendar")} className="rounded-sm border border-white/5 bg-white/[0.01] px-3 py-5 text-left text-[11px] text-white/35 hover:border-white/10 hover:text-white/55">
                    Nenhuma tarefa para hoje.
                  </button>
                )}
              </div>
            </motion.div>

            {/* Upcoming Event Module */}
            <motion.div
              custom={5}
              initial="hidden"
              animate={systemBooted ? "visible" : "hidden"}
              variants={itemVariants}
              className="flex flex-col gap-3.5"
              style={{ order: moduleOrder("meetings") }}
            >
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <h3 className="text-xs font-mono tracking-[0.2em] text-white/60 uppercase">{t("home.meeting")}</h3>
              </div>
              
              <div 
                onClick={() => {
                  if (nextMeeting) setSelectedMeetingId(nextMeeting.id);
                  setActiveTab("calendar");
                }}
                className="group relative p-3.5 bg-white/[0.01] hover:bg-white/[0.02] border border-white/5 hover:border-brand-accent/20 rounded-sm transition-all duration-500 flex flex-col gap-2.5 cursor-pointer"
              >
                {nextMeeting ? <>
                <div className="flex items-center gap-2 text-[10px] font-mono" style={{ color: currentAccent.hex }}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: currentAccent.hex, boxShadow: `0 0 8px ${currentAccent.glow}` }} />
                  <span>{formatMeetingDate(nextMeeting.date, nextMeeting.startTime)}</span>
                </div>
                
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-mono tracking-wider text-white/40 uppercase">
                    {nextMeeting.clientName || "AXION OFFICE"}
                  </span>
                  <span className="text-xs font-sans font-bold text-white group-hover:text-brand-accent transition-colors duration-300">
                    {nextMeeting.title}
                  </span>
                </div>
                
                <span className="text-[9px] font-mono text-white/30 tracking-wide mt-0.5 flex items-center gap-1 group-hover:text-white/50 transition-colors">
                  <span>{t("home.openMeeting")}</span>
                  <ArrowRight size={10} className="transform group-hover:translate-x-1 transition-transform" />
                </span>
                </> : <div className="flex items-center gap-2 py-3 text-xs text-white/35"><Calendar size={14} /><span>Nenhuma reunião pendente.</span></div>}
              </div>
            </motion.div>

          </motion.div>
          )}

        </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}
