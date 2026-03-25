"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Play,
  Loader2,
  AlertCircle,
  RefreshCw,
  Radar,
  Scan,
  Users,
  FlaskConical,
  Zap,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Memo {
  date: string;
  filename: string;
}

interface RunStatus {
  lastRunAt: string | null;
  lastRunStatus: "running" | "success" | "error" | null;
  pid?: number;
}

interface ApiData {
  memos: Memo[];
  status: RunStatus;
  latestContent: string | null;
}

type SubTab = "trend-radar" | "opportunity-scanner" | "rd-council";

// ─── Agent Role Config ────────────────────────────────────────────────────────

const AGENT_ROLES: Record<string, { label: string; color: string; bg: string }> = {
  STRATEGIST: { label: "STRATEGIST", color: "#c084fc", bg: "#c084fc18" },
  ANALYST: { label: "ANALYST", color: "#60a5fa", bg: "#60a5fa18" },
  SCOUT: { label: "SCOUT", color: "#34d399", bg: "#34d39918" },
  BUILDER: { label: "BUILDER", color: "#fbbf24", bg: "#fbbf2418" },
  "DEVIL'S ADVOCATE": { label: "DEVIL'S ADVOCATE", color: "#f87171", bg: "#f8717118" },
};

const ROLE_KEYWORDS: Record<string, string> = {
  strategist: "STRATEGIST",
  strategy: "STRATEGIST",
  strategic: "STRATEGIST",
  analyst: "ANALYST",
  analysis: "ANALYST",
  market: "ANALYST",
  research: "ANALYST",
  scout: "SCOUT",
  scouting: "SCOUT",
  explore: "SCOUT",
  builder: "BUILDER",
  build: "BUILDER",
  implement: "BUILDER",
  technical: "BUILDER",
  "devil": "DEVIL'S ADVOCATE",
  advocate: "DEVIL'S ADVOCATE",
  critic: "DEVIL'S ADVOCATE",
  risk: "DEVIL'S ADVOCATE",
};

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  APPROVED: { label: "APPROVED", color: "#34d399", bg: "#34d39918" },
  "NEEDS WORK": { label: "NEEDS WORK", color: "#fbbf24", bg: "#fbbf2418" },
  DRAFT: { label: "DRAFT", color: "#94a3b8", bg: "#94a3b818" },
  PENDING: { label: "PENDING", color: "#60a5fa", bg: "#60a5fa18" },
  REJECTED: { label: "REJECTED", color: "#f87171", bg: "#f8717118" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(isoStr: string): string {
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

// ─── Markdown Parser ──────────────────────────────────────────────────────────

interface ParsedMemo {
  title: string;
  role: string;
  category: string;
  status: string;
  tags: string[];
  complexity: string;
  confidence: string;
  cost: string;
  problem: string;
  proposal: string;
  rawSections: Record<string, string>;
}

function parseMarkdown(content: string, date: string): ParsedMemo {
  const lines = content.split("\n");
  let title = "Untitled Memo";
  let role = "ANALYST";
  let category = "RESEARCH";
  let status = "DRAFT";
  let tags: string[] = [];
  let complexity = "MEDIUM";
  let confidence = "75%";
  let cost = "$0.04";
  let problem = "";
  let proposal = "";
  const rawSections: Record<string, string> = {};

  // Extract h1 as title
  for (const line of lines) {
    if (line.startsWith("# ")) {
      title = line.slice(2).trim();
      break;
    }
  }

  // Extract sections
  let currentSection = "";
  let sectionBuffer: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (currentSection && sectionBuffer.length > 0) {
        rawSections[currentSection] = sectionBuffer.join("\n").trim();
      }
      currentSection = line.slice(3).trim().toUpperCase();
      sectionBuffer = [];
    } else if (currentSection) {
      sectionBuffer.push(line);
    }
  }
  if (currentSection && sectionBuffer.length > 0) {
    rawSections[currentSection] = sectionBuffer.join("\n").trim();
  }

  // Extract problem / proposal from sections
  for (const [key, val] of Object.entries(rawSections)) {
    if (key.includes("PROBLEM") || key.includes("ISSUE") || key.includes("CHALLENGE")) {
      problem = val.replace(/\*\*/g, "").slice(0, 300).trim();
    }
    if (key.includes("PROPOSAL") || key.includes("SOLUTION") || key.includes("RECOMMENDATION") || key.includes("OPPORTUNITY")) {
      proposal = val.replace(/\*\*/g, "").slice(0, 300).trim();
    }
  }

  // Fallback: grab first non-title paragraph for problem
  if (!problem) {
    const nonHeader = lines.filter(
      (l) => l && !l.startsWith("#") && !l.startsWith("---") && !l.startsWith(">") && l.trim().length > 20
    );
    if (nonHeader.length > 0) problem = nonHeader[0].replace(/\*\*/g, "").slice(0, 300).trim();
  }

  // Extract metadata from content
  const fullText = content.toLowerCase();

  // Role detection
  for (const [keyword, mappedRole] of Object.entries(ROLE_KEYWORDS)) {
    if (fullText.includes(keyword)) {
      role = mappedRole;
      break;
    }
  }

  // Category from section headers or content
  if (rawSections["MARKET RESEARCH"] || fullText.includes("market research")) category = "MARKET RESEARCH";
  else if (rawSections["STRATEGIC ANALYSIS"] || fullText.includes("strategic analysis")) category = "STRATEGIC ANALYSIS";
  else if (rawSections["TECHNICAL REVIEW"] || fullText.includes("technical")) category = "TECHNICAL REVIEW";
  else if (rawSections["OPPORTUNITY ANALYSIS"] || fullText.includes("opportunity")) category = "OPPORTUNITY ANALYSIS";
  else if (rawSections["RISK ASSESSMENT"] || fullText.includes("risk")) category = "RISK ASSESSMENT";

  // Status detection
  if (fullText.includes("approved") || fullText.includes("recommend")) status = "APPROVED";
  else if (fullText.includes("needs work") || fullText.includes("incomplete")) status = "NEEDS WORK";
  else if (fullText.includes("pending") || fullText.includes("in progress")) status = "PENDING";

  // Tags from content
  const potentialTags: string[] = [];
  if (fullText.includes("ticket")) potentialTags.push("tickets");
  if (fullText.includes("resale")) potentialTags.push("resale");
  if (fullText.includes("nfl") || fullText.includes("nba") || fullText.includes("mlb") || fullText.includes("sports")) potentialTags.push("sports");
  if (fullText.includes("concert") || fullText.includes("music")) potentialTags.push("concerts");
  if (fullText.includes("arbitrage")) potentialTags.push("arbitrage");
  if (fullText.includes("algorithm") || fullText.includes("automation")) potentialTags.push("automation");
  if (fullText.includes("stubhub")) potentialTags.push("stubhub");
  if (fullText.includes("seatgeek")) potentialTags.push("seatgeek");
  if (fullText.includes("revenue") || fullText.includes("profit")) potentialTags.push("revenue");
  if (fullText.includes("strategy")) potentialTags.push("strategy");
  if (fullText.includes("risk")) potentialTags.push("risk");
  if (fullText.includes("data") || fullText.includes("analytics")) potentialTags.push("analytics");
  tags = potentialTags.slice(0, 5);
  if (tags.length === 0) tags = ["r&d", "memo"];

  // Complexity from word count / sections
  const wordCount = content.split(/\s+/).length;
  const sectionCount = Object.keys(rawSections).length;
  if (wordCount > 800 || sectionCount > 5) complexity = "HIGH";
  else if (wordCount > 400 || sectionCount > 3) complexity = "MEDIUM";
  else complexity = "LOW";

  // Confidence from content signals
  const confMatch = content.match(/confidence[:\s]+(\d+)%/i);
  if (confMatch) {
    confidence = `${confMatch[1]}%`;
  } else {
    // Derive from complexity and word count
    if (complexity === "HIGH") confidence = "87%";
    else if (complexity === "MEDIUM") confidence = "74%";
    else confidence = "61%";
  }

  return {
    title,
    role,
    category,
    status,
    tags,
    complexity,
    confidence,
    cost,
    problem,
    proposal,
    rawSections,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const MONO = "'JetBrains Mono', 'Fira Code', 'Courier New', monospace";

function AgentBadge({ role }: { role: string }) {
  const cfg = AGENT_ROLES[role] ?? { label: role, color: "#94a3b8", bg: "#94a3b818" };
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.12em",
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.color}40`,
        borderRadius: 3,
        padding: "2px 7px",
        whiteSpace: "nowrap",
      }}
    >
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_STYLES[status] ?? { label: status, color: "#94a3b8", bg: "#94a3b818" };
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.1em",
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.color}40`,
        borderRadius: 3,
        padding: "2px 8px",
      }}
    >
      ● {cfg.label}
    </span>
  );
}

function TagPill({ tag }: { tag: string }) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 9,
        letterSpacing: "0.08em",
        color: "var(--text-muted)",
        background: "var(--bg-primary)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 3,
        padding: "2px 7px",
      }}
    >
      #{tag}
    </span>
  );
}

function ComplexityDots({ level }: { level: string }) {
  const count = level === "HIGH" ? 3 : level === "MEDIUM" ? 2 : 1;
  const color = level === "HIGH" ? "#f87171" : level === "MEDIUM" ? "#fbbf24" : "#34d399";
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: i <= count ? color : "var(--border-subtle)",
          }}
        />
      ))}
    </span>
  );
}

function MemoCard({
  memo,
  index,
  parsed,
}: {
  memo: Memo;
  index: number;
  parsed: ParsedMemo;
}) {
  const memoNum = String(index + 1).padStart(3, "0");
  const isHovered = false;

  return (
    <div
      style={{
        fontFamily: MONO,
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
        overflow: "hidden",
        transition: "border-color 0.15s",
        marginBottom: 20,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent-purple)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-subtle)";
      }}
    >
      {/* Card Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-primary)",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Memo number */}
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: "var(--text-muted)",
              background: "var(--bg-hover)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 3,
              padding: "2px 8px",
            }}
          >
            MEMO #{memoNum}
          </span>

          {/* Agent Role */}
          <AgentBadge role={parsed.role} />

          {/* Category */}
          <span
            style={{
              fontFamily: MONO,
              fontSize: 9,
              letterSpacing: "0.12em",
              color: "var(--text-muted)",
              textTransform: "uppercase",
            }}
          >
            {parsed.category}
          </span>
        </div>

        {/* Date */}
        <span
          style={{
            fontFamily: MONO,
            fontSize: 10,
            color: "var(--text-muted)",
            letterSpacing: "0.06em",
          }}
        >
          {formatDate(memo.date)}
        </span>
      </div>

      {/* Card Body */}
      <div style={{ padding: "16px 20px" }}>
        {/* Title Row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
          <h3
            style={{
              fontFamily: MONO,
              fontSize: 16,
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
              lineHeight: 1.3,
              letterSpacing: "-0.01em",
              flex: 1,
              minWidth: 200,
            }}
          >
            {parsed.title}
          </h3>
          <StatusBadge status={parsed.status} />
        </div>

        {/* Tags */}
        {parsed.tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
            {parsed.tags.map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
          </div>
        )}

        {/* Metrics row */}
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            padding: "8px 12px",
            background: "var(--bg-primary)",
            borderRadius: 5,
            border: "1px solid var(--border-subtle)",
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          {/* Complexity */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em" }}>
              COMPLEXITY
            </span>
            <ComplexityDots level={parsed.complexity} />
            <span
              style={{
                fontFamily: MONO,
                fontSize: 9,
                fontWeight: 700,
                color:
                  parsed.complexity === "HIGH"
                    ? "#f87171"
                    : parsed.complexity === "MEDIUM"
                    ? "#fbbf24"
                    : "#34d399",
                letterSpacing: "0.08em",
              }}
            >
              {parsed.complexity}
            </span>
          </div>

          <span style={{ color: "var(--border-subtle)", fontSize: 12 }}>|</span>

          {/* Confidence */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em" }}>
              CONFIDENCE
            </span>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: "#60a5fa" }}>
              {parsed.confidence}
            </span>
          </div>

          <span style={{ color: "var(--border-subtle)", fontSize: 12 }}>|</span>

          {/* Cost */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em" }}>
              COST
            </span>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: "#34d399" }}>
              {parsed.cost}
            </span>
          </div>
        </div>

        {/* Problem / Proposal sections */}
        {parsed.problem && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  color: "#f87171",
                  background: "#f8717118",
                  border: "1px solid #f8717130",
                  borderRadius: 3,
                  padding: "1px 6px",
                }}
              >
                PROBLEM
              </span>
            </div>
            <p
              style={{
                fontFamily: MONO,
                fontSize: 11,
                lineHeight: 1.7,
                color: "var(--text-secondary)",
                margin: 0,
                paddingLeft: 4,
                borderLeft: "2px solid #f8717140",
              }}
            >
              {parsed.problem.length > 240 ? parsed.problem.slice(0, 240) + "…" : parsed.problem}
            </p>
          </div>
        )}

        {parsed.proposal && (
          <div style={{ marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  color: "#34d399",
                  background: "#34d39918",
                  border: "1px solid #34d39930",
                  borderRadius: 3,
                  padding: "1px 6px",
                }}
              >
                PROPOSAL
              </span>
            </div>
            <p
              style={{
                fontFamily: MONO,
                fontSize: 11,
                lineHeight: 1.7,
                color: "var(--text-secondary)",
                margin: 0,
                paddingLeft: 4,
                borderLeft: "2px solid #34d39940",
              }}
            >
              {parsed.proposal.length > 240 ? parsed.proposal.slice(0, 240) + "…" : parsed.proposal}
            </p>
          </div>
        )}

        {!parsed.problem && !parsed.proposal && (
          <p style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-muted)", margin: 0, fontStyle: "italic" }}>
            No structured problem/proposal found in this memo.
          </p>
        )}
      </div>
    </div>
  );
}

function PlaceholderTab({ icon, label, subtitle }: { icon: React.ReactNode; label: string; subtitle: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 16,
        padding: 48,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "var(--text-primary)",
            marginBottom: 6,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 11,
            color: "var(--text-muted)",
            letterSpacing: "0.04em",
          }}
        >
          {subtitle}
        </div>
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 9,
          letterSpacing: "0.14em",
          color: "var(--text-muted)",
          background: "var(--bg-secondary)",
          border: "1px dashed var(--border-subtle)",
          borderRadius: 4,
          padding: "4px 12px",
        }}
      >
        COMING SOON
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RDTeamPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SubTab>("rd-council");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/rd-team");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch {
      setError("Failed to load R&D data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (data?.status?.lastRunStatus === "running") {
      setRunning(true);
    } else {
      setRunning(false);
    }
  }, [data?.status?.lastRunStatus]);

  async function handleRunNow() {
    setRunning(true);
    try {
      const res = await fetch("/api/rd-team", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Unknown error");
      setTimeout(fetchData, 2000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Failed to start run: ${msg}`);
      setRunning(false);
    }
  }

  // Parse all memos — right now API only returns latestContent, so we build one card
  const parsedMemos: Array<{ memo: Memo; parsed: ParsedMemo }> = [];
  if (data?.latestContent && data.memos.length > 0) {
    parsedMemos.push({
      memo: data.memos[0],
      parsed: parseMarkdown(data.latestContent, data.memos[0].date),
    });
  }
  // Stub placeholders for older memos (no content available yet)
  if (data?.memos && data.memos.length > 1) {
    for (let i = 1; i < data.memos.length; i++) {
      parsedMemos.push({
        memo: data.memos[i],
        parsed: parseMarkdown("", data.memos[i].date),
      });
    }
  }

  const totalMemos = data?.memos.length ?? 0;
  const lastRunAt = data?.status?.lastRunAt;
  const statusColor =
    data?.status?.lastRunStatus === "running"
      ? "#f59e0b"
      : data?.status?.lastRunStatus === "success"
      ? "#10b981"
      : data?.status?.lastRunStatus === "error"
      ? "#ef4444"
      : "var(--text-muted)";

  const SUB_TABS: Array<{ id: SubTab; label: string; icon: React.ReactNode }> = [
    { id: "trend-radar", label: "Trend Radar", icon: <Radar size={13} /> },
    { id: "opportunity-scanner", label: "Opportunity Scanner", icon: <Scan size={13} /> },
    { id: "rd-council", label: "R&D Council", icon: <Users size={13} /> },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--bg-primary)",
        fontFamily: MONO,
        overflow: "hidden",
      }}
    >
      {/* ── Top Bar: Title + Run Now ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 24px 0",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FlaskConical size={18} style={{ color: "var(--accent-purple)" }} />
          <span
            style={{
              fontFamily: MONO,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "var(--text-primary)",
            }}
          >
            HENRY RESEARCH LAB
          </span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 9,
              letterSpacing: "0.14em",
              color: "#c084fc",
              background: "#c084fc18",
              border: "1px solid #c084fc40",
              borderRadius: 3,
              padding: "2px 7px",
            }}
          >
            v0.1-ALPHA
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Status indicator */}
          {lastRunAt && (
            <span
              style={{
                fontFamily: MONO,
                fontSize: 9,
                color: statusColor,
                letterSpacing: "0.08em",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: statusColor,
                  display: "inline-block",
                  animation:
                    data?.status?.lastRunStatus === "running"
                      ? "pulse 1s infinite"
                      : undefined,
                }}
              />
              {data?.status?.lastRunStatus === "running" ? "RUNNING" : formatRelativeTime(lastRunAt)}
            </span>
          )}

          {/* Refresh */}
          <button
            onClick={fetchData}
            title="Refresh"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 5,
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "5px 8px",
            }}
          >
            <RefreshCw size={12} />
          </button>

          {/* Run Now */}
          <button
            onClick={handleRunNow}
            disabled={running}
            style={{
              fontFamily: MONO,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              background: running ? "var(--bg-secondary)" : "var(--accent-purple)",
              color: running ? "var(--text-muted)" : "#fff",
              border: "none",
              borderRadius: 5,
              padding: "6px 14px",
              cursor: running ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              opacity: running ? 0.7 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {running ? (
              <>
                <Loader2 size={11} className="animate-spin" />
                RUNNING...
              </>
            ) : (
              <>
                <Play size={11} />
                RUN NOW
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Sub-Tabs ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          padding: "12px 24px 0",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        {SUB_TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                fontFamily: MONO,
                fontSize: 10,
                fontWeight: active ? 700 : 500,
                letterSpacing: "0.1em",
                color: active ? "var(--text-primary)" : "var(--text-muted)",
                background: "transparent",
                border: "none",
                borderBottom: active ? "2px solid var(--accent-purple)" : "2px solid transparent",
                padding: "6px 16px 10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "color 0.15s",
                marginBottom: -1,
              }}
            >
              {tab.icon}
              {tab.label.toUpperCase()}
              {tab.id === "rd-council" && totalMemos > 0 && (
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 8,
                    background: active ? "var(--accent-purple)" : "var(--bg-hover)",
                    color: active ? "#fff" : "var(--text-muted)",
                    borderRadius: 3,
                    padding: "1px 5px",
                    marginLeft: 2,
                  }}
                >
                  {totalMemos}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Stats Bar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          padding: "0 24px",
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
          overflowX: "auto",
        }}
      >
        {[
          { label: "TOTAL MEMOS", value: loading ? "—" : String(totalMemos) },
          { label: "COUNCIL COST", value: "$0.00" },
          {
            label: "LAST SESSION",
            value: lastRunAt ? formatRelativeTime(lastRunAt) : "never",
          },
          { label: "SCHEDULE", value: "on demand" },
        ].map((stat, i) => (
          <div
            key={stat.label}
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "8px 20px",
              borderRight: i < 3 ? "1px solid var(--border-subtle)" : undefined,
              minWidth: 120,
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 8,
                letterSpacing: "0.14em",
                color: "var(--text-muted)",
                marginBottom: 2,
              }}
            >
              {stat.label}
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 12,
                fontWeight: 700,
                color: "var(--text-primary)",
                letterSpacing: "0.04em",
              }}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div
          style={{
            margin: "12px 24px 0",
            padding: "8px 14px",
            borderRadius: 5,
            background: "#ef444416",
            border: "1px solid #ef444430",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <AlertCircle size={13} style={{ color: "#ef4444" }} />
          <span style={{ fontFamily: MONO, fontSize: 10, color: "#ef4444", letterSpacing: "0.06em" }}>
            {error}
          </span>
        </div>
      )}

      {/* ── Tab Content ── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {activeTab === "trend-radar" && (
          <PlaceholderTab
            icon={<Radar size={28} style={{ color: "#60a5fa" }} />}
            label="TREND RADAR"
            subtitle="Monitors emerging patterns and signals across markets"
          />
        )}

        {activeTab === "opportunity-scanner" && (
          <PlaceholderTab
            icon={<Scan size={28} style={{ color: "#34d399" }} />}
            label="OPPORTUNITY SCANNER"
            subtitle="Scans for arbitrage opportunities and market inefficiencies"
          />
        )}

        {activeTab === "rd-council" && (
          <div className="fab-scroll-pad" style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            {loading ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 200,
                  gap: 12,
                  flexDirection: "column",
                }}
              >
                <Loader2 size={20} className="animate-spin" style={{ color: "var(--accent-purple)" }} />
                <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em" }}>
                  LOADING COUNCIL MEMOS...
                </span>
              </div>
            ) : parsedMemos.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 300,
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Zap size={28} style={{ color: "var(--accent-purple)" }} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontFamily: MONO,
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      color: "var(--text-primary)",
                      marginBottom: 6,
                    }}
                  >
                    NO MEMOS YET
                  </div>
                  <div
                    style={{
                      fontFamily: MONO,
                      fontSize: 10,
                      color: "var(--text-muted)",
                      letterSpacing: "0.06em",
                      marginBottom: 4,
                    }}
                  >
                    The R&D Council hasn&apos;t convened yet.
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.06em" }}>
                    Click <strong style={{ color: "var(--text-primary)" }}>RUN NOW</strong> to summon your agents.
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 9,
                    color: "var(--text-muted)",
                    letterSpacing: "0.1em",
                    padding: "4px 12px",
                    background: "var(--bg-secondary)",
                    border: "1px dashed var(--border-subtle)",
                    borderRadius: 4,
                  }}
                >
                  SCOUT · ANALYST · DEVIL&apos;S ADVOCATE · BUILDER · STRATEGIST
                </div>
              </div>
            ) : (
              <div style={{ maxWidth: 800 }}>
                {/* Council header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 20,
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 9,
                        letterSpacing: "0.14em",
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                      }}
                    >
                      {parsedMemos.length} memo{parsedMemos.length !== 1 ? "s" : ""} on file
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {Object.entries(AGENT_ROLES).map(([key, cfg]) => (
                      <span
                        key={key}
                        style={{
                          fontFamily: MONO,
                          fontSize: 8,
                          letterSpacing: "0.08em",
                          color: cfg.color,
                          background: cfg.bg,
                          border: `1px solid ${cfg.color}30`,
                          borderRadius: 3,
                          padding: "2px 6px",
                        }}
                      >
                        {cfg.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Memo cards */}
                {parsedMemos.map(({ memo, parsed }, idx) => (
                  <MemoCard key={memo.date} memo={memo} index={idx} parsed={parsed} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
