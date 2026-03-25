"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  CalendarDays,
  Sun,
} from "lucide-react";
import { CronJob } from "@/lib/types";

// ─── Color palette (warm/earthy/muted) ──────────────────────────────────────

const JOB_COLORS = [
  { bg: "#5c3d1e", text: "#f5c87a", accent: "#d4a03a" },
  { bg: "#1e4a3a", text: "#6ee7b7", accent: "#34d399" },
  { bg: "#4a3520", text: "#fbbf6a", accent: "#f59e0b" },
  { bg: "#3b1f4a", text: "#c4a5f0", accent: "#a78bfa" },
  { bg: "#1e3a4a", text: "#7dd3fc", accent: "#38bdf8" },
  { bg: "#4a3b1e", text: "#e5c76e", accent: "#d4a03a" },
  { bg: "#4a1e2a", text: "#f9a8c9", accent: "#f472b6" },
  { bg: "#2a4a1e", text: "#a3d977", accent: "#84cc16" },
  { bg: "#3d3520", text: "#d4b483", accent: "#c49a5c" },
  { bg: "#1e2e4a", text: "#93b5f5", accent: "#6b8de3" },
  { bg: "#4a2020", text: "#f5a0a0", accent: "#ef4444" },
  { bg: "#2a3a2a", text: "#95c895", accent: "#4ade80" },
];

function getJobColor(name: string, colorMap: Map<string, number>): (typeof JOB_COLORS)[0] {
  let idx = colorMap.get(name);
  if (idx === undefined) {
    idx = colorMap.size % JOB_COLORS.length;
    colorMap.set(name, idx);
  }
  return JOB_COLORS[idx];
}

// ─── Schedule parsing helpers ────────────────────────────────────────────────

interface ParsedSchedule {
  kind: "every" | "cron";
  expr?: string;
  everyMs?: number;
}

function normalizeSchedule(schedule: CronJob["schedule"]): ParsedSchedule {
  if (!schedule) return { kind: "cron", expr: "" };
  if (typeof schedule === "string") return { kind: "cron", expr: schedule };
  return {
    kind: (schedule.kind as "every" | "cron") || "cron",
    expr: schedule.expr,
    everyMs: (schedule as Record<string, unknown>).everyMs as number | undefined,
  };
}

function isAlwaysRunning(schedule: CronJob["schedule"]): boolean {
  const s = normalizeSchedule(schedule);
  if (s.kind === "every") return true;
  if (!s.expr) return false;
  const parts = s.expr.trim().split(/\s+/);
  if (parts.length < 5) return false;
  const [min, hour] = parts;
  if (min.startsWith("*/") && hour === "*") return true;
  if (min === "*" && hour === "*") return true;
  return false;
}

function alwaysRunningLabel(schedule: CronJob["schedule"]): string {
  const s = normalizeSchedule(schedule);
  if (s.kind === "every" && s.everyMs) {
    const ms = s.everyMs;
    if (ms < 60000) return `Every ${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `Every ${Math.round(ms / 60000)} min`;
    return `Every ${Math.round(ms / 3600000)}h`;
  }
  if (!s.expr) return "Continuous";
  const parts = s.expr.trim().split(/\s+/);
  if (parts.length < 5) return s.expr;
  const [min, hour] = parts;
  if (min === "*" && hour === "*") return "Every minute";
  if (min.startsWith("*/")) {
    const n = parseInt(min.slice(2));
    if (n <= 0) return "Every minute";
    if (n <= 30) return `Every ${n} min`;
    return `${Math.round(1440 / n)}x daily`;
  }
  if (hour.startsWith("*/")) return `Every ${parseInt(hour.slice(2))}h`;
  return "Continuous";
}

/** Full human-readable schedule description for Today view */
function humanSchedule(schedule: CronJob["schedule"]): string {
  const s = normalizeSchedule(schedule);
  if (s.kind === "every" && s.everyMs) {
    const ms = s.everyMs;
    if (ms < 60000) return `Runs every ${Math.round(ms / 1000)} seconds`;
    if (ms < 3600000) return `Runs every ${Math.round(ms / 60000)} minutes`;
    return `Runs every ${Math.round(ms / 3600000)} hours`;
  }
  if (!s.expr) return "No schedule";
  const parts = s.expr.trim().split(/\s+/);
  if (parts.length < 5) return s.expr;
  const [min, hour, , , dow] = parts;

  // Build time part
  let timeStr: string;
  if (min.startsWith("*/")) timeStr = `every ${min.slice(2)} minutes`;
  else if (hour.startsWith("*/")) timeStr = `every ${hour.slice(2)} hours`;
  else if (hour === "*") timeStr = `every hour at :${min.padStart(2, "0")}`;
  else {
    const hours = hour.split(",").map(Number);
    const minutes = min.split(",").map(Number);
    const times: string[] = [];
    for (const h of hours) {
      for (const m of minutes) {
        times.push(formatTime(h, m));
      }
    }
    timeStr = times.join(", ");
  }

  // Build day part
  const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  let dayStr = "Daily";
  if (dow !== "*") {
    const dayNames = dow
      .split(",")
      .map((d) => {
        if (d.includes("-")) {
          const [a, b] = d.split("-").map(Number);
          return `${DAY_FULL[a]}–${DAY_FULL[b]}`;
        }
        return DAY_FULL[parseInt(d)] || d;
      });
    dayStr = dayNames.join(", ");
  }

  return `${dayStr} at ${timeStr}`;
}

function extractAllTimes(expr: string): { hour: number; minute: number }[] {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return [];
  const [minField, hourField] = parts;
  if (hourField === "*" || hourField.startsWith("*/") || minField.startsWith("*/")) return [];

  const hours = hourField.split(",").map(Number).filter((n) => !isNaN(n));
  const minutes = minField.split(",").map(Number).filter((n) => !isNaN(n));

  const times: { hour: number; minute: number }[] = [];
  for (const h of hours) {
    for (const m of minutes) {
      times.push({ hour: h, minute: m });
    }
  }
  return times.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
}

function extractTime(expr: string): { hour: number; minute: number } | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return null;
  const [min, hour] = parts;
  if (hour === "*" || hour.startsWith("*/") || min.startsWith("*/")) return null;
  const h = parseInt(hour.split(",")[0]);
  const m = parseInt(min.split(",")[0]);
  if (isNaN(h) || isNaN(m)) return null;
  return { hour: h, minute: m };
}

function formatTime(hour: number, minute: number): string {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${h}:${minute.toString().padStart(2, "0")} ${ampm}`;
}

function getDaysOfWeek(expr: string): number[] {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return [0, 1, 2, 3, 4, 5, 6];
  const dow = parts[4];
  if (dow === "*") return [0, 1, 2, 3, 4, 5, 6];

  const days = new Set<number>();
  for (const seg of dow.split(",")) {
    if (seg.includes("-")) {
      const [start, end] = seg.split("-").map(Number);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) days.add(i % 7);
      }
    } else {
      const d = parseInt(seg);
      if (!isNaN(d)) days.add(d % 7);
    }
  }
  return days.size > 0 ? Array.from(days).sort() : [0, 1, 2, 3, 4, 5, 6];
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const now = Date.now();
  const diff = now - d.getTime();

  if (diff < 0) {
    // future
    const absDiff = -diff;
    if (absDiff < 60000) return `in ${Math.round(absDiff / 1000)}s`;
    if (absDiff < 3600000) return `in ${Math.round(absDiff / 60000)}m`;
    if (absDiff < 86400000) return `in ${Math.round(absDiff / 3600000)}h`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  if (diff < 60000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ─── Calendar card type ──────────────────────────────────────────────────────

interface CalendarCard {
  name: string;
  hour: number;
  minute: number;
  timeLabel: string;
  color: (typeof JOB_COLORS)[0];
  enabled?: boolean;
  lastStatus?: string | null;
  description?: string;
  lastRun?: string | null;
  nextRun?: string | null;
  schedule: CronJob["schedule"];
  lastDurationMs?: number | null;
}

// ─── View types ──────────────────────────────────────────────────────────────

type ViewMode = "week" | "today";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function CronPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [view, setView] = useState<ViewMode>("week");

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Default to today view on mobile
      if (mobile) setView("today");
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/cron");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err) {
      console.error("Failed to fetch cron jobs:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchJobs();
  };

  const today = new Date();
  const todayDay = today.getDay();

  const weekStart = useMemo(() => {
    const d = getStartOfWeek(today);
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

  const weekLabel = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${fmt(weekStart)} – ${fmt(end)}`;
  }, [weekStart]);

  const todayLabel = useMemo(() => {
    return today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Separate always-running vs scheduled jobs
  const { alwaysRunning, scheduledJobs } = useMemo(() => {
    const ar: CronJob[] = [];
    const sj: CronJob[] = [];
    for (const job of jobs) {
      if (isAlwaysRunning(job.schedule)) ar.push(job);
      else sj.push(job);
    }
    return { alwaysRunning: ar, scheduledJobs: sj };
  }, [jobs]);

  // Build calendar grid
  const { calendarGrid, colorMap } = useMemo(() => {
    const cMap = new Map<string, number>();
    const grid: CalendarCard[][] = [[], [], [], [], [], [], []];

    for (const job of scheduledJobs) {
      const s = normalizeSchedule(job.schedule);
      if (!s.expr) continue;

      const days = getDaysOfWeek(s.expr);
      const times = extractAllTimes(s.expr);
      const color = getJobColor(job.name, cMap);
      const base = {
        name: job.name,
        color,
        enabled: job.enabled,
        lastStatus: job.lastStatus ?? job.state?.lastRunStatus ?? job.state?.lastStatus ?? null,
        description: job.description,
        lastRun: job.lastRun ?? (job.state?.lastRunAtMs ? new Date(job.state.lastRunAtMs).toISOString() : null),
        nextRun: job.nextRun ?? (job.state?.nextRunAtMs ? new Date(job.state.nextRunAtMs).toISOString() : null),
        schedule: job.schedule,
        lastDurationMs: job.state?.lastDurationMs ?? null,
      };

      const timesToUse = times.length > 0 ? times : (() => {
        const t = extractTime(s.expr);
        return t ? [t] : [];
      })();

      for (const day of days) {
        for (const t of timesToUse) {
          grid[day].push({
            ...base,
            hour: t.hour,
            minute: t.minute,
            timeLabel: formatTime(t.hour, t.minute),
          });
        }
      }
    }

    for (const job of alwaysRunning) getJobColor(job.name, cMap);
    for (const dayCards of grid) dayCards.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));

    return { calendarGrid: grid, colorMap: cMap };
  }, [scheduledJobs, alwaysRunning]);

  // ─── Loading state ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "var(--text-tertiary)" }}>
        <RefreshCw size={20} className="animate-spin mr-2" />
        Loading scheduled tasks…
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "10px 14px" : "16px 24px", flexShrink: 0, borderBottom: "1px solid var(--border-subtle)", gap: 12, flexWrap: isMobile ? "wrap" : "nowrap" }}
      >
        <div>
          <h1 style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Scheduled Tasks
          </h1>
          {!isMobile && <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: "2px 0 0" }}>Douglas&apos;s automated routines</p>}
        </div>

        <div className="flex items-center gap-3" style={{ flexShrink: 0 }}>
          {/* Week nav (only in week view) */}
          {view === "week" && !isMobile && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setWeekOffset((w) => w - 1)}
                className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                <ChevronLeft size={16} />
              </button>
              <span
                className="text-xs font-medium min-w-[130px] text-center"
                style={{ color: "var(--text-secondary)" }}
              >
                {weekLabel}
              </span>
              <button
                onClick={() => setWeekOffset((w) => w + 1)}
                className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Today label (only in today view) */}
          {view === "today" && !isMobile && (
            <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              {todayLabel}
            </span>
          )}

          {/* Jump to today (week view only) */}
          {view === "week" && weekOffset !== 0 && !isMobile && (
            <button
              onClick={() => setWeekOffset(0)}
              className="px-2.5 py-1 text-xs font-medium rounded-md transition-colors hover:bg-[rgba(124,92,252,0.1)]"
              style={{ color: "var(--accent-purple)", border: "1px solid var(--accent-purple)" }}
            >
              Today
            </button>
          )}

          {/* View toggle */}
          <div
            className="flex items-center rounded-lg overflow-hidden"
            style={{ border: "1px solid var(--border-default)" }}
          >
            <button
              onClick={() => setView("week")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                background: view === "week" ? "var(--accent-purple)" : "transparent",
                color: view === "week" ? "#fff" : "var(--text-secondary)",
              }}
            >
              <CalendarDays size={13} />
              Week
            </button>
            <button
              onClick={() => setView("today")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                background: view === "today" ? "var(--accent-purple)" : "transparent",
                color: view === "today" ? "#fff" : "var(--text-secondary)",
              }}
            >
              <Sun size={13} />
              Today
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ── Always Running pills ─────────────────────────────────────── */}
      {alwaysRunning.length > 0 && (
        <div
          className="flex items-center gap-3 px-6 py-4 flex-shrink-0 border-b overflow-x-auto"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="flex items-center gap-1.5 mr-2 flex-shrink-0">
            <Sparkles size={14} style={{ color: "var(--accent-yellow)" }} />
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-tertiary)" }}
            >
              Always Running
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {alwaysRunning.map((job) => {
              const color = getJobColor(job.name, colorMap);
              return (
                <span
                  key={job.name}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap"
                  style={{ background: color.bg, color: color.text }}
                >
                  <span className="font-semibold">{job.name}</span>
                  <span style={{ opacity: 0.7 }}>•</span>
                  <span style={{ opacity: 0.8 }}>{alwaysRunningLabel(job.schedule)}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── WEEK VIEW ────────────────────────────────────────────────── */}
      {view === "week" && (
        <div className="flex-1 flex overflow-hidden">
          {DAY_NAMES.map((dayName, dayIndex) => {
            const isToday = weekOffset === 0 && dayIndex === todayDay;
            const cards = calendarGrid[dayIndex];

            return (
              <div
                key={dayName}
                className="flex-1 flex flex-col min-w-0 border-r last:border-r-0"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                {/* Day header */}
                <div
                  className="flex items-center justify-center py-4 flex-shrink-0 border-b"
                  style={{
                    borderColor: "var(--border-subtle)",
                    background: isToday ? "rgba(124, 92, 252, 0.12)" : "var(--bg-secondary)",
                  }}
                >
                  <span
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: isToday ? "var(--accent-purple)" : "var(--text-tertiary)" }}
                  >
                    {dayName}
                  </span>
                  {isToday && (
                    <span
                      className="ml-1.5 w-1.5 h-1.5 rounded-full"
                      style={{ background: "var(--accent-purple)" }}
                    />
                  )}
                </div>

                {/* Cards column */}
                <div
                  className="flex-1 overflow-y-auto p-2.5 space-y-3"
                  style={{ background: "var(--bg-primary)" }}
                >
                  {cards.length === 0 ? (
                    <div
                      className="flex items-center justify-center h-full"
                      style={{ color: "var(--text-tertiary)", opacity: 0.3 }}
                    >
                      <span className="text-xs">—</span>
                    </div>
                  ) : (
                    cards.map((card, i) => (
                      <div
                        key={`${card.name}-${card.hour}-${card.minute}-${i}`}
                        className="rounded-lg px-3.5 py-3.5 cursor-default transition-transform hover:scale-[1.02]"
                        style={{
                          background: card.color.bg,
                          opacity: card.enabled === false ? 0.4 : 1,
                          minHeight: "54px",
                        }}
                      >
                        <div
                          className="text-sm font-semibold truncate leading-tight"
                          style={{ color: card.color.text }}
                          title={card.name}
                        >
                          {card.name}
                        </div>
                        <div
                          className="text-xs mt-1 font-medium"
                          style={{ color: card.color.text, opacity: 0.7 }}
                        >
                          {card.timeLabel}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TODAY VIEW ───────────────────────────────────────────────── */}
      {view === "today" && (
        <TodayView
          cards={calendarGrid[todayDay]}
          alwaysRunningJobs={alwaysRunning}
          colorMap={colorMap}
        />
      )}
    </div>
  );
}

// ─── Today View Component ────────────────────────────────────────────────────

function TodayView({
  cards,
  alwaysRunningJobs,
  colorMap,
}: {
  cards: CalendarCard[];
  alwaysRunningJobs: CronJob[];
  colorMap: Map<string, number>;
}) {
  // Deduplicate cards by job name (in Today view, show one expanded card per job
  // even if it runs at multiple times — list all times inside the card)
  const groupedCards = useMemo(() => {
    const map = new Map<string, CalendarCard & { allTimes: string[] }>();
    for (const card of cards) {
      const existing = map.get(card.name);
      if (existing) {
        existing.allTimes.push(card.timeLabel);
      } else {
        map.set(card.name, { ...card, allTimes: [card.timeLabel] });
      }
    }
    return Array.from(map.values());
  }, [cards]);

  // Current hour for timeline marker
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  if (groupedCards.length === 0 && alwaysRunningJobs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: "var(--text-tertiary)" }}>
        <div className="text-center">
          <CalendarDays size={40} className="mx-auto mb-3" style={{ opacity: 0.3 }} />
          <p className="text-sm">No scheduled tasks for today</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto fab-scroll-pad">
      <div className="max-w-4xl mx-auto px-6 py-5">
        {/* Timeline header */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-full"
            style={{ background: "rgba(124, 92, 252, 0.15)" }}
          >
            <Clock size={16} style={{ color: "var(--accent-purple)" }} />
          </div>
          <div>
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {groupedCards.length} scheduled task{groupedCards.length !== 1 ? "s" : ""} today
            </span>
            <span className="text-xs ml-2" style={{ color: "var(--text-tertiary)" }}>
              {DAY_NAMES_FULL[now.getDay()]}
            </span>
          </div>
        </div>

        {/* Timeline of cards */}
        <div className="relative">
          {/* Vertical timeline line */}
          <div
            className="absolute left-[19px] top-0 bottom-0 w-px"
            style={{ background: "var(--border-subtle)" }}
          />

          <div className="space-y-4">
            {groupedCards.map((card, i) => {
              const isPast = card.hour < currentHour || (card.hour === currentHour && card.minute < currentMinute);
              const isCurrent = card.hour === currentHour;
              const statusColor =
                card.lastStatus === "success" ? "#26c97a" :
                card.lastStatus === "failed" ? "#f05b5b" :
                card.lastStatus === "ok" ? "#26c97a" :
                card.lastStatus === "running" ? "#7c5cfc" :
                "var(--text-tertiary)";

              return (
                <div key={`${card.name}-${i}`} className="relative flex gap-4">
                  {/* Timeline dot */}
                  <div className="relative z-10 flex-shrink-0 mt-4">
                    <div
                      className="w-[10px] h-[10px] rounded-full border-2"
                      style={{
                        borderColor: isCurrent ? "var(--accent-purple)" : isPast ? card.color.accent : "var(--border-default)",
                        background: isPast ? card.color.accent : isCurrent ? "var(--accent-purple)" : "var(--bg-primary)",
                        marginLeft: "14px",
                      }}
                    />
                  </div>

                  {/* Expanded card */}
                  <div
                    className="flex-1 rounded-xl p-5 transition-all hover:scale-[1.005]"
                    style={{
                      background: card.color.bg,
                      opacity: card.enabled === false ? 0.5 : 1,
                      borderLeft: `3px solid ${card.color.accent}`,
                    }}
                  >
                    {/* Top row: name + status badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3
                          className="text-base font-bold leading-tight"
                          style={{ color: card.color.text }}
                        >
                          {card.name}
                        </h3>
                        {card.description && (
                          <p
                            className="text-sm mt-1 leading-relaxed"
                            style={{ color: card.color.text, opacity: 0.7 }}
                          >
                            {card.description}
                          </p>
                        )}
                      </div>

                      {/* Status badge */}
                      {card.lastStatus && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0"
                          style={{
                            background: `${statusColor}20`,
                            color: statusColor,
                          }}
                        >
                          {card.lastStatus === "success" || card.lastStatus === "ok" ? (
                            <CheckCircle2 size={11} />
                          ) : card.lastStatus === "failed" ? (
                            <XCircle size={11} />
                          ) : card.lastStatus === "running" ? (
                            <RefreshCw size={11} className="animate-spin" />
                          ) : (
                            <Clock size={11} />
                          )}
                          {card.lastStatus === "ok" ? "success" : card.lastStatus}
                        </span>
                      )}
                    </div>

                    {/* Schedule + times */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {card.allTimes.map((t, ti) => (
                        <span
                          key={ti}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold"
                          style={{ background: "rgba(0,0,0,0.25)", color: card.color.text }}
                        >
                          <Clock size={10} style={{ opacity: 0.7 }} />
                          {t}
                        </span>
                      ))}
                    </div>

                    {/* Schedule description */}
                    <p
                      className="text-xs mt-2"
                      style={{ color: card.color.text, opacity: 0.6 }}
                    >
                      {humanSchedule(card.schedule)}
                    </p>

                    {/* Meta row: last run, next run, duration */}
                    <div
                      className="mt-3 pt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs"
                      style={{
                        borderTop: `1px solid ${card.color.text}15`,
                        color: card.color.text,
                        opacity: 0.65,
                      }}
                    >
                      {card.lastRun && (
                        <span title={formatTimestamp(card.lastRun)}>
                          <strong>Last run:</strong> {formatRelativeTime(card.lastRun)}
                        </span>
                      )}
                      {card.nextRun && (
                        <span title={formatTimestamp(card.nextRun)}>
                          <strong>Next run:</strong> {formatRelativeTime(card.nextRun)}
                        </span>
                      )}
                      {card.lastDurationMs != null && card.lastDurationMs > 0 && (
                        <span>
                          <strong>Duration:</strong>{" "}
                          {card.lastDurationMs < 1000
                            ? `${card.lastDurationMs}ms`
                            : card.lastDurationMs < 60000
                              ? `${(card.lastDurationMs / 1000).toFixed(1)}s`
                              : `${(card.lastDurationMs / 60000).toFixed(1)}m`}
                        </span>
                      )}
                      {card.enabled === false && (
                        <span style={{ color: "var(--accent-yellow)" }}>⚠ Disabled</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Always Running expanded section (in Today view, show more detail) */}
        {alwaysRunningJobs.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={15} style={{ color: "var(--accent-yellow)" }} />
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                Always Running — Detailed
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {alwaysRunningJobs.map((job) => {
                const color = getJobColor(job.name, colorMap);
                const lastRun = job.lastRun ?? (job.state?.lastRunAtMs ? new Date(job.state.lastRunAtMs).toISOString() : null);
                const nextRun = job.nextRun ?? (job.state?.nextRunAtMs ? new Date(job.state.nextRunAtMs).toISOString() : null);
                const lastStatus = job.lastStatus ?? job.state?.lastRunStatus ?? job.state?.lastStatus ?? null;
                const statusColor =
                  lastStatus === "success" || lastStatus === "ok" ? "#26c97a" :
                  lastStatus === "failed" ? "#f05b5b" :
                  lastStatus === "running" ? "#7c5cfc" :
                  "var(--text-tertiary)";

                return (
                  <div
                    key={job.name}
                    className="rounded-xl p-4"
                    style={{
                      background: color.bg,
                      borderLeft: `3px solid ${color.accent}`,
                      opacity: job.enabled === false ? 0.5 : 1,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold" style={{ color: color.text }}>
                          {job.name}
                        </h4>
                        <p className="text-xs mt-0.5" style={{ color: color.text, opacity: 0.7 }}>
                          {alwaysRunningLabel(job.schedule)}
                        </p>
                      </div>
                      {lastStatus && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ background: `${statusColor}20`, color: statusColor }}
                        >
                          {lastStatus === "success" || lastStatus === "ok" ? (
                            <CheckCircle2 size={11} />
                          ) : lastStatus === "failed" ? (
                            <XCircle size={11} />
                          ) : (
                            <Clock size={11} />
                          )}
                          {lastStatus === "ok" ? "success" : lastStatus}
                        </span>
                      )}
                    </div>
                    {job.description && (
                      <p className="text-xs mt-2" style={{ color: color.text, opacity: 0.6 }}>
                        {job.description}
                      </p>
                    )}
                    <div
                      className="mt-2 pt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px]"
                      style={{
                        borderTop: `1px solid ${color.text}15`,
                        color: color.text,
                        opacity: 0.6,
                      }}
                    >
                      {lastRun && (
                        <span title={formatTimestamp(lastRun)}>
                          <strong>Last:</strong> {formatRelativeTime(lastRun)}
                        </span>
                      )}
                      {nextRun && (
                        <span title={formatTimestamp(nextRun)}>
                          <strong>Next:</strong> {formatRelativeTime(nextRun)}
                        </span>
                      )}
                      {job.state?.lastDurationMs != null && job.state.lastDurationMs > 0 && (
                        <span>
                          <strong>Took:</strong>{" "}
                          {job.state.lastDurationMs < 1000
                            ? `${job.state.lastDurationMs}ms`
                            : `${(job.state.lastDurationMs / 1000).toFixed(1)}s`}
                        </span>
                      )}
                      {job.state?.consecutiveErrors != null && job.state.consecutiveErrors > 0 && (
                        <span style={{ color: "#f05b5b" }}>
                          ⚠ {job.state.consecutiveErrors} consecutive error{job.state.consecutiveErrors > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
