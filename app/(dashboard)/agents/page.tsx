"use client";

import { useState, useEffect, useCallback } from "react";
import { Cpu, RefreshCw, Clock, ChevronDown, ChevronRight, Zap } from "lucide-react";

interface Agent {
  id: string;
  sessionKey?: string;
  name: string;
  emoji: string;
  role: string;
  model?: string;
  status: string;
  statusText?: string | null;
  taskSummary?: string;
  startedAt?: string;
  updatedAt?: string;
  lastActiveAt?: string | null;
  characterConfig?: Record<string, unknown>;
  recentHeartbeats: { timestamp: string; type: string; summary: string }[];
  tasks: { id: string; title: string; status: string }[];
}

function statusColor(status: string): string {
  switch (status) {
    case "active": case "running": return "var(--accent-green)";
    case "idle": return "var(--text-tertiary)";
    case "standby": case "scheduled": return "var(--accent-blue)";
    case "needs_review": return "var(--accent-yellow)";
    case "blocked": case "failed": return "var(--accent-red)";
    case "completed": return "var(--accent-green)";
    default: return "var(--text-tertiary)";
  }
}

function statusBg(status: string): string {
  switch (status) {
    case "active": case "running": return "rgba(38,201,122,0.1)";
    case "needs_review": return "rgba(240,180,41,0.1)";
    case "blocked": case "failed": return "rgba(240,91,91,0.1)";
    case "standby": case "scheduled": return "rgba(77,124,254,0.1)";
    default: return "var(--bg-tertiary)";
  }
}

function timeAgo(dateStr: string | undefined | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function roleColor(role: string): string {
  if (role.toLowerCase().includes("primary")) return "var(--accent-purple)";
  if (role.toLowerCase().includes("dedicated")) return "var(--accent-blue)";
  return "var(--accent-green)";
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setAgents(json.agents || []);
    } catch {
      // keep existing data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 30000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  const activeCount = agents.filter((a) => ["active", "running"].includes(a.status)).length;
  const idleCount = agents.filter((a) => a.status === "idle").length;
  const reviewCount = agents.filter((a) => a.status === "needs_review").length;

  if (loading) {
    return (
      <div style={{ padding: "32px" }}>
        <div style={{ height: "32px", width: "200px", background: "var(--bg-tertiary)", borderRadius: "8px", marginBottom: "24px" }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ height: "120px", background: "var(--bg-secondary)", borderRadius: "12px", border: "1px solid var(--border-subtle)", marginBottom: "12px" }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: "1200px" }} className="fab-scroll-pad">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>Agents</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            {agents.length} agents · {activeCount} active · {idleCount} idle
            {reviewCount > 0 && <span style={{ color: "var(--accent-yellow)" }}> · {reviewCount} needs review</span>}
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchAgents(); }}
          style={{
            display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px",
            borderRadius: "8px", border: "1px solid var(--border-subtle)",
            background: "var(--bg-secondary)", color: "var(--text-secondary)", cursor: "pointer", fontSize: "13px",
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "Active", value: activeCount, color: "var(--accent-green)" },
          { label: "Idle", value: idleCount, color: "var(--text-tertiary)" },
          { label: "Needs Review", value: reviewCount, color: "var(--accent-yellow)" },
          { label: "Total", value: agents.length, color: "var(--accent-purple)" },
        ].map((stat) => (
          <div key={stat.label} style={{
            padding: "16px", background: "var(--bg-secondary)", borderRadius: "10px",
            border: "1px solid var(--border-subtle)", textAlign: "center",
          }}>
            <div style={{ fontSize: "24px", fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "4px" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Agent Cards */}
      {agents.length === 0 ? (
        <div style={{
          padding: "60px 20px", textAlign: "center",
          background: "var(--bg-secondary)", borderRadius: "12px", border: "1px solid var(--border-subtle)",
        }}>
          <Cpu size={32} style={{ color: "var(--text-tertiary)", marginBottom: "12px" }} />
          <div style={{ color: "var(--text-secondary)", fontSize: "15px", marginBottom: "4px" }}>No agents registered</div>
          <div style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>Agents will appear here when they connect to Mission Control</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {agents.map((agent) => {
            const expanded = expandedId === agent.id;
            return (
              <div
                key={agent.id}
                style={{
                  background: "var(--bg-secondary)", borderRadius: "12px",
                  border: "1px solid var(--border-subtle)", overflow: "hidden",
                }}
              >
                {/* Agent Header */}
                <div
                  onClick={() => setExpandedId(expanded ? null : agent.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: "14px", padding: "18px 20px",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: "28px", flexShrink: 0 }}>{agent.emoji || "🤖"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 600, fontSize: "15px", color: "var(--text-primary)" }}>{agent.name}</span>
                      <span style={{
                        fontSize: "11px", padding: "2px 10px", borderRadius: "99px",
                        background: statusBg(agent.status), color: statusColor(agent.status),
                        fontWeight: 500, textTransform: "capitalize",
                      }}>
                        {agent.status.replace(/_/g, " ")}
                      </span>
                      <span style={{
                        fontSize: "11px", padding: "2px 8px", borderRadius: "4px",
                        background: "var(--bg-tertiary)", color: roleColor(agent.role),
                      }}>
                        {agent.role}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "var(--text-tertiary)" }}>
                      {agent.model && <span><Zap size={11} style={{ marginRight: "4px", verticalAlign: "middle" }} />{agent.model}</span>}
                      <span><Clock size={11} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                        Last active: {timeAgo(agent.lastActiveAt || agent.updatedAt)}
                      </span>
                      {agent.taskSummary && (
                        <span style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {agent.taskSummary}
                        </span>
                      )}
                    </div>
                  </div>
                  {expanded ? <ChevronDown size={18} style={{ color: "var(--text-tertiary)" }} /> : <ChevronRight size={18} style={{ color: "var(--text-tertiary)" }} />}
                </div>

                {/* Expanded Detail */}
                {expanded && (
                  <div style={{ padding: "0 20px 18px", borderTop: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", paddingTop: "16px" }}>
                      {/* Recent Heartbeats */}
                      <div>
                        <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "10px" }}>
                          Recent Events
                        </h3>
                        {agent.recentHeartbeats.length === 0 ? (
                          <div style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>No recent heartbeats</div>
                        ) : (
                          agent.recentHeartbeats.map((hb, i) => (
                            <div key={i} style={{
                              display: "flex", alignItems: "center", gap: "8px",
                              padding: "6px 0", borderBottom: "1px solid var(--border-subtle)",
                              fontSize: "12px",
                            }}>
                              <div style={{
                                width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0,
                                background: hb.type === "error" ? "var(--accent-red)" : hb.type === "ok" ? "var(--accent-green)" : "var(--accent-blue)",
                              }} />
                              <span style={{ color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {hb.summary}
                              </span>
                              <span style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>{timeAgo(hb.timestamp)}</span>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Assigned Tasks */}
                      <div>
                        <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "10px" }}>
                          Assigned Tasks
                        </h3>
                        {agent.tasks.length === 0 ? (
                          <div style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>No assigned tasks</div>
                        ) : (
                          agent.tasks.map((task) => (
                            <div key={task.id} style={{
                              display: "flex", justifyContent: "space-between", alignItems: "center",
                              padding: "6px 0", borderBottom: "1px solid var(--border-subtle)",
                              fontSize: "12px",
                            }}>
                              <span style={{ color: "var(--text-primary)" }}>{task.title}</span>
                              <span style={{
                                fontSize: "10px", padding: "2px 6px", borderRadius: "4px",
                                background: "var(--bg-elevated)", color: "var(--text-tertiary)",
                                textTransform: "capitalize",
                              }}>
                                {task.status.replace(/-/g, " ")}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Agent Details */}
                    <div style={{
                      marginTop: "16px", padding: "12px", background: "var(--bg-tertiary)", borderRadius: "8px",
                      display: "flex", gap: "24px", fontSize: "12px", color: "var(--text-tertiary)", flexWrap: "wrap",
                    }}>
                      <span>ID: <code style={{ color: "var(--text-secondary)" }}>{agent.id.slice(0, 16)}...</code></span>
                      {agent.sessionKey && <span>Session: <code style={{ color: "var(--text-secondary)" }}>{agent.sessionKey.slice(0, 12)}...</code></span>}
                      <span>Started: {agent.startedAt ? new Date(agent.startedAt).toLocaleString() : "—"}</span>
                      <span>Updated: {agent.updatedAt ? new Date(agent.updatedAt).toLocaleString() : "—"}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
