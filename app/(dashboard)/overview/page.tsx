"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Cpu,
  AlertTriangle,
  XCircle,
  Clock,
  FileText,
  Brain,
  ClipboardList,
  Activity,
  RefreshCw,
  CheckCircle,
} from "lucide-react";

interface Metrics {
  activeAgents: number;
  needsReviewAgents: number;
  totalAgents: number;
  failedJobs24h: number;
  cronJobsDueSoon: number;
  totalCronJobs: number;
  docsChangedToday: number;
  totalDocs: number;
  memoryChangedToday: number;
  totalMemoryFiles: number;
  tasksByStatus: Record<string, number>;
  totalTasks: number;
}

interface AgentCard {
  id: string;
  name: string;
  emoji: string;
  role: string;
  model: string;
  status: string;
  taskSummary: string;
  updatedAt: string;
}

interface RecentTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee: string;
  updatedAt: string;
}

interface ActivityItem {
  type?: string;
  message?: string;
  title?: string;
  createdAt?: string;
  timestamp?: string;
  actor?: string;
}

function statusColor(status: string): string {
  switch (status) {
    case "active":
    case "running":
      return "var(--accent-green)";
    case "idle":
      return "var(--text-tertiary)";
    case "standby":
      return "var(--accent-blue)";
    case "needs_review":
      return "var(--accent-yellow)";
    case "blocked":
    case "failed":
      return "var(--accent-red)";
    default:
      return "var(--text-tertiary)";
  }
}

function timeAgo(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function priorityColor(p: string) {
  if (p === "high") return "var(--accent-red)";
  if (p === "medium") return "var(--accent-yellow)";
  return "var(--text-tertiary)";
}

export default function OverviewPage() {
  const [data, setData] = useState<{
    metrics: Metrics;
    recentActivity: ActivityItem[];
    agentCards: AgentCard[];
    recentTasks: RecentTask[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/overview");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch {
      setError("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div style={{ padding: "32px" }}>
        <div style={{ marginBottom: "24px" }}>
          <div style={{ height: "32px", width: "300px", background: "var(--bg-tertiary)", borderRadius: "8px", marginBottom: "8px" }} />
          <div style={{ height: "16px", width: "200px", background: "var(--bg-tertiary)", borderRadius: "6px" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ height: "100px", background: "var(--bg-secondary)", borderRadius: "12px", border: "1px solid var(--border-subtle)" }} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: "32px", textAlign: "center", color: "var(--accent-red)" }}>
        <XCircle size={32} style={{ marginBottom: "12px" }} />
        <div>{error || "No data available"}</div>
      </div>
    );
  }

  const { metrics, recentActivity, agentCards, recentTasks } = data;

  const metricCards = [
    {
      label: "Active Agents",
      value: metrics.activeAgents,
      sub: `of ${metrics.totalAgents} total`,
      icon: Cpu,
      color: "var(--accent-green)",
    },
    {
      label: "Needs Review",
      value: metrics.needsReviewAgents,
      sub: "agents awaiting review",
      icon: AlertTriangle,
      color: metrics.needsReviewAgents > 0 ? "var(--accent-yellow)" : "var(--text-tertiary)",
    },
    {
      label: "Failed (24h)",
      value: metrics.failedJobs24h,
      sub: "errors in last 24 hours",
      icon: XCircle,
      color: metrics.failedJobs24h > 0 ? "var(--accent-red)" : "var(--accent-green)",
    },
    {
      label: "Cron Due Soon",
      value: metrics.cronJobsDueSoon,
      sub: `of ${metrics.totalCronJobs} jobs`,
      icon: Clock,
      color: "var(--accent-blue)",
    },
    {
      label: "Docs Today",
      value: metrics.docsChangedToday,
      sub: `of ${metrics.totalDocs} total`,
      icon: FileText,
      color: "var(--accent-purple)",
    },
    {
      label: "Memory Today",
      value: metrics.memoryChangedToday,
      sub: `of ${metrics.totalMemoryFiles} files`,
      icon: Brain,
      color: "var(--accent-purple)",
    },
    {
      label: "Total Tasks",
      value: metrics.totalTasks,
      sub: `${metrics.tasksByStatus["in-progress"] || 0} in progress`,
      icon: ClipboardList,
      color: "var(--accent-blue)",
    },
    {
      label: "Done Tasks",
      value: metrics.tasksByStatus["done"] || 0,
      sub: "completed",
      icon: CheckCircle,
      color: "var(--accent-green)",
    },
  ];

  return (
    <div style={{ padding: "24px 32px", maxWidth: "1400px" }} className="fab-scroll-pad">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
            Mission Control
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            System overview and status dashboard
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchData(); }}
          style={{
            display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px",
            borderRadius: "8px", border: "1px solid var(--border-subtle)",
            background: "var(--bg-secondary)", color: "var(--text-secondary)",
            cursor: "pointer", fontSize: "13px",
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Metric Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: "16px",
        marginBottom: "28px",
      }}>
        {metricCards.map((card) => (
          <div
            key={card.label}
            style={{
              padding: "20px",
              background: "var(--bg-secondary)",
              borderRadius: "12px",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <card.icon size={18} style={{ color: card.color }} />
              <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{card.label}</span>
            </div>
            <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
              {card.value}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Two-column layout: Tasks + Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "28px" }}>
        {/* Task Status Breakdown */}
        <div style={{
          padding: "20px",
          background: "var(--bg-secondary)",
          borderRadius: "12px",
          border: "1px solid var(--border-subtle)",
        }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>
            Tasks by Status
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {Object.entries(metrics.tasksByStatus).length === 0 ? (
              <div style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>No tasks yet</div>
            ) : (
              Object.entries(metrics.tasksByStatus).map(([status, count]) => (
                <div key={status} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{
                      width: "8px", height: "8px", borderRadius: "50%",
                      background: statusColor(status.replace("-", "_")),
                    }} />
                    <span style={{ fontSize: "13px", color: "var(--text-secondary)", textTransform: "capitalize" }}>
                      {status.replace(/-/g, " ").replace(/_/g, " ")}
                    </span>
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{count}</span>
                </div>
              ))
            )}
          </div>

          {/* Recent Tasks */}
          <div style={{ marginTop: "20px", borderTop: "1px solid var(--border-subtle)", paddingTop: "16px" }}>
            <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "12px" }}>
              Recent Tasks
            </h3>
            {recentTasks.map((task) => (
              <div
                key={task.id}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 0", borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  <div style={{
                    width: "6px", height: "6px", borderRadius: "50%",
                    background: priorityColor(task.priority), flexShrink: 0,
                  }} />
                  <span style={{ fontSize: "13px", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {task.title}
                  </span>
                </div>
                <span style={{
                  fontSize: "11px", color: "var(--text-tertiary)", flexShrink: 0, marginLeft: "8px",
                  padding: "2px 8px", borderRadius: "4px", background: "var(--bg-tertiary)",
                }}>
                  {task.status.replace(/-/g, " ")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{
          padding: "20px",
          background: "var(--bg-secondary)",
          borderRadius: "12px",
          border: "1px solid var(--border-subtle)",
        }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>
            Recent Activity
          </h2>
          {recentActivity.length === 0 ? (
            <div style={{ color: "var(--text-tertiary)", fontSize: "13px", padding: "20px 0", textAlign: "center" }}>
              <Activity size={24} style={{ marginBottom: "8px", opacity: 0.5 }} />
              <div>No recent activity</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {recentActivity.slice(0, 10).map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: "10px",
                    padding: "10px 0", borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <div style={{
                    width: "6px", height: "6px", borderRadius: "50%", marginTop: "6px",
                    background: item.type === "error" ? "var(--accent-red)" : "var(--accent-blue)", flexShrink: 0,
                  }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: "13px", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.message || item.title || "Activity"}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "2px" }}>
                      {timeAgo(item.createdAt || item.timestamp)}
                      {item.actor ? ` · ${item.actor}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Agent Status Cards */}
      <div style={{
        padding: "20px",
        background: "var(--bg-secondary)",
        borderRadius: "12px",
        border: "1px solid var(--border-subtle)",
      }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>
          Agent Status
        </h2>
        {agentCards.length === 0 ? (
          <div style={{ color: "var(--text-tertiary)", fontSize: "13px", padding: "20px 0", textAlign: "center" }}>
            <Cpu size={24} style={{ marginBottom: "8px", opacity: 0.5 }} />
            <div>No agents registered</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
            {agentCards.map((agent) => (
              <div
                key={agent.id}
                style={{
                  padding: "16px",
                  background: "var(--bg-tertiary)",
                  borderRadius: "10px",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "20px" }}>{agent.emoji || "🤖"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>
                      {agent.name}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>{agent.role}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{
                      width: "8px", height: "8px", borderRadius: "50%",
                      background: statusColor(agent.status),
                    }} />
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "capitalize" }}>
                      {agent.status}
                    </span>
                  </div>
                </div>
                {agent.taskSummary && (
                  <div style={{
                    fontSize: "12px", color: "var(--text-secondary)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {agent.taskSummary}
                  </div>
                )}
                <div style={{ display: "flex", gap: "12px", marginTop: "8px", fontSize: "11px", color: "var(--text-tertiary)" }}>
                  {agent.model && <span>Model: {agent.model}</span>}
                  <span>Updated {timeAgo(agent.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 767px) {
          div[style*="gridTemplateColumns: repeat(auto-fill, minmax(200px"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          div[style*="gridTemplateColumns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
