"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Pencil, Check, X, Loader2 } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  description: string;
  model: string;
  provider: string;
  device: string;
  status: string;
  type: string;
}

interface LiveSubagent {
  id: string;
  name: string;
  label?: string;
  model?: string;
  status: string;
  startedAt?: string;
  task?: string;
}

interface TeamData {
  mission: string;
  agents: Agent[];
  liveSubagents?: LiveSubagent[];
  lastUpdated?: string;
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  active: { color: "#26c97a", label: "Active" },
  running: { color: "#26c97a", label: "Running" },
  completed: { color: "#4d7cfe", label: "Completed" },
  standby: { color: "#f0b429", label: "Standby" },
  scheduled: { color: "#6b7280", label: "Scheduled" },
};

function StatusDot({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG["scheduled"];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: cfg.color,
          display: "inline-block",
          boxShadow: status === "active" ? `0 0 6px ${cfg.color}` : "none",
        }}
      />
      <span style={{ color: cfg.color, fontSize: 11, fontWeight: 500 }}>{cfg.label}</span>
    </span>
  );
}

function AgentCard({ agent, featured = false }: { agent: Agent; featured?: boolean }) {
  return (
    <div
      style={{
        background: featured ? "var(--bg-elevated)" : "var(--bg-secondary)",
        border: `1px solid ${featured ? "var(--border-default)" : "var(--border-subtle)"}`,
        borderRadius: featured ? 16 : 12,
        padding: featured ? "28px 32px" : "20px 22px",
        display: "flex",
        flexDirection: featured ? "row" : "column",
        gap: featured ? 28 : 14,
        alignItems: featured ? "center" : "flex-start",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle gradient glow for featured */}
      {featured && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 200,
            height: 200,
            background: "radial-gradient(circle at 100% 0%, rgba(124, 92, 252, 0.07) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Emoji avatar */}
      <div
        style={{
          fontSize: featured ? 52 : 36,
          lineHeight: 1,
          flexShrink: 0,
          width: featured ? 72 : 52,
          height: featured ? 72 : 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-hover)",
          borderRadius: featured ? 18 : 14,
          border: "1px solid var(--border-subtle)",
        }}
      >
        {agent.emoji}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name + status */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ color: "var(--text-primary)", fontSize: featured ? 20 : 15, fontWeight: 700 }}>
            {agent.name}
          </span>
          <span
            style={{
              background: "var(--accent-purple)" + "22",
              color: "var(--accent-purple)",
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 20,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {agent.role}
          </span>
          <div style={{ marginLeft: "auto" }}>
            <StatusDot status={agent.status} />
          </div>
        </div>

        {/* Description */}
        <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.65, margin: "6px 0 12px" }}>
          {agent.description}
        </p>

        {/* Pills row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span
            style={{
              background: "var(--bg-hover)",
              color: "var(--text-tertiary)",
              fontSize: 11,
              padding: "3px 9px",
              borderRadius: 20,
              border: "1px solid var(--border-subtle)",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            {agent.model}
          </span>
          <span
            style={{
              background: "var(--bg-hover)",
              color: "var(--text-tertiary)",
              fontSize: 11,
              padding: "3px 9px",
              borderRadius: 20,
              border: "1px solid var(--border-subtle)",
            }}
          >
            {agent.provider}
          </span>
          <span
            style={{
              background: "var(--bg-hover)",
              color: "var(--text-muted)",
              fontSize: 11,
              padding: "3px 9px",
              borderRadius: 20,
              border: "1px solid var(--border-subtle)",
            }}
          >
            {agent.device}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingMission, setEditingMission] = useState(false);
  const [missionDraft, setMissionDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/team");
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  function startEdit() {
    if (!data) return;
    setMissionDraft(data.mission);
    setEditingMission(true);
  }

  function cancelEdit() {
    setEditingMission(false);
    setMissionDraft("");
  }

  async function saveMission() {
    if (!data || !missionDraft.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mission: missionDraft.trim() }),
      });
      const json = await res.json();
      if (json.ok) {
        setData(json.data);
        setEditingMission(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const mainAgent = data?.agents.find((a) => a.type === "main");
  const subAgents = data?.agents.filter((a) => a.type !== "main") || [];

  return (
    <div className="h-full overflow-y-auto fab-scroll-pad" style={{ background: "var(--bg-primary)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 32px 64px" }}>

        {/* Page header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <Users size={20} style={{ color: "var(--accent-purple)" }} />
          <h1 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 700 }}>Team</h1>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 64 }}>
            <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent-purple)" }} />
          </div>
        ) : (
          <>
            {/* Mission Statement Card */}
            <div
              style={{
                marginBottom: 36,
                borderRadius: 16,
                padding: "2px",
                background: "linear-gradient(135deg, #7c5cfc55, #4d7cfe55, #26c97a33)",
              }}
            >
              <div
                style={{
                  background: "var(--bg-secondary)",
                  borderRadius: 14,
                  padding: "28px 32px",
                }}
              >
                {/* Label + edit button */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <span
                    style={{
                      color: "#26c97a",
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.12em",
                    }}
                  >
                    Our Mission
                  </span>
                  {!editingMission && (
                    <button
                      onClick={startEdit}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        background: "var(--bg-hover)",
                        color: "var(--text-tertiary)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: 7,
                        padding: "5px 10px",
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      <Pencil size={11} />
                      Edit
                    </button>
                  )}
                </div>

                {editingMission ? (
                  <div>
                    <textarea
                      value={missionDraft}
                      onChange={(e) => setMissionDraft(e.target.value)}
                      rows={4}
                      style={{
                        width: "100%",
                        background: "var(--bg-tertiary)",
                        border: "1px solid var(--accent-purple)",
                        borderRadius: 8,
                        color: "var(--text-primary)",
                        fontSize: 15,
                        lineHeight: 1.7,
                        padding: "10px 14px",
                        resize: "vertical",
                        outline: "none",
                        fontFamily: "inherit",
                        marginBottom: 10,
                      }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={saveMission}
                        disabled={saving}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          background: "var(--accent-purple)",
                          color: "white",
                          border: "none",
                          borderRadius: 7,
                          padding: "6px 14px",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: saving ? "not-allowed" : "pointer",
                          opacity: saving ? 0.7 : 1,
                        }}
                      >
                        {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          background: "var(--bg-hover)",
                          color: "var(--text-secondary)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: 7,
                          padding: "6px 12px",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        <X size={11} />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p
                    style={{
                      color: "var(--text-primary)",
                      fontSize: 17,
                      lineHeight: 1.75,
                      fontWeight: 400,
                    }}
                  >
                    {data?.mission}
                  </p>
                )}
              </div>
            </div>

            {/* Main agent — featured */}
            {mainAgent && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Main Agent
                </div>
                <AgentCard agent={mainAgent} featured={true} />
              </div>
            )}

            {/* Sub-agents grid */}
            {subAgents.length > 0 && (
              <div>
                <div style={{ color: "#ffffff", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Sub-Agents
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: 16,
                  }}
                >
                  {subAgents.map((agent) => (
                    <AgentCard key={agent.id} agent={agent} />
                  ))}
                </div>
              </div>
            )}

            {/* Live subagents (dynamically spawned) */}
            {data.liveSubagents && data.liveSubagents.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ color: "#26c97a", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#26c97a", animation: "pulse 2s ease-in-out infinite" }} />
                  Live Subagents ({data.liveSubagents.filter(s => s.status === "active" || s.status === "running").length} active)
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: 12,
                  }}
                >
                  {data.liveSubagents.map((sub) => {
                    const isActive = sub.status === "active" || sub.status === "running";
                    return (
                      <div
                        key={sub.id}
                        style={{
                          background: "var(--bg-elevated)",
                          borderRadius: 10,
                          padding: 14,
                          border: isActive ? "1px solid #26c97a40" : "1px solid var(--border-subtle)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 20 }}>⚡</span>
                            <span style={{ color: "#ffffff", fontSize: 14, fontWeight: 700 }}>{sub.name || sub.label || "Subagent"}</span>
                          </div>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 10,
                            color: isActive ? "#26c97a" : "#4d7cfe",
                            background: isActive ? "#26c97a18" : "#4d7cfe18",
                          }}>
                            {isActive ? "RUNNING" : sub.status.toUpperCase()}
                          </span>
                        </div>
                        {sub.model && (
                          <div style={{ color: "#ffffff", fontSize: 11, marginBottom: 4 }}>
                            Model: <span style={{ color: "#7c5cfc" }}>{sub.model}</span>
                          </div>
                        )}
                        {sub.task && (
                          <div style={{ color: "#ffffff", fontSize: 11, opacity: 0.8 }}>
                            Task: {sub.task}
                          </div>
                        )}
                        {sub.startedAt && (
                          <div style={{ color: "#ffffff", fontSize: 10, opacity: 0.5, marginTop: 4 }}>
                            Started: {new Date(sub.startedAt).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {data.lastUpdated && (
              <div style={{ color: "#ffffff", fontSize: 10, opacity: 0.4, textAlign: "right", marginTop: 16 }}>
                Last updated: {new Date(data.lastUpdated).toLocaleTimeString()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
