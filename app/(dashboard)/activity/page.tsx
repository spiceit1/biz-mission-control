"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  RefreshCw,
  Filter,
  Cpu,
  ClipboardList,
  Heart,
  Calendar,
  Brain,
  FileText,
  AlertTriangle,
  CheckCircle,
  Zap,
} from "lucide-react";

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  agentId?: string | null;
  timestamp: string;
  source: "activity" | "heartbeat";
  metadata?: Record<string, unknown>;
}

const EVENT_TYPES = [
  { value: "", label: "All Events" },
  { value: "agent_spawned", label: "Agent Spawned" },
  { value: "task_started", label: "Task Started" },
  { value: "task_completed", label: "Task Completed" },
  { value: "heartbeat_fired", label: "Heartbeat" },
  { value: "cron_fired", label: "Cron Fired" },
  { value: "memory_changed", label: "Memory Changed" },
  { value: "document_changed", label: "Document Changed" },
  { value: "error", label: "Error" },
  { value: "review_requested", label: "Review Requested" },
];

function eventIcon(type: string) {
  switch (type) {
    case "agent_spawned": return <Cpu size={14} />;
    case "task_started": case "task_completed": case "task_created": case "task_moved": return <ClipboardList size={14} />;
    case "heartbeat_fired": return <Heart size={14} />;
    case "cron_fired": return <Calendar size={14} />;
    case "memory_changed": return <Brain size={14} />;
    case "document_changed": return <FileText size={14} />;
    case "error": return <AlertTriangle size={14} />;
    case "review_requested": return <CheckCircle size={14} />;
    default: return <Zap size={14} />;
  }
}

function eventColor(type: string): string {
  switch (type) {
    case "error": return "var(--accent-red)";
    case "review_requested": return "var(--accent-yellow)";
    case "task_completed": return "var(--accent-green)";
    case "heartbeat_fired": return "var(--accent-green)";
    case "agent_spawned": return "var(--accent-blue)";
    case "cron_fired": return "var(--accent-purple)";
    default: return "var(--text-tertiary)";
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");

  const fetchActivity = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
      if (agentFilter) params.set("agent", agentFilter);
      params.set("limit", "100");
      const res = await fetch(`/api/activity?${params}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setItems(json.items || []);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, [typeFilter, agentFilter]);

  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 30000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  // Get unique agents for filter
  const agents = [...new Set(items.map((i) => i.agentId).filter(Boolean))] as string[];

  // Group by date
  const grouped: Record<string, ActivityItem[]> = {};
  for (const item of items) {
    const date = new Date(item.timestamp).toLocaleDateString("en-US", {
      weekday: "long", month: "short", day: "numeric",
    });
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(item);
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: "1000px" }} className="fab-scroll-pad">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>Activity Feed</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Live event stream · auto-refreshes every 30s
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchActivity(); }}
          style={{
            display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px",
            borderRadius: "8px", border: "1px solid var(--border-subtle)",
            background: "var(--bg-secondary)", color: "var(--text-secondary)", cursor: "pointer", fontSize: "13px",
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div style={{
        display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap",
        alignItems: "center",
      }}>
        <Filter size={14} style={{ color: "var(--text-tertiary)" }} />
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setLoading(true); }}
          style={{
            padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--border-subtle)",
            background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "13px",
          }}
        >
          {EVENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          value={agentFilter}
          onChange={(e) => { setAgentFilter(e.target.value); setLoading(true); }}
          style={{
            padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--border-subtle)",
            background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "13px",
          }}
        >
          <option value="">All Agents</option>
          {agents.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* Feed */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ height: "60px", background: "var(--bg-secondary)", borderRadius: "10px" }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div style={{
          padding: "60px 20px", textAlign: "center",
          background: "var(--bg-secondary)", borderRadius: "12px", border: "1px solid var(--border-subtle)",
        }}>
          <Activity size={32} style={{ color: "var(--text-tertiary)", marginBottom: "12px" }} />
          <div style={{ color: "var(--text-secondary)", fontSize: "15px", marginBottom: "4px" }}>No activity yet</div>
          <div style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>
            Events from agents, heartbeats, cron jobs, and more will appear here
          </div>
        </div>
      ) : (
        Object.entries(grouped).map(([date, dateItems]) => (
          <div key={date} style={{ marginBottom: "24px" }}>
            <div style={{
              fontSize: "12px", fontWeight: 600, color: "var(--text-tertiary)",
              textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px",
              paddingBottom: "6px", borderBottom: "1px solid var(--border-subtle)",
            }}>
              {date}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {dateItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: "12px",
                    padding: "12px 16px",
                    background: "var(--bg-secondary)",
                    borderRadius: "8px",
                    border: "1px solid var(--border-subtle)",
                    marginBottom: "4px",
                  }}
                >
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: "28px", height: "28px", borderRadius: "8px", flexShrink: 0,
                    background: `${eventColor(item.type)}15`,
                    color: eventColor(item.type),
                  }}>
                    {eventIcon(item.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
                        {item.title || "Event"}
                      </span>
                      <span style={{
                        fontSize: "10px", padding: "1px 6px", borderRadius: "4px",
                        background: "var(--bg-tertiary)", color: "var(--text-tertiary)",
                        textTransform: "capitalize",
                      }}>
                        {item.type.replace(/_/g, " ")}
                      </span>
                    </div>
                    {item.description && (
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                        {item.description}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "12px", marginTop: "4px", fontSize: "11px", color: "var(--text-tertiary)" }}>
                      <span>{timeAgo(item.timestamp)}</span>
                      {item.agentId && <span>Agent: {item.agentId}</span>}
                      <span>{item.source}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
