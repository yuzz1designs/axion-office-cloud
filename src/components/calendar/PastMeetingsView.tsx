import React, { useState, useMemo } from "react";
import { 
  Calendar, 
  Clock, 
  Users, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  ChevronRight, 
  Search, 
  Sparkles,
  ArrowUpRight,
  Filter,
  Check,
  Video
} from "lucide-react";
import { CalendarEvent, MeetingAta } from "../../data/calendarMockData";
import { AccentColorOption } from "../../types/settings";

interface PastMeetingsViewProps {
  events: CalendarEvent[];
  atas: MeetingAta[];
  accentColor: AccentColorOption;
  onSelectMeeting: (eventId: string) => void;
  onPublishAta: (ataId: string) => void;
  isLight?: boolean;
}

export default function PastMeetingsView({
  events,
  atas,
  accentColor,
  onSelectMeeting,
  onPublishAta,
  isLight = false
}: PastMeetingsViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending_review" | "published" | "completed">("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

  // Filter and sort meetings (past and completed meetings first, followed by recent ones)
  const pastMeetingsList = useMemo(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    // Merge events with their ATAs
    return events
      .map(event => {
        const ata = atas.find(a => a.eventId === event.id || a.id === event.discordAtaId);
        const isPastOrToday = event.status === "completed" || event.date <= today;
        return {
          ...event,
          ata,
          isPast: isPastOrToday
        };
      })
      .filter(item => {
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesTitle = item.title.toLowerCase().includes(q);
          const matchesClient = item.clientName.toLowerCase().includes(q);
          const matchesDesc = item.description?.toLowerCase().includes(q);
          const matchesAta = item.ata?.executiveSummary.toLowerCase().includes(q);
          if (!matchesTitle && !matchesClient && !matchesDesc && !matchesAta) return false;
        }

        // Status Filter
        if (statusFilter === "pending_review") {
          return item.ata?.platformStatus === "pending_review" || (item.status === "completed" && item.ata?.discordStatus === "draft");
        }
        if (statusFilter === "published") {
          return item.ata?.platformStatus === "published" || item.ata?.discordStatus === "published";
        }
        if (statusFilter === "completed") {
          return item.status === "completed";
        }

        // Client Filter
        if (clientFilter !== "all" && item.clientName !== clientFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Sort descending by date and time
        const dtA = `${a.date} ${a.startTime}`;
        const dtB = `${b.date} ${b.startTime}`;
        return dtB.localeCompare(dtA);
      });
  }, [events, atas, searchQuery, statusFilter, clientFilter]);

  // Unique clients for filter
  const clientOptions = useMemo(() => {
    const clients = new Set(events.map(e => e.clientName));
    return Array.from(clients);
  }, [events]);

  const pendingCount = useMemo(() => {
    return atas.filter(a => a.platformStatus === "pending_review" || a.discordStatus === "draft").length;
  }, [atas]);

  return (
    <div className="flex flex-col gap-6 w-full">
      
      {/* ========================================================================= */}
      {/* TOP SUMMARY & FLAT STATS BAR (NO CARDS - PURE EDITORIAL) */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 border-b border-white/[0.08]">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-white/50">
              HISTÓRICO OPERACIONAL
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/80">
              {pastMeetingsList.length} Reuniões Registadas
            </span>
            {pendingCount > 0 && (
              <span 
                className="text-[10px] font-mono px-2.5 py-0.5 rounded-full flex items-center gap-1 font-semibold"
                style={{
                  backgroundColor: `${accentColor.hex}15`,
                  border: `1px solid ${accentColor.hex}30`,
                  color: accentColor.hex
                }}
              >
                <AlertTriangle size={11} className="animate-pulse" />
                {pendingCount} Aguarda Publicação na Plataforma
              </span>
            )}
          </div>
          <p className="text-xs text-white/50 font-sans">
            Consulte todas as sessões realizadas, gravações de áudio AIVA, transcrições e status de publicação da ata.
          </p>
        </div>

        {/* Filter Controls Bar (Flat Minimalist) */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search Box */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-white/10 rounded-xl focus-within:border-white/40 transition-colors">
            <Search size={13} className="text-white/40" />
            <input 
              type="text"
              placeholder="Pesquisar por pauta, cliente ou orador..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-white placeholder-white/30 focus:outline-none w-48 sm:w-64 font-sans"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-[10px] text-white/40 hover:text-white">✕</button>
            )}
          </div>

          {/* Client Filter */}
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="bg-black/40 border border-white/10 text-white/70 px-3 py-1.5 rounded-xl text-xs font-mono focus:outline-none cursor-pointer"
          >
            <option value="all" className="bg-[#0b0f19]">Todos os Clientes</option>
            {clientOptions.map(c => (
              <option key={c} value={c} className="bg-[#0b0f19]">{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FILTER TABS (CARDLESS, BORDER-BOTTOM STYLE) */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-6 border-b border-white/[0.08] text-xs font-mono pb-0.5 overflow-x-auto">
        <button
          onClick={() => setStatusFilter("all")}
          className={`pb-2.5 transition-all relative whitespace-nowrap ${
            statusFilter === "all"
              ? "text-white font-bold border-b-2"
              : "text-white/40 hover:text-white"
          }`}
          style={{ borderColor: statusFilter === "all" ? accentColor.hex : "transparent" }}
        >
          Todas ({events.length})
        </button>

        <button
          onClick={() => setStatusFilter("pending_review")}
          className={`pb-2.5 transition-all relative flex items-center gap-1.5 whitespace-nowrap ${
            statusFilter === "pending_review"
              ? "text-white font-bold border-b-2"
              : "text-white/40 hover:text-white"
          }`}
          style={{ borderColor: statusFilter === "pending_review" ? accentColor.hex : "transparent" }}
        >
          <span 
            className="w-1.5 h-1.5 rounded-full animate-pulse" 
            style={{ backgroundColor: accentColor.hex }}
          />
          <span>Atas Pendentes de Publicação ({pendingCount})</span>
        </button>

        <button
          onClick={() => setStatusFilter("published")}
          className={`pb-2.5 transition-all relative whitespace-nowrap ${
            statusFilter === "published"
              ? "text-white font-bold border-b-2"
              : "text-white/40 hover:text-white"
          }`}
          style={{ borderColor: statusFilter === "published" ? accentColor.hex : "transparent" }}
        >
          Atas Publicadas
        </button>

        <button
          onClick={() => setStatusFilter("completed")}
          className={`pb-2.5 transition-all relative whitespace-nowrap ${
            statusFilter === "completed"
              ? "text-white font-bold border-b-2"
              : "text-white/40 hover:text-white"
          }`}
          style={{ borderColor: statusFilter === "completed" ? accentColor.hex : "transparent" }}
        >
          Reuniões Concluídas
        </button>
      </div>

      {/* ========================================================================= */}
      {/* EDITORIAL LIST TABLE (CARDLESS, SLEEK DIVIDED ROWS) */}
      {/* ========================================================================= */}
      <div className="flex flex-col divide-y divide-white/[0.08] w-full">
        {pastMeetingsList.map((meeting) => {
          const isPendingPublication = meeting.ata && meeting.ata.platformStatus === "pending_review";
          const isPublished = meeting.ata && (meeting.ata.platformStatus === "published" || meeting.ata.discordStatus === "published");

          return (
            <div
              key={meeting.id}
              onClick={() => onSelectMeeting(meeting.id)}
              className="group py-5 px-3 hover:bg-white/[0.02] transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-5 select-none"
            >
              {/* Left Column: Date & Title & Client */}
              <div className="flex items-start gap-4 min-w-0 flex-1">
                {/* Date Badge (Minimalist) */}
                <div className="flex flex-col items-center justify-center w-12 shrink-0 pt-0.5">
                  <span className="text-[10px] font-mono uppercase text-white/40">
                    {new Date(meeting.date).toLocaleDateString("pt-PT", { month: "short" })}
                  </span>
                  <span className="text-lg font-mono font-bold text-white leading-none">
                    {meeting.date.split("-")[2]}
                  </span>
                  <span className="text-[9px] font-mono text-white/30 mt-0.5">
                    {meeting.startTime}
                  </span>
                </div>

                {/* Info Hierarchy */}
                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span 
                      className="text-[11px] font-mono font-bold uppercase tracking-wider"
                      style={{ color: accentColor.hex }}
                    >
                      {meeting.clientName}
                    </span>
                    <span className="text-white/20">•</span>
                    <span className="text-[10px] font-mono text-white/40">
                      {meeting.durationMinutes} min ({meeting.startTime} - {meeting.endTime})
                    </span>

                    {/* Status Badge */}
                    {isPendingPublication ? (
                      <span 
                        className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 font-bold"
                        style={{
                          backgroundColor: `${accentColor.hex}15`,
                          border: `1px solid ${accentColor.hex}30`,
                          color: accentColor.hex
                        }}
                      >
                        <AlertTriangle size={10} />
                        ATA PENDENTE DE PUBLICAÇÃO
                      </span>
                    ) : isPublished ? (
                      <span className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1 font-medium">
                        <Check size={10} />
                        ATA PUBLICADA NO ECOSSISTEMA
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300">
                        {meeting.status === "completed" ? "CONCLUÍDA" : "AGENDADA"}
                      </span>
                    )}
                  </div>

                  {/* Meeting Title */}
                  <h4 className="text-sm md:text-base font-sans font-bold text-white group-hover:text-white transition-colors">
                    {meeting.title}
                  </h4>

                  {/* Summary / Pauta Snippet */}
                  <p className="text-xs text-white/50 font-sans line-clamp-1 max-w-2xl">
                    {meeting.ata?.executiveSummary || meeting.description}
                  </p>

                  {/* Attendees & AI Indicator */}
                  <div className="flex items-center gap-3 pt-1 text-[11px] font-mono text-white/40 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Users size={12} className="text-white/30" />
                      <span>{meeting.attendees.map(a => a.name.split(" ")[0]).join(", ")}</span>
                    </div>

                    {meeting.ata && (
                      <>
                        <span>•</span>
                        <div className="flex items-center gap-1 text-[#8ea1e1]">
                          <Sparkles size={11} />
                          <span>AIVA Voice Sync ({meeting.ata.duration})</span>
                        </div>
                      </>
                    )}

                    {meeting.locationUrl && (
                      <>
                        <span>•</span>
                        <span className="text-white/30 flex items-center gap-1">
                          <Video size={11} /> Google Meet
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Actions */}
              <div className="flex items-center gap-3 shrink-0 self-end md:self-center pl-16 md:pl-0">
                {isPendingPublication && meeting.ata && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPublishAta(meeting.ata!.id);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-black text-xs font-sans font-bold transition-all rounded-sm shadow-sm cursor-pointer hover:opacity-90 active:scale-95"
                    style={{ backgroundColor: accentColor.hex }}
                    title="Confirmar minuta da IA e publicar imediatamente"
                  >
                    <Check size={12} className="stroke-[3]" />
                    <span>Publicar Ata</span>
                  </button>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectMeeting(meeting.id);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white text-xs font-sans font-medium transition-all rounded-sm cursor-pointer group-hover:border-white/30"
                >
                  <span>Ver Informação Completa</span>
                  <ChevronRight size={13} className="text-white/50 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          );
        })}

        {pastMeetingsList.length === 0 && (
          <div className="py-16 text-center text-xs text-white/40 font-sans flex flex-col items-center justify-center gap-2">
            <Calendar size={24} className="text-white/20" />
            <span>Nenhuma reunião encontrada com os filtros selecionados.</span>
          </div>
        )}
      </div>

    </div>
  );
}
