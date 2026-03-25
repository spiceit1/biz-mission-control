"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "backlog" | "in-progress" | "in-review" | "done";
  priority: "high" | "medium" | "low";
  assignee: string;
  createdAt?: string;
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  model?: string;
  status: "active" | "idle" | "standby" | "scheduled";
  statusText?: string | null;
  type: string;
}

interface LiveAgent {
  id: string;
  sessionKey?: string;
  name: string;
  emoji: string;
  role: string;
  model?: string;
  status: "active" | "completed" | "failed";
  taskSummary?: string;
  taskId?: string;
  startedAt: string;
  completedAt?: string;
}

interface ScannerInfo {
  lastScan: string | null;
  status: string;
  nextScanMins: number | null;
}

interface Stats {
  activeTasks: number;
  completedToday: number;
  activeAgents: number;
  totalAgents: number;
  liveAgentCount?: number;
}

interface FactoryData {
  tasks: Task[];
  agents: Agent[];
  liveAgents: LiveAgent[];
  scanner: ScannerInfo;
  stats: Stats;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ZONE_CONFIG = {
  backlog: {
    label: "BACKLOG",
    color: "#aaaaaa",
    bg: "#18181b",
    border: "#3a3a40",
    glow: "rgba(170,170,170,0.10)",
    icon: "📥",
    topBorder: "#666666",
  },
  "in-progress": {
    label: "IN PROGRESS",
    color: "#ffffff",
    bg: "#14112a",
    border: "#3d2e8c",
    glow: "rgba(124,92,252,0.12)",
    icon: "⚡",
    topBorder: "#7c5cfc",
  },
  "in-review": {
    label: "REVIEW",
    color: "#f0b429",
    bg: "#1e1800",
    border: "#5a4200",
    glow: "rgba(240,180,41,0.10)",
    icon: "🔍",
    topBorder: "#f0b429",
  },
  done: {
    label: "DONE",
    color: "#26c97a",
    bg: "#081a11",
    border: "#0f4428",
    glow: "rgba(38,201,122,0.10)",
    icon: "✅",
    topBorder: "#26c97a",
  },
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "#f05b5b",
  medium: "#f0b429",
  low: "#4d7cfe",
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function TaskDetailModal({
  task,
  onClose,
}: {
  task: Task;
  onClose: () => void;
}) {
  const priorityColor = PRIORITY_COLORS[task.priority] || "#aaaaaa";
  const statusColors: Record<string, string> = {
    backlog: "#9898a0",
    "in-progress": "#7c5cfc",
    "in-review": "#f0b429",
    done: "#26c97a",
  };
  const statusColor = statusColors[task.status] || "#9898a0";

  const dateObj = task.createdAt ? new Date(task.createdAt) : null;
  const date = dateObj && !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: "rgba(0,0,0,0.7)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: "12px",
          padding: "24px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}
      >
        {/* Title */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#ffffff", lineHeight: 1.4 }}>
            {task.title}
          </h2>
          <button
            onClick={onClose}
            style={{ color: "#888", background: "none", border: "none", cursor: "pointer", fontSize: "18px", lineHeight: 1, padding: "4px" }}
          >
            ✕
          </button>
        </div>

        {/* Badges */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
          <span style={{
            color: "#ffffff", background: priorityColor + "33", border: `1px solid ${priorityColor}60`,
            padding: "3px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 700, textTransform: "uppercase",
          }}>
            {task.priority}
          </span>
          <span style={{
            color: statusColor, background: statusColor + "18", border: `1px solid ${statusColor}40`,
            padding: "3px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 600,
          }}>
            {task.status}
          </span>
          <span style={{
            color: task.assignee === "shmack" ? "#7c5cfc" : "#26c97a",
            background: task.assignee === "shmack" ? "#7c5cfc18" : "#26c97a18",
            padding: "3px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 600,
          }}>
            {task.assignee === "shmack" ? "🤙 Shmack" : "👤 Douglas"}
          </span>
        </div>

        {/* Description */}
        {task.description && (
          <div style={{
            background: "var(--bg-tertiary, #1a1a2e)", border: "1px solid var(--border-subtle)",
            borderRadius: "6px", padding: "12px", marginBottom: "16px",
            fontSize: "14px", color: "#cccccc", lineHeight: 1.6,
          }}>
            {task.description}
          </div>
        )}

        {/* Date */}
        {date && (
          <div style={{ fontSize: "12px", color: "#888", marginBottom: "16px" }}>
            Created {date}
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "10px", borderRadius: "6px", fontSize: "14px", fontWeight: 600,
            background: "transparent", border: "1px solid var(--border-default)", color: "#aaa", cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function PixelTaskCard({ task, onSelect, isMobile }: { task: Task; onSelect: (task: Task) => void; isMobile: boolean }) {
  const priorityColor = PRIORITY_COLORS[task.priority] || "#aaaaaa";
  const isLong = task.title.length > 40;

  return (
    <div
      onClick={() => onSelect(task)}
      style={{
        background: "var(--bg-elevated)",
        border: `1px solid var(--border-subtle)`,
        borderLeft: `3px solid ${priorityColor}`,
        borderRadius: "4px",
        padding: isMobile ? "12px 14px" : "10px 12px",
        marginBottom: "8px",
        fontSize: isMobile ? "14px" : "13px",
        cursor: "pointer",
        minHeight: "50px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: "6px",
        transition: "border-color 0.15s ease",
        width: "100%",
        boxSizing: "border-box",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = priorityColor + "80"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.borderLeftColor = priorityColor; }}
    >
      <div
        style={{
          color: "#ffffff",
          lineHeight: "1.4",
          fontWeight: 600,
          maxWidth: "100%",
          // On mobile always wrap; on desktop truncate short titles
          ...(isMobile || isLong ? { whiteSpace: "normal" } : { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }),
        }}
        title={task.title}
      >
        {task.title}
      </div>
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <span
          style={{
            color: "#ffffff",
            background: priorityColor + "33",
            border: `1px solid ${priorityColor}60`,
            padding: "2px 6px",
            borderRadius: "2px",
            fontSize: "11px",
            textTransform: "uppercase",
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          {task.priority}
        </span>
        <span style={{ fontSize: "16px" }}>
          {task.assignee === "shmack" ? "🤙" : "👤"}
        </span>
      </div>
    </div>
  );
}

function AgentCharacter({
  agent,
  working,
}: {
  agent: Agent;
  working: boolean;
}) {
  const isActive = agent.status === "active";
  const isIdle = agent.status === "idle";
  const isOnFloor = isActive || isIdle;

  const dotColor =
    agent.status === "active"
      ? "#26c97a"
      : agent.status === "idle"
      ? "#4d7cfe"
      : agent.status === "scheduled"
      ? "#f0b429"
      : "#888888";

  const dotGlow =
    agent.status === "active" ? `0 0 5px #26c97a` : "none";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
        padding: "10px 8px",
        minWidth: "80px",
        opacity: isIdle ? 0.6 : 1,
        transition: "opacity 0.3s ease",
      }}
    >
      <div
        style={{
          width: "56px",
          height: "56px",
          background: isActive
            ? "linear-gradient(135deg, #1e1a3a 0%, #2a1e5a 100%)"
            : isIdle
            ? "linear-gradient(135deg, #1a1a2e 0%, #1e1a3a 100%)"
            : "var(--bg-elevated)",
          border: `2px solid ${isActive ? "#7c5cfc" : isIdle ? "#4d7cfe60" : "var(--border-subtle)"}`,
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "32px",
          boxShadow: isActive
            ? "0 0 12px rgba(124,92,252,0.4), inset 0 1px 0 rgba(255,255,255,0.08)"
            : "none",
          animation: isActive && working ? "agentBounce 1s ease-in-out infinite" : "none",
          position: "relative",
        }}
      >
        {agent.emoji}
        <div
          style={{
            position: "absolute",
            bottom: "3px",
            right: "3px",
            width: "8px",
            height: "8px",
            borderRadius: "2px",
            background: dotColor,
            boxShadow: dotGlow,
          }}
        />
      </div>

      {working && isOnFloor && (
        <div
          style={{
            width: "64px",
            height: "8px",
            background: "linear-gradient(180deg, #3a2e20 0%, #2a2018 100%)",
            borderRadius: "2px",
            border: "1px solid #4a3e28",
            boxShadow: "0 2px 4px rgba(0,0,0,0.6)",
            marginTop: "-4px",
          }}
        />
      )}

      <div
        style={{
          background: "var(--bg-elevated)",
          border: agent.name === "Mr. Shmack" ? "1px solid #f0b42980" : "1px solid var(--border-subtle)",
          borderRadius: "3px",
          padding: "3px 8px",
          fontSize: "12px",
          color: "#ffffff",
          textAlign: "center",
          whiteSpace: "nowrap",
          fontWeight: 600,
          fontFamily: "'Courier New', monospace",
          display: "flex",
          alignItems: "center",
          gap: "3px",
        }}
      >
        {agent.name === "Mr. Shmack" && (
          <span style={{ fontSize: "10px" }} title="Main Agent">👑</span>
        )}
        {agent.name}
      </div>

      <div
        style={{
          fontSize: "10px",
          color: isActive ? "#b8a0ff" : "#ffffff",
          textAlign: "center",
        }}
      >
        {agent.role}
      </div>

      {agent.statusText && (
        <div
          style={{
            fontSize: "9px",
            color: isActive ? "#26c97a" : "#888888",
            textAlign: "center",
            maxWidth: "100px",
            lineHeight: 1.3,
            fontWeight: isActive ? 600 : 400,
          }}
        >
          {agent.statusText}
        </div>
      )}

      {agent.model && (
        <div
          style={{
            fontSize: "9px",
            color: "#ffffff",
            textAlign: "center",
            marginTop: 2,
            padding: "1px 6px",
            background: "#7c5cfc18",
            borderRadius: 8,
            whiteSpace: "nowrap",
          }}
        >
          {agent.model}
        </div>
      )}
    </div>
  );
}

function LiveAgentCard({ agent }: { agent: LiveAgent }) {
  const isActive = agent.status === "active";
  const isCompleted = agent.status === "completed";

  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const started = new Date(agent.startedAt).getTime();
    const update = () => {
      const end = agent.completedAt ? new Date(agent.completedAt).getTime() : Date.now();
      const secs = Math.floor((end - started) / 1000);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      if (m > 0) setElapsed(`${m}m ${s}s`);
      else setElapsed(`${s}s`);
    };
    update();
    if (isActive) {
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }
  }, [agent.startedAt, agent.completedAt, isActive]);

  const modelColor = agent.model?.includes("opus")
    ? "#f0b429"
    : agent.model?.includes("haiku")
    ? "#26c97a"
    : "#7c5cfc";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
        padding: "12px 10px",
        minWidth: "100px",
        maxWidth: "140px",
        background: isActive
          ? "linear-gradient(135deg, #0f1a2e 0%, #1a1040 100%)"
          : isCompleted
          ? "linear-gradient(135deg, #081a11 0%, #0f2a1a 100%)"
          : "var(--bg-elevated)",
        border: isActive
          ? "1px solid #4d7cfe80"
          : isCompleted
          ? "1px solid #26c97a60"
          : "1px solid #f05b5b60",
        borderRadius: "6px",
        position: "relative",
        animation: isActive ? "liveAgentGlow 2s ease-in-out infinite" : "none",
        opacity: isCompleted ? 0.75 : 1,
        transition: "opacity 0.5s ease",
      }}
    >
      {isActive && (
        <div
          style={{
            position: "absolute",
            top: "-6px",
            right: "-6px",
            background: "#f05b5b",
            color: "#ffffff",
            fontSize: "8px",
            fontWeight: 800,
            padding: "2px 5px",
            borderRadius: "3px",
            letterSpacing: "0.1em",
            animation: "scannerPulse 1.5s ease-in-out infinite",
          }}
        >
          LIVE
        </div>
      )}

      {isCompleted && (
        <div
          style={{
            position: "absolute",
            top: "-6px",
            right: "-6px",
            background: "#26c97a",
            color: "#ffffff",
            fontSize: "10px",
            fontWeight: 800,
            padding: "1px 4px",
            borderRadius: "3px",
          }}
        >
          ✓
        </div>
      )}

      <div
        style={{
          width: "48px",
          height: "48px",
          background: isActive
            ? "linear-gradient(135deg, #1e1a3a 0%, #2a1e5a 100%)"
            : isCompleted
            ? "linear-gradient(135deg, #0a2015 0%, #15402a 100%)"
            : "var(--bg-elevated)",
          border: `2px solid ${isActive ? "#4d7cfe" : isCompleted ? "#26c97a" : "#f05b5b"}`,
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "26px",
          boxShadow: isActive
            ? "0 0 16px rgba(77,124,254,0.5)"
            : isCompleted
            ? "0 0 8px rgba(38,201,122,0.3)"
            : "none",
          animation: isActive ? "agentBounce 1s ease-in-out infinite" : "none",
        }}
      >
        {agent.emoji}
      </div>

      {isActive && (
        <div
          style={{
            width: "56px",
            height: "6px",
            background: "linear-gradient(180deg, #3a2e20 0%, #2a2018 100%)",
            borderRadius: "2px",
            border: "1px solid #4a3e28",
            marginTop: "-4px",
          }}
        />
      )}

      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          color: "#ffffff",
          textAlign: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "120px",
        }}
        title={agent.name}
      >
        {agent.name}
      </div>

      {agent.taskSummary && (
        <div
          style={{
            fontSize: "9px",
            color: "#ffffff",
            opacity: 0.7,
            textAlign: "center",
            lineHeight: 1.3,
            maxWidth: "120px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
          title={agent.taskSummary}
        >
          {agent.taskSummary.length > 60
            ? agent.taskSummary.slice(0, 57) + "..."
            : agent.taskSummary}
        </div>
      )}

      <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
        {agent.model && (
          <span
            style={{
              fontSize: "9px",
              color: modelColor,
              padding: "1px 6px",
              background: modelColor + "18",
              border: `1px solid ${modelColor}40`,
              borderRadius: "8px",
              fontWeight: 700,
            }}
          >
            {agent.model}
          </span>
        )}
        <span
          style={{
            fontSize: "9px",
            color: isActive ? "#4d7cfe" : "#26c97a",
            fontWeight: 600,
          }}
        >
          {elapsed}
        </span>
      </div>
    </div>
  );
}

// ─── Mobile Zone Section ──────────────────────────────────────────────────────

function MobileZoneSection({
  zoneKey,
  tasks,
  agents,
  liveAgents = [],
  onSelectTask,
}: {
  zoneKey: keyof typeof ZONE_CONFIG;
  tasks: Task[];
  agents: Agent[];
  liveAgents?: LiveAgent[];
  onSelectTask: (task: Task) => void;
}) {
  const cfg = ZONE_CONFIG[zoneKey];
  const [collapsed, setCollapsed] = useState(zoneKey === "done");

  const workingAgents = agents.filter((a) => {
    if (zoneKey === "in-progress") return a.status === "active" || a.status === "idle";
    return false;
  });
  const zoneLiveAgents = liveAgents.filter((a) => {
    if (zoneKey === "in-progress") return a.status === "active";
    if (zoneKey === "done") return a.status === "completed" || a.status === "failed";
    return false;
  });

  return (
    <div
      style={{
        width: "100%",
        background: "var(--bg-secondary)",
        border: `1px solid var(--border-subtle)`,
        borderTop: `3px solid ${cfg.topBorder}`,
        borderRadius: "6px",
        overflow: "hidden",
        marginBottom: "10px",
      }}
    >
      {/* Header — tap to collapse/expand */}
      <div
        onClick={() => setCollapsed((c) => !c)}
        style={{
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: "18px" }}>{cfg.icon}</span>
        <span
          style={{
            fontSize: "15px",
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            fontFamily: "'Courier New', monospace",
            flex: 1,
          }}
        >
          {cfg.label}
        </span>
        <span
          style={{
            fontSize: "13px",
            color: "#ffffff",
            background: cfg.topBorder + "40",
            border: `1px solid ${cfg.topBorder}60`,
            padding: "2px 10px",
            borderRadius: "3px",
            fontWeight: 700,
            minWidth: "26px",
            textAlign: "center",
          }}
        >
          {tasks.length}
        </span>
        <span style={{ fontSize: "12px", color: "#888", marginLeft: "4px" }}>
          {collapsed ? "▶" : "▼"}
        </span>
      </div>

      {!collapsed && (
        <div style={{ borderTop: `1px solid var(--border-subtle)` }}>
          {/* Agents row */}
          {workingAgents.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "6px", padding: "12px 8px 6px" }}>
              {workingAgents.map((agent) => (
                <AgentCharacter key={agent.id} agent={agent} working={true} />
              ))}
            </div>
          )}

          {/* Live agents row */}
          {zoneLiveAgents.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "8px", padding: "12px 8px 8px", borderBottom: `1px solid var(--border-subtle)` }}>
              {zoneLiveAgents.map((agent) => (
                <LiveAgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          )}

          {/* Task cards */}
          <div style={{ padding: "12px 14px" }}>
            {tasks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 12px", fontSize: "13px", color: "#ffffff", opacity: 0.4, letterSpacing: "0.08em" }}>
                [ EMPTY ]
              </div>
            ) : (
              tasks.map((task) => (
                <PixelTaskCard key={task.id} task={task} onSelect={onSelectTask} isMobile={true} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Desktop Zone ─────────────────────────────────────────────────────────────

function FactoryZone({
  zoneKey,
  tasks,
  agents,
  liveAgents = [],
  onSelectTask,
}: {
  zoneKey: keyof typeof ZONE_CONFIG;
  tasks: Task[];
  agents: Agent[];
  liveAgents?: LiveAgent[];
  onSelectTask: (task: Task) => void;
}) {
  const cfg = ZONE_CONFIG[zoneKey];
  const workingAgents = agents.filter((a) => {
    if (zoneKey === "in-progress") return a.status === "active" || a.status === "idle";
    return false;
  });

  const zoneLiveAgents = liveAgents.filter((a) => {
    if (zoneKey === "in-progress") return a.status === "active";
    if (zoneKey === "done") return a.status === "completed" || a.status === "failed";
    return false;
  });

  return (
    <div
      style={{
        flex: 1,
        minWidth: "280px",
        background: "var(--bg-secondary)",
        border: `1px solid var(--border-subtle)`,
        borderTop: `3px solid ${cfg.topBorder}`,
        borderRadius: "6px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        height: "100%",
      }}
    >
      {/* Zone header */}
      <div
        style={{
          padding: "12px 14px",
          borderBottom: `1px solid var(--border-subtle)`,
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span style={{ fontSize: "16px" }}>{cfg.icon}</span>
        <span
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            fontFamily: "'Courier New', monospace",
          }}
        >
          {cfg.label}
        </span>
        <span
          style={{
            fontSize: "9px",
            color: cfg.topBorder,
            opacity: 0.7,
            fontFamily: "'Courier New', monospace",
            letterSpacing: "0px",
          }}
          title="task flow direction"
        >
          ▶▶
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: "13px",
            color: "#ffffff",
            background: cfg.topBorder + "40",
            border: `1px solid ${cfg.topBorder}60`,
            padding: "2px 8px",
            borderRadius: "3px",
            fontWeight: 700,
            minWidth: "26px",
            textAlign: "center",
          }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Agents row (for in-progress) */}
      {workingAgents.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: "6px",
            padding: "12px 8px 6px",
            borderBottom: zoneLiveAgents.length > 0 ? "none" : `1px solid var(--border-subtle)`,
          }}
        >
          {workingAgents.map((agent) => (
            <AgentCharacter key={agent.id} agent={agent} working={true} />
          ))}
        </div>
      )}

      {/* Live agents row */}
      {zoneLiveAgents.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: "8px",
            padding: "12px 8px 8px",
            borderBottom: `1px solid var(--border-subtle)`,
          }}
        >
          {zoneLiveAgents.map((agent) => (
            <LiveAgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      {/* Tasks list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
        }}
      >
        {tasks.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "30px 12px",
              fontSize: "12px",
              color: "#ffffff",
              opacity: 0.4,
              letterSpacing: "0.08em",
              userSelect: "none",
            }}
          >
            [ EMPTY ]
          </div>
        ) : (
          tasks.map((task) => <PixelTaskCard key={task.id} task={task} onSelect={onSelectTask} isMobile={false} />)
        )}
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  color,
  isMobile,
}: {
  label: string;
  value: string | number;
  color: string;
  isMobile?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "3px",
        padding: isMobile ? "8px 12px" : "10px 18px",
        background: "var(--bg-elevated)",
        border: `1px solid var(--border-subtle)`,
        borderRadius: "4px",
        minWidth: isMobile ? "70px" : "100px",
        flex: isMobile ? "1 1 auto" : "none",
      }}
    >
      <span
        style={{
          fontSize: isMobile ? "16px" : "20px",
          fontWeight: 700,
          color: color,
          textShadow: `0 0 10px ${color}80`,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: isMobile ? "9px" : "11px",
          color: "#ffffff",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgentFactoryPage() {
  const [data, setData] = useState<FactoryData | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [uptime, setUptime] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/factory");
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch (e) {
      console.error("Factory fetch error:", e);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const start = Date.now();
    const ticker = setInterval(() => {
      setUptime(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  const formatUptime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatScanTime = (iso: string | null) => {
    if (!iso) return "never";
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  const tasks = data?.tasks || [];
  const agents = data?.agents || [];
  const liveAgents = data?.liveAgents || [];
  const stats = data?.stats || { activeTasks: 0, completedToday: 0, activeAgents: 0, totalAgents: 0, liveAgentCount: 0 };
  const scanner = data?.scanner || { lastScan: null, status: "unknown", nextScanMins: null };

  const zones = (["backlog", "in-progress", "in-review", "done"] as const);

  return (
    <>
      <style>{`
        @keyframes agentBounce {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        @keyframes scannerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes pixelBlink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes factoryGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(124,92,252,0.1); }
          50% { box-shadow: 0 0 40px rgba(124,92,252,0.2); }
        }
        @keyframes liveAgentGlow {
          0%, 100% { box-shadow: 0 0 8px rgba(77,124,254,0.2), inset 0 0 8px rgba(77,124,254,0.05); }
          50% { box-shadow: 0 0 20px rgba(77,124,254,0.4), inset 0 0 12px rgba(77,124,254,0.1); }
        }
        @keyframes tickerScroll {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          background: "var(--bg-primary)",
          overflow: "hidden",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          style={{
            flexShrink: 0,
            padding: isMobile ? "10px 14px" : "14px 24px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-elevated)",
            display: "flex",
            alignItems: "center",
            gap: isMobile ? "10px" : "20px",
            flexWrap: isMobile ? "wrap" : "nowrap",
          }}
        >
          {/* Title */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ fontSize: isMobile ? "18px" : "22px", animation: "factoryGlow 3s ease-in-out infinite" }}>
              🏭
            </div>
            <div>
              <div style={{ fontSize: isMobile ? "16px" : "20px", fontWeight: 700, color: "#ffffff", letterSpacing: "0.10em" }}>
                AGENT FACTORY
              </div>
              {!isMobile && (
                <div style={{ fontSize: "11px", color: "#ffffff", opacity: 0.5, letterSpacing: "0.08em" }}>
                  MISSION CONTROL v1.0
                </div>
              )}
            </div>
          </div>

          {/* Refresh indicator — inline on mobile */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 9px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "3px",
              marginLeft: isMobile ? "auto" : undefined,
            }}
          >
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "1px",
                background: "#26c97a",
                animation: "scannerPulse 2s ease-in-out infinite",
              }}
            />
            <span style={{ fontSize: "10px", color: "#ffffff", letterSpacing: "0.05em" }}>
              {lastRefresh
                ? lastRefresh.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
                : "LOADING"}
            </span>
          </div>

          {/* Live stats pills — full row on mobile */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              alignItems: "center",
              flexWrap: "wrap",
              width: isMobile ? "100%" : "auto",
              marginLeft: isMobile ? "0" : "auto",
            }}
          >
            <StatPill label="Active"      value={stats.activeTasks}                             color="#7c5cfc" isMobile={isMobile} />
            <StatPill label="Done Today"  value={stats.completedToday}                          color="#26c97a" isMobile={isMobile} />
            <StatPill label="Agents"      value={`${stats.activeAgents}/${stats.totalAgents}`}  color="#4d7cfe" isMobile={isMobile} />
            {(stats.liveAgentCount || 0) > 0 && (
              <StatPill label="Live"       value={stats.liveAgentCount || 0}                     color="#f05b5b" isMobile={isMobile} />
            )}
            <StatPill label="Uptime"      value={formatUptime(uptime)}                          color="#f0b429" isMobile={isMobile} />
          </div>
        </div>

        {/* ── Standby agents bar ──────────────────────────────────────────── */}
        {agents.filter((a) => a.status === "standby" || a.status === "scheduled").length > 0 && (
          <div
            style={{
              flexShrink: 0,
              padding: isMobile ? "8px 14px" : "8px 24px",
              borderBottom: "1px solid var(--border-subtle)",
              background: "var(--bg-elevated)",
              display: "flex",
              alignItems: isMobile ? "flex-start" : "center",
              gap: "8px",
              flexWrap: "wrap",
              overflowX: "visible",
            }}
          >
            <span style={{ fontSize: "12px", color: "#ffffff", letterSpacing: "0.12em", fontWeight: 700, flexShrink: 0 }}>
              STANDBY:
            </span>
            {agents
              .filter((a) => a.status === "standby" || a.status === "scheduled")
              .map((agent) => (
                <div
                  key={agent.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 12px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "4px",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: "18px" }}>{agent.emoji}</span>
                  <div>
                    <div style={{ fontSize: "13px", color: "#ffffff", fontWeight: 600 }}>{agent.name}</div>
                    <div style={{ fontSize: "11px", color: agent.status === "scheduled" ? "#f0b429" : "#ffffff", opacity: agent.status === "scheduled" ? 1 : 0.6, letterSpacing: "0.05em" }}>
                      {agent.status === "scheduled" ? "⏰ SCHEDULED" : "💤 STANDBY"}
                    </div>
                    {agent.statusText && (
                      <div style={{ fontSize: "9px", color: "#888888", marginTop: 2 }}>{agent.statusText}</div>
                    )}
                    {agent.model && (
                      <div style={{ fontSize: "9px", color: "#ffffff", marginTop: 2 }}>{agent.model}</div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* ── Active agents roster ─────────────────────────────────────── */}
        {liveAgents.length > 0 && (
          <div
            style={{
              flexShrink: 0,
              padding: isMobile ? "10px 14px" : "10px 24px",
              borderBottom: "1px solid var(--border-subtle)",
              background: "var(--bg-elevated)",
              display: "flex",
              alignItems: isMobile ? "flex-start" : "center",
              gap: "10px",
              flexWrap: "wrap",
              overflowX: "auto",
            }}
          >
            <span style={{ fontSize: "12px", color: "#ffffff", letterSpacing: "0.12em", fontWeight: 700, flexShrink: 0 }}>
              AGENTS:
            </span>
            {liveAgents.map((agent) => (
              <div
                key={agent.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 12px",
                  background: agent.status === "active"
                    ? "linear-gradient(135deg, #0f1a2e 0%, #1a1040 100%)"
                    : agent.status === "completed"
                    ? "linear-gradient(135deg, #081a11 0%, #0f2a1a 100%)"
                    : "var(--bg-secondary)",
                  border: agent.status === "active"
                    ? "1px solid #4d7cfe80"
                    : agent.status === "completed"
                    ? "1px solid #26c97a60"
                    : "1px solid var(--border-subtle)",
                  borderRadius: "4px",
                  flexShrink: 0,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: "18px" }}>{agent.emoji}</span>
                <div>
                  <div style={{ fontSize: "13px", color: "#ffffff", fontWeight: 600 }}>{agent.name}</div>
                  <div style={{ fontSize: "10px", color: agent.status === "active" ? "#4d7cfe" : agent.status === "completed" ? "#26c97a" : "#f05b5b", letterSpacing: "0.05em", fontWeight: 600 }}>
                    {agent.status === "active" ? "🔴 LIVE" : agent.status === "completed" ? "✅ DONE" : agent.status.toUpperCase()}
                  </div>
                  {agent.taskSummary && (
                    <div style={{ fontSize: "9px", color: "#888888", marginTop: 2, maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.taskSummary}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Factory floor ──────────────────────────────────────────────── */}
        {isMobile ? (
          /* ── MOBILE: vertical stacked sections ── */
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 12px 4px",
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          >
            {zones.map((zoneKey) => (
              <MobileZoneSection
                key={zoneKey}
                zoneKey={zoneKey}
                tasks={tasks.filter((t) => t.status === zoneKey)}
                agents={agents}
                liveAgents={liveAgents}
                onSelectTask={setSelectedTask}
              />
            ))}
          </div>
        ) : (
          /* ── DESKTOP: horizontal columns ── */
          <div
            style={{
              flex: 1,
              display: "flex",
              gap: "0",
              padding: "16px 20px",
              overflow: "hidden",
              minHeight: 0,
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          >
            {zones.map((zoneKey, idx) => (
              <div key={zoneKey} style={{ display: "flex", flex: 1, minWidth: 0, alignItems: "stretch" }}>
                <div style={{ flex: 1, minWidth: "280px", display: "flex", flexDirection: "column" }}>
                  <FactoryZone
                    zoneKey={zoneKey}
                    tasks={tasks.filter((t) => t.status === zoneKey)}
                    agents={agents}
                    liveAgents={liveAgents}
                    onSelectTask={setSelectedTask}
                  />
                </div>
                {idx < zones.length - 1 && <div style={{ width: "12px", flexShrink: 0 }} />}
              </div>
            ))}
          </div>
        )}

        {/* ── Bottom stats bar ───────────────────────────────────────────── */}
        <div
          style={{
            flexShrink: 0,
            padding: isMobile ? "8px 80px 8px 12px" : "10px 24px",
            borderTop: "1px solid var(--border-subtle)",
            background: "var(--bg-secondary)",
            display: "flex",
            alignItems: isMobile ? "flex-start" : "center",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? "8px" : "24px",
            overflowX: isMobile ? "visible" : "auto",
          }}
        >
          {isMobile ? (
            /* Mobile bottom bar: stacked rows */
            <>
              {/* Row 1: scanner status + last scan */}
              <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div
                    style={{
                      width: "8px", height: "8px", borderRadius: "2px",
                      background: scanner.status === "running" ? "#26c97a" : "#4d7cfe",
                      animation: scanner.status === "running" ? "scannerPulse 0.8s ease-in-out infinite" : "none",
                      boxShadow: scanner.status === "running" ? "0 0 6px #26c97a" : "none",
                    }}
                  />
                  <span style={{ fontSize: "14px", color: "#ffffff" }}>
                    Scanner:{" "}
                    <span style={{ color: scanner.status === "running" ? "#26c97a" : "#f0b429", fontWeight: 700 }}>
                      {scanner.status.toUpperCase()}
                    </span>
                  </span>
                </div>
                <span style={{ fontSize: "14px", color: "#ffffff" }}>
                  Last: <span style={{ fontWeight: 600 }}>{formatScanTime(scanner.lastScan)}</span>
                </span>
                {scanner.nextScanMins !== null && (
                  <span style={{ fontSize: "14px", color: "#ffffff" }}>
                    Next:{" "}
                    <span style={{ color: (scanner.nextScanMins || 0) < 10 ? "#f0b429" : "#ffffff", fontWeight: 600 }}>
                      {scanner.nextScanMins === 0 ? "NOW" : `${scanner.nextScanMins}m`}
                    </span>
                  </span>
                )}
              </div>

              {/* Row 2: task count breakdown */}
              <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center" }}>
                {(["backlog", "in-progress", "in-review", "done"] as const).map((zone) => {
                  const cfg = ZONE_CONFIG[zone];
                  const count = tasks.filter((t) => t.status === zone).length;
                  return (
                    <span key={zone} style={{ fontSize: "14px", color: "#ffffff" }}>
                      <span style={{ color: cfg.topBorder, fontWeight: 700 }}>{count}</span>{" "}
                      <span style={{ opacity: 0.7, fontSize: "12px" }}>{cfg.label}</span>
                    </span>
                  );
                })}
                {liveAgents.filter(a => a.status === "active").length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: "#f05b5b", animation: "scannerPulse 1s ease-in-out infinite", boxShadow: "0 0 6px #f05b5b" }} />
                    <span style={{ fontSize: "14px", color: "#f05b5b", fontWeight: 700 }}>
                      {liveAgents.filter(a => a.status === "active").length} Live
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Desktop bottom bar: original horizontal layout */
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    width: "8px", height: "8px", borderRadius: "2px",
                    background: scanner.status === "running" ? "#26c97a" : "#4d7cfe",
                    animation: scanner.status === "running" ? "scannerPulse 0.8s ease-in-out infinite" : "none",
                    boxShadow: scanner.status === "running" ? "0 0 6px #26c97a" : "none",
                  }}
                />
                <span style={{ fontSize: "13px", color: "#ffffff" }}>
                  Scanner:{" "}
                  <span style={{ color: scanner.status === "running" ? "#26c97a" : "#f0b429", fontWeight: 700 }}>
                    {scanner.status.toUpperCase()}
                  </span>
                </span>
              </div>

              <div style={{ width: "1px", height: "18px", background: "var(--border-subtle)" }} />

              <span style={{ fontSize: "13px", color: "#ffffff" }}>
                Last Scan: <span style={{ fontWeight: 600 }}>{formatScanTime(scanner.lastScan)}</span>
              </span>

              {scanner.nextScanMins !== null && (
                <>
                  <div style={{ width: "1px", height: "18px", background: "var(--border-subtle)" }} />
                  <span style={{ fontSize: "13px", color: "#ffffff" }}>
                    Next Scan:{" "}
                    <span style={{ color: (scanner.nextScanMins || 0) < 10 ? "#f0b429" : "#ffffff", fontWeight: 600 }}>
                      {scanner.nextScanMins === 0 ? "NOW" : `in ${scanner.nextScanMins} min`}
                    </span>
                  </span>
                </>
              )}

              {liveAgents.filter(a => a.status === "active").length > 0 && (
                <>
                  <div style={{ width: "1px", height: "18px", background: "var(--border-subtle)" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: "#f05b5b", animation: "scannerPulse 1s ease-in-out infinite", boxShadow: "0 0 6px #f05b5b" }} />
                    <span style={{ fontSize: "13px", color: "#ffffff" }}>
                      Live Agents: <span style={{ color: "#f05b5b", fontWeight: 700 }}>{liveAgents.filter(a => a.status === "active").length}</span>
                    </span>
                  </div>
                </>
              )}

              {/* Ticker tape */}
              <div
                style={{
                  flex: 1,
                  overflow: "hidden",
                  position: "relative",
                  height: "22px",
                  margin: "0 8px",
                  background: "#0a0a14",
                  border: "1px solid #2e2e4a",
                  borderRadius: "2px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "32px", background: "linear-gradient(90deg, #0a0a14 0%, transparent 100%)", zIndex: 1, pointerEvents: "none" }} />
                <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "32px", background: "linear-gradient(270deg, #0a0a14 0%, transparent 100%)", zIndex: 1, pointerEvents: "none" }} />
                <div
                  style={{
                    display: "inline-block",
                    whiteSpace: "nowrap",
                    animation: "tickerScroll 22s linear infinite",
                    fontSize: "10px",
                    fontFamily: "'Courier New', monospace",
                    color: "#7c5cfc99",
                    letterSpacing: "0.12em",
                    paddingLeft: "100%",
                  }}
                >
                  {tasks.length > 0
                    ? tasks
                        .filter((t) => t.status === "in-progress" || t.status === "in-review")
                        .concat(tasks.filter((t) => t.status === "backlog").slice(0, 3))
                        .map((t) => `  ▶  ${t.title.toUpperCase()}`)
                        .join("  ·  ") || `  ▶  FACTORY FLOOR OPERATIONAL  ·  AWAITING TASKS`
                    : `  ▶  FACTORY FLOOR OPERATIONAL  ·  ALL SYSTEMS NOMINAL  ·  READY`
                  }
                </div>
              </div>

              {/* Task count breakdown */}
              <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                {(["backlog", "in-progress", "in-review", "done"] as const).map((zone) => {
                  const cfg = ZONE_CONFIG[zone];
                  const count = tasks.filter((t) => t.status === zone).length;
                  return (
                    <span key={zone} style={{ fontSize: "13px", color: "#ffffff" }}>
                      <span style={{ color: cfg.topBorder, fontWeight: 700 }}>{count}</span>{" "}
                      {cfg.label}
                    </span>
                  );
                })}
              </div>

              <div style={{ width: "1px", height: "18px", background: "var(--border-subtle)" }} />

              <span style={{ fontSize: "14px", color: "#ffffff", animation: "pixelBlink 1s step-end infinite" }}>█</span>
            </>
          )}
        </div>
      </div>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </>
  );
}
