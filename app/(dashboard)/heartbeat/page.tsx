"use client";

import { useState, useEffect, useCallback } from "react";
import { Heart, RefreshCw, AlertTriangle } from "lucide-react";

interface HeartbeatEntry {
  id: string;
  timestamp: string;
  type: "ok" | "action" | "alert" | "task" | "error";
  summary: string;
  details?: string;
  taskName?: string;
}

type FilterType = "all" | "ok" | "action" | "task" | "alert" | "error";

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const ICONS: Record<string, string> = {
  ok: "✅", action: "⚡", task: "📋", alert: "🚨", error: "❌",
};

const BADGE_STYLE: Record<string, { bg: string; color: string }> = {
  ok:     { bg: "rgba(38,201,122,0.15)",  color: "var(--accent-green)" },
  action: { bg: "rgba(77,124,254,0.15)",  color: "var(--accent-blue)" },
  task:   { bg: "rgba(124,92,252,0.15)",  color: "var(--accent-purple)" },
  alert:  { bg: "rgba(240,180,41,0.15)",  color: "var(--accent-yellow)" },
  error:  { bg: "rgba(240,91,91,0.15)",   color: "var(--accent-red)" },
};

const FILTER_TABS: { id: FilterType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ok", label: "OK" },
  { id: "action", label: "Action" },
  { id: "task", label: "Task" },
  { id: "alert", label: "Alert" },
  { id: "error", label: "Error" },
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

  // Stats
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const actionsToday = entries.filter(
    (e) => e.type !== "ok" && new Date(e.timestamp) >= todayStart
  ).length;
  const errorsToday = entries.filter(
    (e) => (e.type === "error" || e.type === "alert") && new Date(e.timestamp) >= todayStart
  ).length;

  // Calculate drift between consecutive heartbeats
  const sortedEntries = [...entries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const drifts: number[] = [];
  for (let i = 0; i < sortedEntries.length - 1; i++) {
    const diff = new Date(sortedEntries[i].timestamp).getTime() - new Date(sortedEntries[i + 1].timestamp).getTime();
    drifts.push(diff);
  }
  const avgDriftMs = drifts.length > 0 ? drifts.reduce((a, b) => a + b, 0) / drifts.length : 0;
  const maxDriftMs = drifts.length > 0 ? Math.max(...drifts) : 0;

  // Per-agent heartbeat grouping
  const agentMap: Record<string, { count: number; lastTs: string; types: Record<string, number> }> = {};
  for (const e of entries) {
    const name = e.taskName || "system";
    if (!agentMap[name]) agentMap[name] = { count: 0, lastTs: e.timestamp, types: {} };
    agentMap[name].count++;
    agentMap[name].types[e.type] = (agentMap[name].types[e.type] || 0) + 1;
    if (new Date(e.timestamp) > new Date(agentMap[name].lastTs)) {
      agentMap[name].lastTs = e.timestamp;
    }
  }

  // Timeline: last 24 hours in 1-hour buckets
  const now = Date.now();
  const hours: { hour: number; count: number; errors: number }[] = [];
  for (let i = 23; i >= 0; i--) {
    const bucketStart = now - (i + 1) * 3600000;
    const bucketEnd = now - i * 3600000;
    const inBucket = entries.filter((e) => {
      const ts = new Date(e.timestamp).getTime();
      return ts >= bucketStart && ts < bucketEnd;
    });
    hours.push({
      hour: 23 - i,
      count: inBucket.length,
      errors: inBucket.filter((e) => e.type === "error" || e.type === "alert").length,
    });
  }
  const maxCount = Math.max(1, ...hours.map((h) => h.count));

  const filtered = filter === "all" ? sortedEntries : sortedEntries.filter((e) => e.type === filter);

  // Missed heartbeat warning: if last heartbeat > 10 min ago
  const lastHbAge = lastHeartbeat ? (Date.now() - new Date(lastHeartbeat).getTime()) / 60000 : Infinity;
  const missedWarning = lastHbAge > 10;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--bg-primary)" }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: "24px 32px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
              <Heart size={20} style={{ display: "inline", marginRight: "8px", verticalAlign: "middle", color: "var(--accent-red)" }} />
              Heartbeat Monitor
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
              Agent health monitoring · auto-refreshes every 30s
            </p>
          </div>
          <button
            onClick={() => { setLoading(true); fetchData(); }}
            style={{
              display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px",
              borderRadius: "8px", border: "1px solid var(--border-subtle)",
              background: "var(--bg-secondary)", color: "var(--text-secondary)", cursor: "pointer", fontSize: "13px",
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px" }}>
          {[
            { label: "Total Today", value: totalToday, color: "var(--text-primary)" },
            { label: "Last Heartbeat", value: lastHeartbeat ? relativeTime(lastHeartbeat) : "—", color: missedWarning ? "var(--accent-red)" : "var(--text-primary)" },
            { label: "Actions Today", value: actionsToday, color: "var(--accent-blue)" },
            { label: "Errors Today", value: errorsToday, color: errorsToday > 0 ? "var(--accent-red)" : "var(--accent-green)" },
            { label: "Avg Interval", value: avgDriftMs > 0 ? `${Math.round(avgDriftMs / 60000)}m` : "—", color: "var(--text-primary)" },
            { label: "Max Gap", value: maxDriftMs > 0 ? `${Math.round(maxDriftMs / 60000)}m` : "—", color: maxDriftMs > 1800000 ? "var(--accent-yellow)" : "var(--text-primary)" },
          ].map((stat) => (
            <div key={stat.label} style={{
              padding: "14px 16px", background: "var(--bg-secondary)", borderRadius: "10px",
              border: "1px solid var(--border-subtle)",
            }}>
              <div style={{ fontSize: "11px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                {stat.label}
              </div>
              <div style={{ fontSize: "22px", fontWeight: 700, color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Missed heartbeat alert */}
        {missedWarning && (
          <div style={{
            marginTop: "12px", padding: "12px 16px", borderRadius: "8px",
            background: "rgba(240,91,91,0.1)", border: "1px solid rgba(240,91,91,0.3)",
            display: "flex", alignItems: "center", gap: "10px",
          }}>
            <AlertTriangle size={16} style={{ color: "var(--accent-red)" }} />
            <span style={{ fontSize: "13px", color: "var(--accent-red)" }}>
              Last heartbeat was {Math.round(lastHbAge)}m ago — possible missed heartbeat
            </span>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div style={{ flexShrink: 0, padding: "16px 32px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "10px" }}>
          24-Hour Timeline
        </div>
        <div style={{ display: "flex", gap: "2px", alignItems: "flex-end", height: "48px" }}>
          {hours.map((h, i) => (
            <div
              key={i}
              title={`${h.count} heartbeats, ${h.errors} errors`}
              style={{
                flex: 1,
                height: `${Math.max(4, (h.count / maxCount) * 48)}px`,
                borderRadius: "2px 2px 0 0",
                background: h.errors > 0 ? "var(--accent-red)" : h.count > 0 ? "var(--accent-green)" : "var(--bg-tertiary)",
                opacity: h.count > 0 ? 0.8 : 0.3,
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-tertiary)", marginTop: "4px" }}>
          <span>24h ago</span>
          <span>12h ago</span>
          <span>Now</span>
        </div>
      </div>

      {/* Per-Agent Summary */}
      {Object.keys(agentMap).length > 1 && (
        <div style={{ flexShrink: 0, padding: "12px 32px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px" }}>
            Per Agent/Task
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {Object.entries(agentMap).map(([name, info]) => (
              <div key={name} style={{
                padding: "6px 12px", borderRadius: "8px",
                background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)",
                fontSize: "12px",
              }}>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{name}</span>
                <span style={{ color: "var(--text-tertiary)", marginLeft: "8px" }}>{info.count} beats</span>
                <span style={{ color: "var(--text-tertiary)", marginLeft: "8px" }}>Last: {relativeTime(info.lastTs)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ flexShrink: 0, display: "flex", gap: "4px", padding: "12px 32px", borderBottom: "1px solid var(--border-subtle)" }}>
        {FILTER_TABS.map((tab) => {
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              style={{
                padding: "6px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500,
                background: active ? "var(--accent-purple)" : "var(--bg-secondary)",
                color: active ? "white" : "var(--text-secondary)",
                border: active ? "none" : "1px solid var(--border-subtle)",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Entry list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 32px" }} className="fab-scroll-pad">
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ height: "72px", background: "var(--bg-secondary)", borderRadius: "10px" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>💓</div>
            <div style={{ color: "var(--text-secondary)", fontSize: "14px" }}>No heartbeat activity yet</div>
            <div style={{ color: "var(--text-tertiary)", fontSize: "13px", marginTop: "4px" }}>
              Heartbeats will appear here as agents check in
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {filtered.map((entry) => {
              const badge = BADGE_STYLE[entry.type] ?? BADGE_STYLE.ok;
              return (
                <div
                  key={entry.id}
                  style={{
                    display: "flex", gap: "12px", padding: "14px 16px", borderRadius: "10px",
                    background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div style={{ fontSize: "18px", flexShrink: 0 }}>{ICONS[entry.type] ?? "✅"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: "4px", fontSize: "10px",
                        fontWeight: 600, textTransform: "uppercase",
                        background: badge.bg, color: badge.color,
                      }}>
                        {entry.type}
                      </span>
                      {entry.taskName && (
                        <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                          {entry.taskName}
                        </span>
                      )}
                      <span style={{ fontSize: "11px", color: "var(--text-tertiary)", marginLeft: "auto" }}>
                        {relativeTime(entry.timestamp)}
                      </span>
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>
                      {entry.summary}
                    </div>
                    {entry.details && (
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                        {entry.details}
                      </div>
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
