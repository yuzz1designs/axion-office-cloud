import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Calendar, Clock, Video, Users, Check, X, ArrowRight, Sparkles, BellRing } from "lucide-react";
import { MeetingInviteNotification } from "../../data/calendarMockData";
import { AccentColorOption } from "../../types/settings";

interface MeetingInviteBannerProps {
  invite: MeetingInviteNotification | null;
  onAcceptAndOpen: (eventId: string) => void;
  onDismiss: (inviteId: string) => void;
  accentColor: AccentColorOption;
  isLight?: boolean;
}

export default function MeetingInviteBanner({
  invite,
  onAcceptAndOpen,
  onDismiss,
  accentColor,
  isLight = false
}: MeetingInviteBannerProps) {
  if (!invite) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -16, scale: 0.98 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full relative z-30 overflow-hidden select-none mb-3"
      >
        {/* Sleek Line Glow Border at the top (Cardless, pure structural banner) */}
        <div 
          className="h-[2px] w-full"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${accentColor.hex} 25%, ${accentColor.hex} 75%, transparent 100%)`
          }}
        />

        {/* Banner Body */}
        <div className="bg-[#0b101d]/95 backdrop-blur-2xl border-x border-b border-white/10 px-4 py-3.5 sm:px-6 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Left: Indicator & Content */}
          <div className="flex items-start gap-3.5 min-w-0">
            {/* Pulsing Bell Node */}
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              style={{
                backgroundColor: `${accentColor.hex}15`,
                border: `1px solid ${accentColor.hex}40`
              }}
            >
              <BellRing size={15} className="animate-pulse" style={{ color: accentColor.hex }} />
            </div>

            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span 
                  className="text-[10px] font-mono font-bold tracking-widest uppercase"
                  style={{ color: accentColor.hex }}
                >
                  REUNIÃO AGENDADA
                </span>
                <span className="text-white/20">•</span>
                <span className="text-[10px] font-mono text-white/40">{invite.timestamp}</span>
                <span className="text-white/20">•</span>
                <span className="text-[10px] font-mono text-white/60 font-semibold">{invite.clientName}</span>
              </div>

              {/* Title & Meeting Host */}
              <div className="flex items-baseline gap-2 flex-wrap">
                <h4 className="text-sm sm:text-base font-sans font-bold text-white tracking-tight">
                  {invite.meetingTitle}
                </h4>
                <span className="text-xs text-white/50 font-sans">
                  — Convocada por <span className="text-white font-medium">{invite.createdBy.name}</span> ({invite.createdBy.role})
                </span>
              </div>

              {/* Date, Time & Invited Attendees */}
              <div className="flex items-center gap-4 text-xs font-mono text-white/50 flex-wrap pt-0.5">
                <div className="flex items-center gap-1.5 text-white/80">
                  <Calendar size={12} className="text-white/40" />
                  <span>{invite.date}</span>
                </div>

                <div className="flex items-center gap-1.5 text-white/80">
                  <Clock size={12} className="text-white/40" />
                  <span>{invite.time}</span>
                </div>

                <div className="flex items-center gap-1.5 text-white/60">
                  <Users size={12} className="text-white/40" />
                  <span>Convidados: {invite.invitedUsers.join(", ")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
            <button
              onClick={() => onDismiss(invite.id)}
              className="px-3 py-1.5 text-xs font-sans text-white/40 hover:text-white transition-colors cursor-pointer"
            >
              Ocultar aviso
            </button>

            <button
              onClick={() => onAcceptAndOpen(invite.eventId)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black font-sans font-bold text-xs hover:bg-white/90 transition-all rounded-sm shadow-md cursor-pointer"
            >
              <span>Abrir Ficha da Reunião</span>
              <ArrowRight size={13} />
            </button>
          </div>

        </div>
      </motion.div>
    </AnimatePresence>
  );
}
