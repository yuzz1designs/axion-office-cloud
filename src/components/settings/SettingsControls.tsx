import type { ComponentType, ReactNode } from "react";
import { Check } from "lucide-react";
import { motion } from "motion/react";
import type { AccentColorOption, AccentColorToken } from "../../types/settings";

interface SettingsSectionProps {
  id?: string;
  title: string;
  description?: string;
  badge?: string;
  children: ReactNode;
  className?: string;
}

export function SettingsSection({ id, title, description, badge, children, className = "" }: SettingsSectionProps) {
  return (
    <motion.section id={id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className={`relative flex flex-col gap-6 rounded-3xl border border-white/[0.08] bg-[#0d121c]/70 p-6 shadow-xl backdrop-blur-xl md:p-8 ${className}`}>
      <div className="flex flex-col gap-1 border-b border-white/[0.06] pb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-white md:text-xl">{title}</h2>
          {badge && <span className="rounded-full border border-[var(--axion-accent)]/20 bg-[var(--axion-accent)]/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-[var(--axion-accent)]">{badge}</span>}
        </div>
        {description && <p className="max-w-2xl text-xs leading-relaxed text-white/50 md:text-sm">{description}</p>}
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </motion.section>
  );
}

interface SettingsRowProps {
  label: string;
  description?: string;
  children: ReactNode;
}

export function SettingsRow({ label, description, children }: SettingsRowProps) {
  return (
    <div className="flex flex-col justify-between gap-4 border-b border-white/[0.04] py-3 last:border-0 sm:flex-row sm:items-center">
      <div className="flex max-w-md flex-col gap-0.5">
        <span className="text-sm font-medium tracking-wide text-white/90">{label}</span>
        {description && <span className="text-xs leading-normal text-white/40">{description}</span>}
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
}

interface SegmentedProps<T extends string | number> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  id?: string;
}

export function SettingsSegmentedControl<T extends string | number>({ options, value, onChange, id }: SegmentedProps<T>) {
  return (
    <div id={id} className="inline-flex gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-1">
      {options.map((option) => {
        const selected = value === option.value;
        const Icon = option.icon;
        return (
          <button key={String(option.value)} type="button" onClick={() => onChange(option.value)} className={`relative flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors ${selected ? "text-white" : "text-white/40 hover:text-white/80"}`}>
            {selected && <motion.span layoutId={`segment-${id || "settings"}`} className="absolute inset-0 rounded-xl border border-white/10 bg-white/[0.12]" transition={{ type: "spring", stiffness: 400, damping: 35 }} />}
            {Icon && <Icon size={14} className="relative z-10" />}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

interface ColorPickerProps {
  options: AccentColorOption[];
  value: AccentColorToken;
  onChange: (value: AccentColorToken) => void;
  allowedTokens?: AccentColorToken[];
}

export function SettingsColorPicker({ options, value, onChange, allowedTokens }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {options.filter((option) => !allowedTokens || allowedTokens.includes(option.id)).map((option) => {
        const selected = value === option.id;
        return (
          <button key={option.id} type="button" onClick={() => onChange(option.id)} className={`group flex items-center gap-2.5 rounded-2xl border px-3 py-2 transition-all ${selected ? "border-white/30 bg-white/[0.08] shadow-lg" : "border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]"}`}>
            <span className="flex h-4 w-4 items-center justify-center rounded-full transition-transform group-hover:scale-110" style={{ backgroundColor: option.hex, boxShadow: selected ? `0 0 10px ${option.hex}` : "none" }}>{selected && <Check size={10} className="stroke-[3] text-[#050609]" />}</span>
            <span className={`text-xs font-medium ${selected ? "font-semibold text-white" : "text-white/60 group-hover:text-white"}`}>{option.name}</span>
          </button>
        );
      })}
    </div>
  );
}
