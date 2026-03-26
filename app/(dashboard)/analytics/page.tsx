"use client";

import { BarChart3, Cpu, DollarSign, TrendingUp, Zap, Info } from "lucide-react";

export default function AnalyticsPage() {
  const placeholderCards = [
    { label: "Total Tokens Today", icon: Zap, value: "—" },
    { label: "Total Cost Today", icon: DollarSign, value: "—" },
    { label: "Tokens by Agent", icon: Cpu, value: "—" },
    { label: "Daily Trend", icon: TrendingUp, value: "—" },
  ];

  return (
    <div style={{ padding: "24px 32px", maxWidth: "1200px" }} className="fab-scroll-pad">
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
          <BarChart3 size={20} style={{ display: "inline", marginRight: "8px", verticalAlign: "middle", color: "var(--accent-purple)" }} />
          Token & Cost Analytics
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          Usage tracking and cost analysis for AI agents
        </p>
      </div>

      {/* Instrumentation Notice */}
      <div style={{
        padding: "24px", marginBottom: "28px", borderRadius: "12px",
        background: "rgba(124,92,252,0.08)", border: "1px solid rgba(124,92,252,0.2)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
          <Info size={20} style={{ color: "var(--accent-purple)", flexShrink: 0, marginTop: "2px" }} />
          <div>
            <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
              Instrumentation Needed
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Token and cost analytics require agents to report their usage data. Once instrumented, this dashboard will show:
            </p>
            <ul style={{ marginTop: "10px", fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.8, paddingLeft: "20px" }}>
              <li>Total tokens consumed per agent per day</li>
              <li>Cost breakdown by model (input vs output tokens)</li>
              <li>Daily and weekly usage trends</li>
              <li>Cost per task and per agent comparisons</li>
              <li>Model distribution (Opus vs Sonnet vs Haiku)</li>
            </ul>
            <p style={{ marginTop: "12px", fontSize: "12px", color: "var(--text-tertiary)" }}>
              To enable, configure agents to POST usage data to /api/analytics after each completion.
            </p>
          </div>
        </div>
      </div>

      {/* Placeholder Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px", marginBottom: "28px" }}>
        {placeholderCards.map((card) => (
          <div key={card.label} style={{
            padding: "24px", background: "var(--bg-secondary)", borderRadius: "12px",
            border: "1px solid var(--border-subtle)", opacity: 0.6,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <card.icon size={18} style={{ color: "var(--text-tertiary)" }} />
              <span style={{ fontSize: "13px", color: "var(--text-tertiary)" }}>{card.label}</span>
            </div>
            <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-tertiary)" }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Placeholder Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {/* Usage by Agent */}
        <div style={{
          padding: "24px", background: "var(--bg-secondary)", borderRadius: "12px",
          border: "1px solid var(--border-subtle)", opacity: 0.6,
        }}>
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "20px" }}>
            Usage by Agent
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "80px", height: "12px", background: "var(--bg-tertiary)", borderRadius: "4px" }} />
                <div style={{
                  flex: 1, height: "8px", background: "var(--bg-tertiary)", borderRadius: "4px",
                }}>
                  <div style={{
                    width: `${70 - i * 15}%`, height: "100%", borderRadius: "4px",
                    background: "var(--border-subtle)",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cost Breakdown */}
        <div style={{
          padding: "24px", background: "var(--bg-secondary)", borderRadius: "12px",
          border: "1px solid var(--border-subtle)", opacity: 0.6,
        }}>
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "20px" }}>
            Daily Cost Trend
          </h3>
          <div style={{ display: "flex", gap: "4px", alignItems: "flex-end", height: "120px" }}>
            {Array.from({ length: 14 }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${20 + Math.random() * 80}%`,
                  background: "var(--bg-tertiary)",
                  borderRadius: "3px 3px 0 0",
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-tertiary)", marginTop: "8px" }}>
            <span>14 days ago</span>
            <span>Today</span>
          </div>
        </div>
      </div>
    </div>
  );
}
