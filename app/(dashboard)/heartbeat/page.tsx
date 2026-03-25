"use client";

import { useState, useEffect, useCallback } from "react";

interface HeartbeatEntry {
  id: string;
  timestamp: string;
  type: "ok" | "action" | "alert" | "task";
  summary: string;
  details?: string;
  taskName?: string;
}

type FilterType = "all" | "ok" | "action" | "task" | "alert";

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const ICONS: Record<string, string> = {
  ok: "✅",
  action: "⚡",
  task: "📋",
  alert: "🚨",
};

const BADGE_STYLE: Record<string, { bg: string; color: string }> = {
  ok:     { bg: "rgba(152,152,160,0.15)", color: "#9898a0" },
  action: { bg: "rgba(77,124,254,0.15)",  color: "#4d7cfe" },
  task:   { bg: "rgba(124,92,252,0.15)",  color: "#7c5cfc" },
  alert:  { bg: "rgba(240,91,91,0.15)",   color: "#f05b5b" },
};

const FILTER_TABS: { id: FilterType; label: string }[] = [
  { id: "all",    label: "All"    },
  { id: "ok",     label: "OK"     },
  { id: "action", label: "Action" },
  { id: "task",   label: "Task"   },
  { id: "alert",  label: "Alert"  },
];

export default function HeartbeatPage() {
  const [entries, setEntries] = useState<HeartbeatEntry[]>([]);
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);
  const [totalToday, setTotalToday] = useState(0);
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/heartbeat");
      if (!res.ok) return;
      const data = await res.json();
      setEntries(data.entries ?? []);
      setLastHeartbeat(data.lastHeartbeat ?? null);
      setTotalToday(data.totalToday ?? 0);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Count actions taken today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const actionsToday = entries.filter(
    (e) => e.type !== "ok" && new Date(e.timestamp) >= todayStart
  ).length;

  const filtered =
    filter === "all" ? entries : entries.filter((e) => e.type === filter);

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 px-6 py-5 border-b"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <h1
          className="text-xl font-bold tracking-widest uppercase mb-4"
          style={{ color: "#ffffff", letterSpacing: "0.15em" }}
        >
          HEARTBEAT LOG
        </h1>

        {/* Stats bar */}
        <div className="flex gap-6">
          <div
            className="px-4 py-2.5 rounded-lg border"
            style={{
              background: "var(--bg-elevated)",
              borderColor: "var(--border-subtle)",
            }}
          >
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "#ffffff", opacity: 0.6, fontSize: "0.6rem" }}>
              Total Today
            </div>
            <div className="text-2xl font-bold" style={{ color: "#ffffff" }}>
              {totalToday}
            </div>
          </div>

          <div
            className="px-4 py-2.5 rounded-lg border"
            style={{
              background: "var(--bg-elevated)",
              borderColor: "var(--border-subtle)",
            }}
          >
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "#ffffff", opacity: 0.6, fontSize: "0.6rem" }}>
              Last Heartbeat
            </div>
            <div className="text-2xl font-bold" style={{ color: "#ffffff" }}>
              {lastHeartbeat ? relativeTime(lastHeartbeat) : "—"}
            </div>
          </div>

          <div
            className="px-4 py-2.5 rounded-lg border"
            style={{
              background: "var(--bg-elevated)",
              borderColor: "var(--border-subtle)",
            }}
          >
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "#ffffff", opacity: 0.6, fontSize: "0.6rem" }}>
              Actions Today
            </div>
            <div className="text-2xl font-bold" style={{ color: "#ffffff" }}>
              {actionsToday}
            </div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div
        className="flex-shrink-0 flex gap-1 px-6 py-3 border-b"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        {FILTER_TABS.map((tab) => {
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={{
                background: active ? "var(--accent-purple)" : "var(--bg-elevated)",
                color: active ? "#ffffff" : "#ffffff",
                opacity: active ? 1 : 0.6,
                border: active ? "1px solid transparent" : "1px solid var(--border-subtle)",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 fab-scroll-pad">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <p style={{ color: "#ffffff", opacity: 0.5 }}>Loading…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="text-4xl mb-4">💓</div>
            <p className="text-sm" style={{ color: "#ffffff" }}>
              No heartbeat activity yet — I&apos;ll log every check here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((entry) => {
              const badge = BADGE_STYLE[entry.type] ?? BADGE_STYLE.ok;
              return (
                <div
                  key={entry.id}
                  className="flex gap-3 rounded-lg p-4 border"
                  style={{
                    background: "var(--bg-elevated)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  {/* Icon */}
                  <div className="flex-shrink-0 text-lg leading-none pt-0.5">
                    {ICONS[entry.type] ?? "✅"}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {/* Type badge */}
                      <span
                        className="px-2 py-0.5 rounded text-xs font-semibold uppercase"
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          fontSize: "0.6rem",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {entry.type}
                      </span>

                      {/* Relative time */}
                      <span
                        className="ml-auto text-xs flex-shrink-0"
                        style={{ color: "#ffffff", opacity: 0.5, fontSize: "0.7rem" }}
                      >
                        {relativeTime(entry.timestamp)}
                      </span>
                    </div>

                    {/* Summary */}
                    <p
                      className="font-medium leading-snug"
                      style={{ color: "#ffffff", fontSize: "14px" }}
                    >
                      {entry.summary}
                    </p>

                    {/* Details */}
                    {entry.details && (
                      <p
                        className="mt-1 leading-snug"
                        style={{ color: "#ffffff", fontSize: "12px", opacity: 0.7 }}
                      >
                        {entry.details}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
