/**
 * HALOCK — Shared UI primitives.
 * Touch-first (min 44px targets), no hover-only affordances, reduced-motion aware.
 */

import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

/* ---------------- Button ---------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition select-none focus-visible-ring disabled:opacity-50 disabled:pointer-events-none";
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-gradient-to-b from-violet-glow to-violet-deep text-white shadow-lg shadow-violet-glow/25 active:scale-[0.98]",
    secondary: "glass text-slate-100 hover:bg-white/[0.08] active:scale-[0.98]",
    ghost: "text-slate-300 hover:bg-white/[0.06] active:scale-[0.98]",
    danger: "bg-red-500/90 text-white hover:bg-red-500 active:scale-[0.98]",
    success: "bg-emerald-500/90 text-white hover:bg-emerald-500 active:scale-[0.98]",
  };
  const sizes: Record<ButtonSize, string> = {
    sm: "min-h-[44px] px-4 text-sm",
    md: "min-h-[48px] px-5 text-[15px]",
    lg: "min-h-[56px] px-7 text-lg",
  };
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} disabled={disabled} {...rest}>
      {children}
    </button>
  );
}

/* ---------------- Card ---------------- */

export function Card({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`glass rounded-2xl p-5 ${className}`} {...rest}>
      {children}
    </div>
  );
}

/* ---------------- Badge ---------------- */

export function Badge({
  tone = "default",
  children,
}: {
  tone?: "default" | "success" | "warning" | "danger" | "info";
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    default: "bg-white/10 text-slate-200",
    success: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25",
    warning: "bg-amber-500/15 text-amber-300 border border-amber-500/25",
    danger: "bg-red-500/15 text-red-300 border border-red-500/25",
    info: "bg-sky-500/15 text-sky-300 border border-sky-500/25",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/* ---------------- Input / Select / Toggle ---------------- */

export function Input({
  label,
  hint,
  className = "",
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  return (
    <label className="block">
      {label && <span className="halock-label">{label}</span>}
      <input className={`halock-input ${className}`} {...rest} />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Select({
  label,
  children,
  className = "",
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="halock-label">{label}</span>}
      <select className={`halock-input appearance-none ${className}`} {...rest}>
        {children}
      </select>
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl px-1 py-2 focus-visible-ring"
    >
      {label && <span className="text-sm text-slate-200">{label}</span>}
      <span
        className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? "bg-violet-glow" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? "start-[calc(100%-1.5rem)]" : "start-1"
          }`}
        />
      </span>
    </button>
  );
}

/* ---------------- Modal ---------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("no-scroll");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("no-scroll");
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.18 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="glass-strong w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 safe-bottom max-h-[90dvh] overflow-y-auto"
            initial={{ y: reduce ? 0 : 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: reduce ? 0 : 30, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">{title}</h2>
              <button
                onClick={onClose}
                aria-label="close"
                className="rounded-full p-2 text-slate-400 hover:bg-white/10 focus-visible-ring"
              >
                <X size={20} />
              </button>
            </div>
            <div>{children}</div>
            {footer && <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Progress Ring ---------------- */

export function ProgressRing({
  ratio,
  size = 240,
  stroke = 12,
  children,
}: {
  ratio: number; // 0..1
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, ratio));
  const offset = circumference * (1 - clamped);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id="halock-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#halock-ring)"
          strokeLinecap="round"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduce ? 0 : 0.6, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/* ---------------- Empty State ---------------- */

export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      {icon && <div className="text-slate-500">{icon}</div>}
      <h3 className="text-lg font-semibold text-slate-200">{title}</h3>
      {desc && <p className="max-w-sm text-sm text-slate-400">{desc}</p>}
      {action}
    </div>
  );
}

/* ---------------- Stat tile ---------------- */

export function StatTile({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        {icon && <span className="text-violet-glow/80">{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-bold tnum">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
