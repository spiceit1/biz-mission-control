"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  RefreshCw,
  Download,
  DollarSign,
  Cpu,
  Zap,
  Clock,
  TrendingUp,
  Database,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";

interface Summary {
  total_calls: number;
  total_tokens: string;
  total_input: string;
  total_output: string;
  total_cache_read: string;
  total_cache_write: string;
  total_cost: string;
  total_sessions: number;
}

interface ModelRow {
  model: string;
  calls: number;
  tokens: string;
  cost: string;
  avg_cost_per_call: string;
  sessions: number;
}

interface SessionTypeRow {
  session_type: string;
  calls: number;
  tokens: string;
  cost: string;
  sessions: number;
}

interface DailyRow {
  day: string;
  calls: number;
  tokens: string;
  cost: string;
}

interface HourlyRow {
  hour: number;
  calls: number;
  cost: string;
}

interface TopSession {
  session_id: string;
  session_type: string;
  model: string;
  calls: number;
  tokens: string;
  cost: string;
  started_at: string;
  ended_at: string;
}

interface AnalyticsData {
  summary: Summary;
  byModel: ModelRow[];
  bySessionType: SessionTypeRow[];
  dailyCost: DailyRow[];
  hourly: HourlyRow[];
  topSessions: TopSession[];
  lastSync: { last_record: string | null; total_records: number };
}

function formatCost(val: string | number): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(4)}`;
}

function formatTokens(val: string | number): string {
  const n = typeof val === "string" ? parseInt(val) : val;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(d: string): string {
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Simple bar chart component using CSS
function BarChartSimple({
  data,
  maxVal,
  colorVar,
}: {
  data: { label: string; value: number; sublabel?: string }[];
  maxVal: number;
  colorVar: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "60px",
              fontSize: "12px",
              color: "var(--text-tertiary)",
              textAlign: "right",
              flexShrink: 0,
            }}
          >
            {d.label}
          </div>
          <div
            style={{
              flex: 1,
              height: "24px",
              background: "var(--bg-hover)",
              borderRadius: "4px",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${maxVal > 0 ? (d.value / maxVal) * 100 : 0}%`,
                background: colorVar,
                borderRadius: "4px",
                transition: "width 0.3s ease",
                minWidth: d.value > 0 ? "2px" : "0",
              }}
            />
            {d.sublabel && (
              <div
                style={{
                  position: "absolute",
                  right: "6px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                }}
              >
                {d.sublabel}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Session type label formatting
function sessionTypeLabel(t: string): string {
  const labels: Record<string, string> = {
    session: "Direct Session",
    discord: "Discord",
    telegram: "Telegram",
    cron: "Cron Job",
    heartbeat: "Heartbeat",
    subagent: "Sub-Agent",
    signal: "Signal",
  };
  return labels[t] || t;
}

// Model name formatting
function modelLabel(m: string): string {
  if (m.includes("opus")) return "Claude Opus";
  if (m.includes("sonnet")) return "Claude Sonnet";
  if (m.includes("haiku")) return "Claude Haiku";
  return m;
}

// Color for model
function modelColor(m: string): string {
  if (m.includes("opus")) return "#e67e22";
  if (m.includes("sonnet")) return "#9b59b6";
  if (m.includes("haiku")) return "#3498db";
  return "#95a5a6";
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Default to today's date
  const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD format
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const res = await fetch(`/api/analytics?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/analytics/sync", { method: "POST" });
      const json = await res.json();
      if (json.error) {
        setSyncResult(`Error: ${json.error}`);
      } else {
        setSyncResult(
          `${json.totalRecords.toLocaleString()} records from ${json.totalSessions} sessions synced. Last sync: ${json.lastSyncAt ? new Date(json.lastSyncAt).toLocaleString() : "never"}. To pull new data, ask Paul to run the sync script.`
        );
        // Refresh data
        await fetchData();
      }
    } catch (e) {
      setSyncResult(`Error: ${String(e)}`);
    } finally {
      setSyncing(false);
    }
  };

  const toggleSession = (id: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Card wrapper style
  const card = {
    background: "var(--bg-secondary)",
    borderRadius: "12px",
    border: "1px solid var(--border-subtle)",
    padding: "20px",
  };

  const metricCard = {
    ...card,
    display: "flex" as const,
    flexDirection: "column" as const,
    gap: "4px",
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <BarChart3 size={24} style={{ color: "var(--accent-purple)" }} />
            Token & Cost Analytics
          </h1>
          <p style={{ color: "var(--text-tertiary)", fontSize: "14px", marginTop: "4px" }}>
            Track token usage, costs, and spending patterns across all sessions
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Quick date presets */}
          {[
            { label: "Today", from: todayStr, to: todayStr },
            { label: "7d", from: new Date(Date.now() - 7 * 86400000).toLocaleDateString("en-CA"), to: todayStr },
            { label: "30d", from: new Date(Date.now() - 30 * 86400000).toLocaleDateString("en-CA"), to: todayStr },
            { label: "All", from: "", to: "" },
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => { setDateFrom(preset.from); setDateTo(preset.to); }}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid var(--border-subtle)",
                background: dateFrom === preset.from && dateTo === preset.to ? "var(--accent-purple)" : "var(--bg-secondary)",
                color: dateFrom === preset.from && dateTo === preset.to ? "white" : "var(--text-secondary)",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              {preset.label}
            </button>
          ))}

          {/* Date range picker */}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="From"
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
              fontSize: "13px",
            }}
          />
          <span style={{ color: "var(--text-tertiary)" }}>→</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="To"
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
              fontSize: "13px",
            }}
          />

          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              borderRadius: "8px",
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            Refresh
          </button>

          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              background: "var(--accent-purple)",
              color: "white",
              cursor: syncing ? "wait" : "pointer",
              fontSize: "13px",
              fontWeight: 600,
              opacity: syncing ? 0.7 : 1,
            }}
          >
            <Download size={14} />
            {syncing ? "Syncing..." : "Pull Token Data"}
          </button>
        </div>
      </div>

      {/* Sync result banner */}
      {syncResult && (
        <div
          style={{
            ...card,
            marginBottom: "16px",
            padding: "12px 16px",
            background: syncResult.startsWith("Error")
              ? "rgba(231,76,60,0.1)"
              : "rgba(46,204,113,0.1)",
            border: `1px solid ${syncResult.startsWith("Error") ? "rgba(231,76,60,0.3)" : "rgba(46,204,113,0.3)"}`,
            color: syncResult.startsWith("Error") ? "#e74c3c" : "#2ecc71",
            fontSize: "14px",
          }}
        >
          {syncResult}
        </div>
      )}

      {error && (
        <div
          style={{
            ...card,
            marginBottom: "16px",
            padding: "16px",
            display: "flex",
            gap: "10px",
            alignItems: "center",
            background: "rgba(231,76,60,0.1)",
            border: "1px solid rgba(231,76,60,0.3)",
          }}
        >
          <AlertCircle size={18} color="#e74c3c" />
          <span style={{ color: "#e74c3c", fontSize: "14px" }}>{error}</span>
        </div>
      )}

      {!data && loading && (
        <div style={{ textAlign: "center", padding: "60px", color: "var(--text-tertiary)" }}>
          Loading analytics...
        </div>
      )}

      {data && (
        <>
          {/* Summary Metric Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
              marginBottom: "24px",
            }}
          >
            <div style={metricCard}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <DollarSign size={16} style={{ color: "#2ecc71" }} />
                <span style={{ fontSize: "12px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Total Cost
                </span>
              </div>
              <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>
                {formatCost(data.summary.total_cost)}
              </div>
            </div>

            <div style={metricCard}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Zap size={16} style={{ color: "#e67e22" }} />
                <span style={{ fontSize: "12px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Total Tokens
                </span>
              </div>
              <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>
                {formatTokens(data.summary.total_tokens)}
              </div>
            </div>

            <div style={metricCard}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Cpu size={16} style={{ color: "#9b59b6" }} />
                <span style={{ fontSize: "12px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  API Calls
                </span>
              </div>
              <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>
                {data.summary.total_calls.toLocaleString()}
              </div>
            </div>

            <div style={metricCard}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Database size={16} style={{ color: "#3498db" }} />
                <span style={{ fontSize: "12px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Sessions
                </span>
              </div>
              <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>
                {data.summary.total_sessions}
              </div>
            </div>

            <div style={metricCard}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <TrendingUp size={16} style={{ color: "#e74c3c" }} />
                <span style={{ fontSize: "12px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Avg Cost/Call
                </span>
              </div>
              <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>
                {data.summary.total_calls > 0
                  ? formatCost(parseFloat(data.summary.total_cost) / data.summary.total_calls)
                  : "$0"}
              </div>
            </div>

            <div style={metricCard}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Clock size={16} style={{ color: "#1abc9c" }} />
                <span style={{ fontSize: "12px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Last Sync
                </span>
              </div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginTop: "4px" }}>
                {data.lastSync.last_record
                  ? formatDateTime(data.lastSync.last_record)
                  : "Never"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
                {data.lastSync.total_records.toLocaleString()} records
              </div>
            </div>
          </div>

          {/* Two column layout for breakdowns */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            {/* By Model */}
            <div style={card}>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Cpu size={16} style={{ color: "var(--accent-purple)" }} />
                Cost by Model
              </h3>
              {data.byModel.length === 0 ? (
                <div style={{ color: "var(--text-tertiary)", fontSize: "14px", padding: "20px 0", textAlign: "center" }}>
                  No data yet. Click &quot;Pull Token Data&quot; to sync.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {data.byModel.map((m) => (
                    <div key={m.model}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>
                          {modelLabel(m.model)}
                        </span>
                        <span style={{ fontSize: "14px", fontWeight: 600, color: modelColor(m.model) }}>
                          {formatCost(m.cost)}
                        </span>
                      </div>
                      <div
                        style={{
                          height: "8px",
                          background: "var(--bg-hover)",
                          borderRadius: "4px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${parseFloat(data.summary.total_cost) > 0 ? (parseFloat(m.cost) / parseFloat(data.summary.total_cost)) * 100 : 0}%`,
                            background: modelColor(m.model),
                            borderRadius: "4px",
                          }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: "16px", marginTop: "4px" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
                          {m.calls} calls
                        </span>
                        <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
                          {formatTokens(m.tokens)} tokens
                        </span>
                        <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
                          {m.sessions} sessions
                        </span>
                        <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
                          ~{formatCost(m.avg_cost_per_call)}/call
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* By Session Type */}
            <div style={card}>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <ArrowUpDown size={16} style={{ color: "var(--accent-purple)" }} />
                Cost by Session Type
              </h3>
              {data.bySessionType.length === 0 ? (
                <div style={{ color: "var(--text-tertiary)", fontSize: "14px", padding: "20px 0", textAlign: "center" }}>
                  No data yet. Click &quot;Pull Token Data&quot; to sync.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {data.bySessionType.map((s) => {
                    const colors: Record<string, string> = {
                      session: "#95a5a6",
                      discord: "#5865F2",
                      telegram: "#0088cc",
                      cron: "#e67e22",
                      heartbeat: "#e74c3c",
                      subagent: "#2ecc71",
                      signal: "#3a76f0",
                    };
                    const color = colors[s.session_type] || "#95a5a6";
                    return (
                      <div key={s.session_type}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>
                            {sessionTypeLabel(s.session_type)}
                          </span>
                          <span style={{ fontSize: "14px", fontWeight: 600, color }}>
                            {formatCost(s.cost)}
                          </span>
                        </div>
                        <div
                          style={{
                            height: "8px",
                            background: "var(--bg-hover)",
                            borderRadius: "4px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${parseFloat(data.summary.total_cost) > 0 ? (parseFloat(s.cost) / parseFloat(data.summary.total_cost)) * 100 : 0}%`,
                              background: color,
                              borderRadius: "4px",
                            }}
                          />
                        </div>
                        <div style={{ display: "flex", gap: "16px", marginTop: "4px" }}>
                          <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
                            {s.calls} calls
                          </span>
                          <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
                            {s.sessions} sessions
                          </span>
                          <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
                            {formatTokens(s.tokens)} tokens
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Daily Cost Trend */}
          <div style={{ ...card, marginBottom: "24px" }}>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <TrendingUp size={16} style={{ color: "var(--accent-purple)" }} />
              Daily Cost Trend
            </h3>
            {data.dailyCost.length === 0 ? (
              <div style={{ color: "var(--text-tertiary)", fontSize: "14px", padding: "20px 0", textAlign: "center" }}>
                No data yet.
              </div>
            ) : (
              <BarChartSimple
                data={data.dailyCost.reverse().map((d) => ({
                  label: formatDate(d.day),
                  value: parseFloat(d.cost),
                  sublabel: `${formatCost(d.cost)} · ${d.calls} calls`,
                }))}
                maxVal={Math.max(...data.dailyCost.map((d) => parseFloat(d.cost)))}
                colorVar="var(--accent-purple)"
              />
            )}
          </div>

          {/* Hourly Distribution */}
          <div style={{ ...card, marginBottom: "24px" }}>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Clock size={16} style={{ color: "var(--accent-purple)" }} />
              Hourly Activity Distribution
            </h3>
            {data.hourly.length === 0 ? (
              <div style={{ color: "var(--text-tertiary)", fontSize: "14px", padding: "20px 0", textAlign: "center" }}>
                No data yet.
              </div>
            ) : (
              <BarChartSimple
                data={data.hourly.map((h) => ({
                  label: `${h.hour.toString().padStart(2, "0")}:00`,
                  value: h.calls,
                  sublabel: `${h.calls} calls · ${formatCost(h.cost)}`,
                }))}
                maxVal={Math.max(...data.hourly.map((h) => h.calls))}
                colorVar="#3498db"
              />
            )}
          </div>

          {/* Top Sessions */}
          <div style={card}>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Database size={16} style={{ color: "var(--accent-purple)" }} />
              Top Sessions by Cost
            </h3>
            {data.topSessions.length === 0 ? (
              <div style={{ color: "var(--text-tertiary)", fontSize: "14px", padding: "20px 0", textAlign: "center" }}>
                No data yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {data.topSessions.map((s, i) => (
                  <div
                    key={s.session_id}
                    style={{
                      background: "var(--bg-hover)",
                      borderRadius: "8px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      onClick={() => toggleSession(s.session_id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "12px 16px",
                        cursor: "pointer",
                        gap: "12px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "var(--text-tertiary)",
                          width: "24px",
                          textAlign: "center",
                        }}
                      >
                        #{i + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: 500,
                              color: "var(--text-primary)",
                              fontFamily: "monospace",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: "200px",
                            }}
                          >
                            {s.session_id.substring(0, 12)}...
                          </span>
                          <span
                            style={{
                              fontSize: "11px",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              background: "rgba(155,89,182,0.15)",
                              color: "#9b59b6",
                              fontWeight: 500,
                            }}
                          >
                            {sessionTypeLabel(s.session_type)}
                          </span>
                          <span
                            style={{
                              fontSize: "11px",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              background: `${modelColor(s.model)}20`,
                              color: modelColor(s.model),
                              fontWeight: 500,
                            }}
                          >
                            {modelLabel(s.model)}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                          {formatCost(s.cost)}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                          {s.calls} calls · {formatTokens(s.tokens)} tok
                        </div>
                      </div>
                      {expandedSessions.has(s.session_id) ? (
                        <ChevronUp size={14} style={{ color: "var(--text-tertiary)" }} />
                      ) : (
                        <ChevronDown size={14} style={{ color: "var(--text-tertiary)" }} />
                      )}
                    </div>
                    {expandedSessions.has(s.session_id) && (
                      <div
                        style={{
                          padding: "0 16px 12px 52px",
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "16px",
                          fontSize: "12px",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        <span>Started: {formatDateTime(s.started_at)}</span>
                        <span>Ended: {formatDateTime(s.ended_at)}</span>
                        <span>Tokens: {parseInt(s.tokens).toLocaleString()}</span>
                        <span>Avg/call: {formatCost(parseFloat(s.cost) / s.calls)}</span>
                        <span style={{ fontFamily: "monospace", fontSize: "11px" }}>
                          ID: {s.session_id}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Token Breakdown */}
          <div style={{ ...card, marginTop: "24px" }}>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: "16px",
              }}
            >
              Token Breakdown
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "16px",
              }}
            >
              {[
                { label: "Input", value: data.summary.total_input, color: "#3498db" },
                { label: "Output", value: data.summary.total_output, color: "#2ecc71" },
                { label: "Cache Read", value: data.summary.total_cache_read, color: "#e67e22" },
                { label: "Cache Write", value: data.summary.total_cache_write, color: "#9b59b6" },
              ].map((t) => (
                <div key={t.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "24px", fontWeight: 700, color: t.color }}>
                    {formatTokens(t.value)}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "2px" }}>
                    {t.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
