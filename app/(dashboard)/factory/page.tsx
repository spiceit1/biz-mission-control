"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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
  description?: string;
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
  characterConfig?: {
    skinColor?: string;
    hairStyle?: string;
    hairColor?: string;
    premium?: boolean;
    mugText?: string;
  };
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

// ─── Walking Animation State ────────────────────────────────────────────────

interface WalkingAgent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  model?: string;
  characterConfig?: { skinColor?: string; hairStyle?: string; hairColor?: string; premium?: boolean; mugText?: string };
  direction: "toWork" | "toDesk";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startTime: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ZONE_CONFIG = {
  backlog: {
    label: "BACKLOG",
    tooltip: "Tasks waiting to be picked up. No agent assigned yet.",
    color: "#aaaaaa",
    bg: "#18181b",
    border: "#3a3a40",
    glow: "rgba(170,170,170,0.10)",
    icon: "📥",
    topBorder: "#666666",
  },
  "in-progress": {
    label: "IN PROGRESS",
    tooltip: "Tasks being actively worked on. Primary agents and sub-agents appear here while working.",
    color: "#ffffff",
    bg: "#14112a",
    border: "#3d2e8c",
    glow: "rgba(124,92,252,0.12)",
    icon: "⚡",
    topBorder: "#7c5cfc",
  },
  "in-review": {
    label: "REVIEW",
    tooltip: "Tasks completed by an agent, waiting for human review or approval.",
    color: "#f0b429",
    bg: "#1e1800",
    border: "#5a4200",
    glow: "rgba(240,180,41,0.10)",
    icon: "🔍",
    topBorder: "#f0b429",
  },
  done: {
    label: "DONE",
    tooltip: "Completed tasks and finished sub-agents. Sub-agents appear here for 24 hours after completion.",
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

const WALK_DURATION = 1500; // ms

// ─── Helper: Agent color classification ──────────────────────────────────────

function getAgentColor(role: string, status?: string): { shirt: string; border: string; glow: string; bg: string } {
  if (role === "Sub-Agent") {
    return { shirt: "#26c97a", border: "#46e99a", glow: "rgba(38,201,122,0.5)", bg: "#0a1a10" };
  }
  if (role === "Dedicated Agent" || status === "standby" || status === "scheduled") {
    return { shirt: "#4d7cfe", border: "#6d9cff", glow: "rgba(77,124,254,0.5)", bg: "#0f1a2e" };
  }
  return { shirt: "#7c5cfc", border: "#9b7cff", glow: "rgba(124,92,252,0.5)", bg: "#1a1030" };
}

function isPrimaryAgent(role: string, status?: string): boolean {
  return role !== "Sub-Agent" && role !== "Dedicated Agent" && status !== "standby" && status !== "scheduled";
}

function isDedicatedAgent(role: string, status?: string): boolean {
  return role === "Dedicated Agent" || status === "standby" || status === "scheduled";
}

function isShmack(agent: { id?: string; name?: string }): boolean {
  return agent.id === "shmack" || agent.name === "Mr. Shmack";
}

// ─── CSS Variables for Factory Theme ─────────────────────────────────────────

const FACTORY_VARS = {
  appBg: "#11141c",
  appBg2: "#151926",
  cardInterior: "#081225",
  cardInterior2: "#0b1730",
  accentPrimary: "#7c4dff",
  accentDedicated: "#3b82ff",
  accentSubAgent: "#26c97a",
  desk: "#1b2230",
  desk2: "#222b3d",
  deskFront: "#151c2a",
  chairBase: "#6b4f3a",
  chairHighlight: "#8a674f",
  chairShadow: "#3e2c20",
  skinDefault: "#d4a574",
  skinShmack: "#f5d0b0",
  shirtBlue: "#4488dd",
};

// ─── Premium Office Chair Component ──────────────────────────────────────────

function OfficeChair({ empty = false, scale = 1, premium = false }: { empty?: boolean; scale?: number; premium?: boolean }) {
  const s = scale;
  // Premium chair: richer leather, gold accents, taller backrest
  const base = premium ? "#7a5a3a" : FACTORY_VARS.chairBase;
  const highlight = premium ? "#a07850" : FACTORY_VARS.chairHighlight;
  const shadow = premium ? "#4a3220" : FACTORY_VARS.chairShadow;
  const stitch = premium ? "#c49a60" : FACTORY_VARS.chairHighlight;
  const metalColor = premium ? "#b8960a" : "#555";
  const metalHighlight = premium ? "#d4b020" : "#444";
  const wheelColor = premium ? "#665520" : "#444";
  const wheelBorder = premium ? "#887730" : "#555";
  const backrestH = premium ? (empty ? 52 : 44) : (empty ? 44 : 36);
  const headrestH = premium ? 18 : 14;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      position: "relative",
    }}>
      {/* Headrest */}
      <div style={{
        width: 32 * s,
        height: headrestH * s,
        background: `linear-gradient(180deg, ${highlight} 0%, ${base} 100%)`,
        borderRadius: `${8 * s}px ${8 * s}px ${4 * s}px ${4 * s}px`,
        border: `1.5px solid ${shadow}`,
        boxShadow: `inset 0 2px 4px rgba(138,103,79,0.3), inset 0 -2px 3px rgba(62,44,32,0.3)${premium ? `, 0 0 6px rgba(180,150,10,0.15)` : ""}`,
        marginBottom: 2 * s,
        zIndex: 1,
        position: "relative",
      }}>
        {/* Premium gold trim on headrest */}
        {premium && (
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: "70%", height: 2, background: "linear-gradient(90deg, transparent, #d4b02060, #d4b020, #d4b02060, transparent)",
            borderRadius: 1,
          }} />
        )}
      </div>
      {/* Backrest */}
      <div style={{
        width: 40 * s,
        height: backrestH * s,
        background: `linear-gradient(180deg, ${base} 0%, ${shadow} 100%)`,
        borderRadius: `${6 * s}px ${6 * s}px ${10 * s}px ${10 * s}px`,
        border: `1.5px solid ${shadow}`,
        boxShadow: `inset 0 4px 8px rgba(138,103,79,0.2), inset 0 -4px 6px rgba(62,44,32,0.4)${premium ? `, 0 0 8px rgba(180,150,10,0.1)` : ""}`,
        position: "relative",
        zIndex: 1,
      }}>
        {/* Leather stitching lines */}
        <div style={{
          position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
          width: "60%", height: "1px", background: stitch, opacity: premium ? 0.5 : 0.3,
        }} />
        <div style={{
          position: "absolute", top: "45%", left: "50%", transform: "translateX(-50%)",
          width: "60%", height: "1px", background: stitch, opacity: premium ? 0.5 : 0.3,
        }} />
        <div style={{
          position: "absolute", top: "70%", left: "50%", transform: "translateX(-50%)",
          width: "60%", height: "1px", background: stitch, opacity: premium ? 0.4 : 0.25,
        }} />
        {/* Diamond tufting for premium */}
        {premium && (
          <>
            <div style={{
              position: "absolute", top: "32%", left: "50%", transform: "translate(-50%, -50%)",
              width: 6 * s, height: 6 * s, borderRadius: "50%",
              background: highlight, opacity: 0.3,
              boxShadow: `inset 0 1px 2px rgba(0,0,0,0.3)`,
            }} />
            <div style={{
              position: "absolute", top: "58%", left: "50%", transform: "translate(-50%, -50%)",
              width: 6 * s, height: 6 * s, borderRadius: "50%",
              background: highlight, opacity: 0.3,
              boxShadow: `inset 0 1px 2px rgba(0,0,0,0.3)`,
            }} />
          </>
        )}
      </div>
      {/* Armrests */}
      <div style={{
        position: "absolute",
        top: (premium ? (empty ? 48 : 40) : (empty ? 42 : 34)) * s,
        left: -6 * s,
        width: (premium ? 12 : 10) * s,
        height: (premium ? 24 : 20) * s,
        background: `linear-gradient(180deg, ${highlight} 0%, ${base} 100%)`,
        borderRadius: `${4 * s}px`,
        border: `1px solid ${shadow}`,
        zIndex: 3,
      }}>
        {/* Gold armrest cap for premium */}
        {premium && (
          <div style={{
            position: "absolute", top: -1, left: 0, right: 0, height: 3 * s,
            background: `linear-gradient(180deg, ${metalHighlight} 0%, ${metalColor} 100%)`,
            borderRadius: `${4 * s}px ${4 * s}px 0 0`,
          }} />
        )}
      </div>
      <div style={{
        position: "absolute",
        top: (premium ? (empty ? 48 : 40) : (empty ? 42 : 34)) * s,
        right: -6 * s,
        width: (premium ? 12 : 10) * s,
        height: (premium ? 24 : 20) * s,
        background: `linear-gradient(180deg, ${highlight} 0%, ${base} 100%)`,
        borderRadius: `${4 * s}px`,
        border: `1px solid ${shadow}`,
        zIndex: 3,
      }}>
        {premium && (
          <div style={{
            position: "absolute", top: -1, left: 0, right: 0, height: 3 * s,
            background: `linear-gradient(180deg, ${metalHighlight} 0%, ${metalColor} 100%)`,
            borderRadius: `${4 * s}px ${4 * s}px 0 0`,
          }} />
        )}
      </div>
      {/* Seat */}
      <div style={{
        width: 48 * s,
        height: 12 * s,
        background: `linear-gradient(180deg, ${highlight} 0%, ${base} 100%)`,
        borderRadius: `${4 * s}px ${4 * s}px ${6 * s}px ${6 * s}px`,
        border: `1.5px solid ${shadow}`,
        boxShadow: `inset 0 2px 6px rgba(138,103,79,0.3)`,
        marginTop: 1 * s,
        zIndex: 2,
      }} />
      {/* Post — gold for premium */}
      <div style={{
        width: 6 * s,
        height: 14 * s,
        background: `linear-gradient(180deg, ${metalColor} 0%, ${premium ? "#665520" : "#333"} 100%)`,
        marginTop: -1,
        zIndex: 1,
      }} />
      {/* Base star */}
      <div style={{
        width: 42 * s,
        height: 5 * s,
        background: `linear-gradient(180deg, ${metalColor} 0%, ${metalHighlight} 100%)`,
        borderRadius: `${3 * s}px`,
        border: `1px solid ${premium ? "#554410" : "#333"}`,
        zIndex: 1,
      }} />
      {/* Wheels */}
      <div style={{ display: "flex", gap: 24 * s, marginTop: 1 }}>
        <div style={{ width: 7 * s, height: 7 * s, borderRadius: "50%", background: wheelColor, border: `1px solid ${wheelBorder}` }} />
        <div style={{ width: 7 * s, height: 7 * s, borderRadius: "50%", background: wheelColor, border: `1px solid ${wheelBorder}` }} />
      </div>
    </div>
  );
}

// ─── Person Figure Component ─────────────────────────────────────────────────

function PersonFigure({
  emoji,
  role,
  status,
  size = "normal",
  bouncing = false,
  sitting = false,
  agentId,
  agentName,
  pose,
  characterConfig,
}: {
  emoji: string;
  role: string;
  status?: string;
  size?: "normal" | "small";
  bouncing?: boolean;
  sitting?: boolean;
  agentId?: string;
  agentName?: string;
  pose?: "mouse" | "keyboard" | "thinking" | "relaxed" | "standing";
  characterConfig?: { skinColor?: string; hairStyle?: string; hairColor?: string; premium?: boolean; mugText?: string };
}) {
  const colors = getAgentColor(role, status);
  const isSmall = size === "small";
  const isShmackAgent = isShmack({ id: agentId, name: agentName });
  // Use characterConfig if available, fall back to Shmack detection
  const skinColor = characterConfig?.skinColor || (isShmackAgent ? FACTORY_VARS.skinShmack : FACTORY_VARS.skinDefault);
  const skinBorder = skinColor === FACTORY_VARS.skinShmack ? "#e8c0a0" : "#c4956a";
  const shirtColor = isShmackAgent ? "#7c5cfc" : colors.shirt;
  const shirtBorder = isShmackAgent ? "#9b7cff" : colors.border;

  const headSize = isSmall ? 20 : (isShmackAgent ? 33 : 30);
  const bodyW = isSmall ? 22 : (isShmackAgent ? 36 : 32);
  const bodyH = isSmall ? 16 : (isShmackAgent ? 26 : 24);
  const emojiSize = isSmall ? 9 : (isShmackAgent ? 15 : 13);
  const eyeSize = isSmall ? 2 : 3;
  const armW = isSmall ? 6 : 8;
  const armH = isSmall ? 14 : 20;
  const handSize = isSmall ? 7 : 10;

  const activePose = pose || "standing";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
        animation: bouncing ? "agentBounce 1s ease-in-out infinite" : "none",
      }}
    >
      {/* Hair — driven by characterConfig */}
      {(() => {
        const hs = characterConfig?.hairStyle || (isShmackAgent ? "redspiky" : "short");
        const hc = characterConfig?.hairColor || (isShmackAgent ? "#c0442a" : "#3a2a1a");
        if (hs === "none") return null;
        if (hs === "redspiky") return (
          <div style={{ display: "flex", gap: isSmall ? 1 : 0, marginBottom: isSmall ? -8 : -10, zIndex: 5, position: "relative" }}>
            <div style={{ width: isSmall ? 5 : 6, height: isSmall ? 7 : 14, background: hc, borderRadius: "50% 50% 20% 20%", transform: "rotate(-30deg)", marginRight: -1, opacity: 0.8 }} />
            <div style={{ width: isSmall ? 4 : 7, height: isSmall ? 9 : 18, background: hc, borderRadius: "50% 50% 20% 20%", transform: "rotate(-12deg)" }} />
            <div style={{ width: isSmall ? 5 : 8, height: isSmall ? 10 : 20, background: hc, borderRadius: "50% 50% 15% 15%", transform: "rotate(-3deg)", filter: "brightness(1.15)" }} />
            <div style={{ width: isSmall ? 5 : 9, height: isSmall ? 11 : 22, background: hc, borderRadius: "50% 50% 15% 15%", filter: "brightness(1.25)" }} />
            <div style={{ width: isSmall ? 5 : 8, height: isSmall ? 10 : 20, background: hc, borderRadius: "50% 50% 15% 15%", transform: "rotate(3deg)", filter: "brightness(1.15)" }} />
            <div style={{ width: isSmall ? 4 : 7, height: isSmall ? 9 : 18, background: hc, borderRadius: "50% 50% 20% 20%", transform: "rotate(12deg)" }} />
            <div style={{ width: isSmall ? 5 : 6, height: isSmall ? 7 : 14, background: hc, borderRadius: "50% 50% 20% 20%", transform: "rotate(30deg)", marginLeft: -1, opacity: 0.8 }} />
          </div>
        );
        if (hs === "long") return (
          <div style={{ position: "relative", marginBottom: isSmall ? -8 : -10, zIndex: 5 }}>
            <div style={{ width: headSize * 1.1, height: isSmall ? 10 : 16, background: hc, borderRadius: `${isSmall ? 6 : 10}px ${isSmall ? 6 : 10}px 0 0` }} />
            <div style={{ position: "absolute", left: -2, top: isSmall ? 6 : 10, width: isSmall ? 5 : 7, height: isSmall ? 14 : 22, background: hc, borderRadius: "2px 0 4px 4px" }} />
            <div style={{ position: "absolute", right: -2, top: isSmall ? 6 : 10, width: isSmall ? 5 : 7, height: isSmall ? 14 : 22, background: hc, borderRadius: "0 2px 4px 4px" }} />
          </div>
        );
        if (hs === "bun") return (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: isSmall ? -8 : -10, zIndex: 5 }}>
            <div style={{ width: isSmall ? 10 : 14, height: isSmall ? 10 : 14, borderRadius: "50%", background: hc, marginBottom: -4 }} />
            <div style={{ width: headSize * 0.9, height: isSmall ? 6 : 10, background: hc, borderRadius: `${isSmall ? 5 : 8}px ${isSmall ? 5 : 8}px 1px 1px` }} />
          </div>
        );
        // Default: short
        return (
          <div style={{
            width: headSize * 0.9,
            height: isSmall ? 6 : 10,
            background: hc,
            borderRadius: `${isSmall ? 5 : 8}px ${isSmall ? 5 : 8}px 1px 1px`,
            marginBottom: isSmall ? -5 : -8,
            zIndex: 5,
            position: "relative",
          }} />
        );
      })()}

      {/* Head */}
      <div style={{
        width: headSize,
        height: headSize,
        borderRadius: "50%",
        background: skinColor,
        border: `2px solid ${skinBorder}`,
        zIndex: 4,
        position: "relative",
        boxShadow: "inset 0 -3px 6px rgba(0,0,0,0.1)",
      }}>
        {/* Eyes */}
        {!isSmall && (
          <>
            <div style={{
              position: "absolute", left: "20%", top: "36%",
              width: eyeSize * 2.2, height: eyeSize * 2.4,
              borderRadius: "50%", background: "white",
            }}>
              <div style={{
                position: "absolute", right: 0, top: "20%",
                width: eyeSize * 1.4, height: eyeSize * 1.4,
                borderRadius: "50%", background: "#2a2a3a",
              }}>
                <div style={{
                  position: "absolute", right: 1, top: 1,
                  width: eyeSize * 0.5, height: eyeSize * 0.5,
                  borderRadius: "50%", background: "white",
                }} />
              </div>
            </div>
            <div style={{
              position: "absolute", right: "20%", top: "36%",
              width: eyeSize * 2.2, height: eyeSize * 2.4,
              borderRadius: "50%", background: "white",
            }}>
              <div style={{
                position: "absolute", right: 0, top: "20%",
                width: eyeSize * 1.4, height: eyeSize * 1.4,
                borderRadius: "50%", background: "#2a2a3a",
              }}>
                <div style={{
                  position: "absolute", right: 1, top: 1,
                  width: eyeSize * 0.5, height: eyeSize * 0.5,
                  borderRadius: "50%", background: "white",
                }} />
              </div>
            </div>
            {/* Mouth */}
            <div style={{
              position: "absolute", bottom: "18%", left: "50%", transform: "translateX(-50%)",
              width: headSize * 0.3, height: headSize * 0.12,
              borderBottom: `2px solid ${skinBorder}`,
              borderRadius: "0 0 50% 50%",
            }} />
          </>
        )}
      </div>

      {/* Body + Arms + Hands — integrated unit */}
      <div style={{
        position: "relative",
        marginTop: -3,
        zIndex: 3,
        width: bodyW + armW * 2 + 8,
        display: "flex",
        justifyContent: "center",
      }}>
        {/* Left arm — connects from shoulder to hand */}
        <div style={{
          position: "absolute",
          left: activePose === "thinking" ? 2 : 0,
          top: activePose === "thinking" ? -4 : 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          zIndex: activePose === "thinking" ? 5 : 2,
          transform: activePose === "thinking" ? "rotate(30deg)" : "none",
        }}>
          <div style={{
            width: armW,
            height: activePose === "thinking" ? armH - 4 : armH,
            borderRadius: armW / 2,
            background: `linear-gradient(180deg, ${shirtColor} 0%, ${shirtColor}cc 100%)`,
            border: `1px solid ${shirtBorder}`,
          }} />
          <div style={{
            width: handSize,
            height: handSize * 0.8,
            borderRadius: "50%",
            background: skinColor,
            border: `1px solid ${skinBorder}`,
            marginTop: -2,
          }} />
        </div>

        {/* Torso */}
        <div style={{
          width: bodyW,
          height: bodyH,
          borderRadius: `${isSmall ? 5 : 8}px ${isSmall ? 5 : 8}px 3px 3px`,
          background: `linear-gradient(180deg, ${shirtColor} 0%, ${shirtColor}dd 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: emojiSize,
          lineHeight: 1,
          border: `1.5px solid ${shirtBorder}`,
          boxShadow: bouncing ? `0 0 14px ${colors.glow}` : (isShmackAgent && !isSmall ? `0 0 10px rgba(124,92,252,0.25)` : "none"),
          zIndex: 3,
        }}>
          {emoji}
        </div>

        {/* Right arm */}
        <div style={{
          position: "absolute",
          right: activePose === "relaxed" ? 4 : 0,
          top: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          zIndex: 2,
        }}>
          <div style={{
            width: armW,
            height: armH,
            borderRadius: armW / 2,
            background: `linear-gradient(180deg, ${shirtColor} 0%, ${shirtColor}cc 100%)`,
            border: `1px solid ${shirtBorder}`,
          }} />
          <div style={{
            width: handSize,
            height: handSize * 0.8,
            borderRadius: "50%",
            background: skinColor,
            border: `1px solid ${skinBorder}`,
            marginTop: -2,
          }} />
        </div>
      </div>

      {/* Legs */}
      {!sitting ? (
        <div style={{ display: "flex", gap: isSmall ? 3 : 5, marginTop: -1, zIndex: 2 }}>
          <div style={{
            width: isSmall ? 6 : 8,
            height: isSmall ? 10 : 14,
            background: "#3a3a50",
            borderRadius: "2px 2px 4px 4px",
            border: "1px solid #4a4a60",
          }} />
          <div style={{
            width: isSmall ? 6 : 8,
            height: isSmall ? 10 : 14,
            background: "#3a3a50",
            borderRadius: "2px 2px 4px 4px",
            border: "1px solid #4a4a60",
          }} />
        </div>
      ) : (
        <div style={{ display: "flex", gap: isSmall ? 5 : 7, marginTop: -1, zIndex: 2 }}>
          <div style={{
            width: isSmall ? 8 : 12,
            height: isSmall ? 6 : 8,
            background: "#3a3a50",
            borderRadius: "3px",
            border: "1px solid #4a4a60",
          }} />
          <div style={{
            width: isSmall ? 8 : 12,
            height: isSmall ? 6 : 8,
            background: "#3a3a50",
            borderRadius: "3px",
            border: "1px solid #4a4a60",
          }} />
        </div>
      )}
    </div>
  );
}

// ─── Premium Desk Card Component ─────────────────────────────────────────────

function AgentDesk({
  agent,
  isWorking,
  onClick,
  onMount,
}: {
  agent: { id: string; name: string; emoji: string; role: string; model?: string; status: string; taskSummary?: string; characterConfig?: { skinColor?: string; hairStyle?: string; hairColor?: string; premium?: boolean; mugText?: string } };
  isWorking: boolean;
  onClick?: () => void;
  onMount?: (el: HTMLDivElement | null) => void;
}) {
  const primary = isPrimaryAgent(agent.role, agent.status);
  const isSub = agent.role === "Sub-Agent";
  const isPremium = agent.characterConfig?.premium || isShmack(agent);
  const colors = getAgentColor(agent.role, agent.status);
  const modelStr = agent.model || "";
  const modelColor = modelStr.includes("opus") ? "#f0b429" : modelStr.includes("haiku") ? "#26c97a" : "#7c5cfc";
  const statusColor = isWorking ? "#26c97a" : agent.status === "idle" ? "#9898a0" : agent.status === "scheduled" ? "#f0b429" : "#888";
  const statusText = isWorking
    ? "→ In Progress"
    : agent.status === "idle"
    ? (agent.taskSummary || "○ IDLE")
    : agent.status === "scheduled"
    ? "⏰ SCHEDULED"
    : "💤 STANDBY";

  const accentColor = isSub ? FACTORY_VARS.accentSubAgent : primary ? FACTORY_VARS.accentPrimary : FACTORY_VARS.accentDedicated;
  const isShmackAgent = isShmack(agent);

  // Determine pose based on agent
  const agentPose: "mouse" | "keyboard" | "thinking" | "relaxed" | "standing" = (() => {
    const n = agent.name.toLowerCase();
    if (n.includes("scout")) return "mouse";
    if (n.includes("analyst")) return "keyboard";
    if (n.includes("strategist")) return "thinking";
    if (n.includes("night")) return "relaxed";
    return "standing";
  })();

  const showMug = isPremium;

  // Shmack gets a bigger card — he's the boss
  const cardWidth = isPremium ? 250 : 200;
  const cardMinHeight = isPremium ? 220 : 190;
  const deskWidth = isPremium ? 250 : 220;

  return (
    <div
      ref={(el) => onMount?.(el)}
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: cardWidth,
        minHeight: cardMinHeight,
        background: isShmackAgent
          ? `linear-gradient(145deg, #0c0820 0%, ${FACTORY_VARS.cardInterior2} 40%, #0e0625 100%)`
          : `linear-gradient(145deg, ${FACTORY_VARS.cardInterior} 0%, ${FACTORY_VARS.cardInterior2} 100%)`,
        border: `1.5px solid ${accentColor}${isShmackAgent ? "70" : "50"}`,
        borderRadius: 20,
        cursor: onClick && !isWorking ? "pointer" : "default",
        position: "relative",
        overflow: "visible",
        boxShadow: isShmackAgent
          ? `0 0 30px ${accentColor}30, 0 0 80px ${accentColor}10, inset 0 1px 0 ${accentColor}20, 0 4px 24px rgba(0,0,0,0.4)`
          : `0 0 20px ${accentColor}20, 0 0 60px ${accentColor}08, inset 0 1px 0 ${accentColor}15`,
        transition: "box-shadow 0.3s ease, transform 0.2s ease",
        padding: isShmackAgent ? "6px 10px 6px" : "4px 8px 4px",
      }}
    >
      {/* Subtle top glow line — thicker for Shmack */}
      <div style={{
        position: "absolute",
        top: 0,
        left: isShmackAgent ? "5%" : "10%",
        right: isShmackAgent ? "5%" : "10%",
        height: isPremium ? 3 : 2,
        background: `linear-gradient(90deg, transparent, ${accentColor}${isShmackAgent ? "80" : "60"}, transparent)`,
        borderRadius: "0 0 4px 4px",
      }} />
      {/* Corner accent dots for Shmack */}
      {isShmackAgent && (
        <>
          <div style={{ position: "absolute", top: 8, left: 8, width: 4, height: 4, borderRadius: "50%", background: `${accentColor}40` }} />
          <div style={{ position: "absolute", top: 8, right: 8, width: 4, height: 4, borderRadius: "50%", background: `${accentColor}40` }} />
        </>
      )}

      {/* ─── SCENE: Chair + Agent + Desk ─── */}
      <div style={{
        position: "relative",
        width: "100%",
        height: isPremium ? 170 : 150,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
      }}>
        {/* Layer 1: Chair (z:1) */}
        <div style={{
          position: "absolute",
          bottom: isShmackAgent ? 74 : 68,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1,
        }}>
          <OfficeChair empty={isWorking} scale={isWorking ? 1 : (isPremium ? 0.95 : 0.85)} premium={isPremium} />
        </div>

        {/* Layer 2: Seated Agent (z:2) */}
        {!isWorking && (
          <div style={{
            position: "absolute",
            bottom: isShmackAgent ? 100 : 88,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2,
          }}>
            <PersonFigure
              emoji={agent.emoji}
              role={agent.role}
              status={agent.status}
              sitting={true}
              agentId={agent.id}
              agentName={agent.name}
              pose={agentPose}
              characterConfig={agent.characterConfig}
            />
          </div>
        )}

        {/* Layer 3: Desk (z:3) */}
        <div style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 3,
          width: deskWidth,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}>
          {/* Desk top surface */}
          <div style={{
            width: deskWidth,
            height: isPremium ? 10 : 8,
            background: isShmackAgent
              ? `linear-gradient(180deg, #2a3550 0%, ${FACTORY_VARS.desk} 100%)`
              : `linear-gradient(180deg, ${FACTORY_VARS.desk2} 0%, ${FACTORY_VARS.desk} 100%)`,
            borderRadius: "4px 4px 0 0",
            border: `1px solid ${isShmackAgent ? "#3a4560" : "#2a3548"}`,
            borderBottom: "none",
            position: "relative",
          }}>
            {/* Items on desk */}
            <div style={{
              position: "absolute",
              top: -36,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "flex-end",
              gap: 14,
              zIndex: 4,
            }}>
              {/* Monitor — bigger for Shmack */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
                  width: isPremium ? 52 : 44,
                  height: isPremium ? 36 : 30,
                  background: "#0a0f1a",
                  border: `2px solid ${accentColor}30`,
                  borderRadius: "4px 4px 0 0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: `0 0 12px ${accentColor}15, inset 0 0 20px ${accentColor}08`,
                  position: "relative",
                  overflow: "hidden",
                }}>
                  {!isWorking && (
                    <>
                      <div style={{ width: isPremium ? 26 : 20, height: 2, background: accentColor, borderRadius: 1, opacity: 0.4 }} />
                      <div style={{ position: "absolute", bottom: 4, left: 6, width: isPremium ? 18 : 14, height: 1.5, background: accentColor, borderRadius: 1, opacity: 0.2 }} />
                      <div style={{ position: "absolute", bottom: 8, left: 6, width: isPremium ? 30 : 24, height: 1.5, background: accentColor, borderRadius: 1, opacity: 0.15 }} />
                    </>
                  )}
                  {isWorking && (
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#333", border: "1px solid #444" }} />
                  )}
                </div>
                {/* Monitor stand */}
                <div style={{ width: 6, height: 6, background: "#333" }} />
                <div style={{ width: isPremium ? 22 : 18, height: 3, background: "#333", borderRadius: 2 }} />
              </div>

              {/* Keyboard (only if not working) */}
              {!isWorking && (
                <div style={{
                  position: "absolute",
                  bottom: 0,
                  left: "50%",
                  transform: "translateX(-50%) translateY(2px)",
                  width: 36,
                  height: 10,
                  background: "#2a2a3a",
                  border: "1px solid #3a3a4a",
                  borderRadius: 2,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 1,
                  padding: 2,
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {[...Array(12)].map((_, i) => (
                    <div key={i} style={{ width: 3, height: 2, background: "#4a4a5a", borderRadius: 0.5 }} />
                  ))}
                </div>
              )}

              {/* Mug (for Shmack) — with BOSS text */}
              {showMug && (
                <div style={{
                  position: "absolute",
                  right: isShmackAgent ? -36 : -30,
                  bottom: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}>
                  <div style={{
                    width: 16,
                    height: 18,
                    background: "linear-gradient(180deg, #e8e8e8 0%, #d0d0d0 100%)",
                    borderRadius: "2px 2px 4px 4px",
                    border: "1px solid #bbb",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    {/* BOSS text */}
                    <span style={{
                      fontSize: 5,
                      fontWeight: 900,
                      color: "#7c5cfc",
                      letterSpacing: "0.03em",
                      fontFamily: "Arial, sans-serif",
                      lineHeight: 1,
                    }}>{agent.characterConfig?.mugText || "BOSS"}</span>
                    {/* Handle */}
                    <div style={{
                      position: "absolute",
                      right: -7,
                      top: 3,
                      width: 7,
                      height: 10,
                      borderRadius: "0 5px 5px 0",
                      border: "2px solid #bbb",
                      borderLeft: "none",
                    }} />
                    {/* Steam wisps */}
                    <div style={{
                      position: "absolute",
                      top: -8,
                      left: "30%",
                      fontSize: 7,
                      opacity: 0.35,
                      animation: "agentBounce 2.5s ease-in-out infinite",
                      color: "#aaa",
                    }}>~</div>
                    <div style={{
                      position: "absolute",
                      top: -10,
                      left: "60%",
                      fontSize: 6,
                      opacity: 0.25,
                      animation: "agentBounce 3s ease-in-out infinite 0.5s",
                      color: "#aaa",
                    }}>~</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Desk front panel */}
          <div style={{
            width: deskWidth,
            height: isShmackAgent ? 56 : 50,
            background: isShmackAgent
              ? `linear-gradient(180deg, ${FACTORY_VARS.desk} 0%, #101520 100%)`
              : `linear-gradient(180deg, ${FACTORY_VARS.desk} 0%, ${FACTORY_VARS.deskFront} 100%)`,
            border: `1px solid ${isShmackAgent ? "#3a4560" : "#2a3548"}`,
            borderTop: "none",
            borderRadius: "0 0 6px 6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}>
            {/* Nameplate plaque — premium for Shmack */}
            <div style={{
              background: isShmackAgent
                ? "linear-gradient(180deg, #2a2040 0%, #1a1530 100%)"
                : "linear-gradient(180deg, #2a2e3a 0%, #1e222e 100%)",
              border: `1px solid ${accentColor}${isShmackAgent ? "50" : "35"}`,
              borderRadius: 4,
              padding: isShmackAgent ? "5px 18px" : "4px 14px",
              boxShadow: isShmackAgent
                ? `0 2px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(124,77,255,0.1), 0 0 12px ${accentColor}15`
                : `0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)`,
            }}>
              <div style={{
                fontSize: isShmackAgent ? 13 : 11,
                fontWeight: isShmackAgent ? 800 : 700,
                color: "#ffffff",
                textAlign: "center",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                fontFamily: "'Courier New', monospace",
                display: "flex",
                alignItems: "center",
                gap: 4,
                letterSpacing: isShmackAgent ? "0.08em" : "0.05em",
                textShadow: `0 0 8px ${accentColor}${isShmackAgent ? "60" : "40"}`,
              }}>
                {isShmackAgent && <span style={{ fontSize: 12 }} title="Main Agent">👑</span>}
                {agent.name}
              </div>
            </div>
          </div>
        </div>

        {/* Layer 4: Hands/props on desk (z:4) — only when agent is seated */}
        {!isWorking && (
          <div style={{
            position: "absolute",
            bottom: 56,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 4,
            width: 80,
            display: "flex",
            justifyContent: agentPose === "mouse" ? "flex-end" : agentPose === "thinking" ? "flex-start" : "center",
          }}>
            {/* Hands on desk — positioned based on pose */}
            {agentPose === "mouse" && (
              <div style={{
                width: 10,
                height: 8,
                borderRadius: "50%",
                background: isShmackAgent ? FACTORY_VARS.skinShmack : FACTORY_VARS.skinDefault,
                border: `1px solid ${isShmackAgent ? "#e8c0a0" : "#c4956a"}`,
                marginRight: 6,
              }} />
            )}
          </div>
        )}
      </div>

      {/* ─── META: Model + Status (z:5) ─── */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        marginTop: 10,
        zIndex: 5,
      }}>
        {/* Model badge */}
        {modelStr && (
          <span style={{
            fontSize: 10,
            color: modelColor,
            background: modelColor + "15",
            border: `1px solid ${modelColor}35`,
            padding: "3px 10px",
            borderRadius: 8,
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}>
            {modelStr}
          </span>
        )}

        {/* Status */}
        <div style={{
          fontSize: 11,
          color: statusColor,
          fontWeight: 600,
          textAlign: "center",
          lineHeight: 1.3,
          maxWidth: 200,
        }}>
          {statusText}
        </div>
      </div>
    </div>
  );
}

// ─── Workstation Figure (In Progress zone) ──────────────────────────────────

function WorkstationFigure({
  agent,
  onClick,
}: {
  agent: LiveAgent;
  onClick: () => void;
}) {
  const figureRef = useRef<HTMLDivElement>(null);
  const isActive = agent.status === "active";
  const isSub = agent.role === "Sub-Agent";
  const colors = getAgentColor(agent.role);
  const accentColor = isSub ? FACTORY_VARS.accentSubAgent : agent.role === "Dedicated Agent" ? FACTORY_VARS.accentDedicated : FACTORY_VARS.accentPrimary;
  const modelColor = agent.model?.includes("opus")
    ? "#f0b429"
    : agent.model?.includes("haiku")
    ? "#26c97a"
    : "#7c5cfc";

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

  return (
    <div
      ref={figureRef}
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: "14px 16px 12px",
        minWidth: 130,
        maxWidth: 180,
        background: `linear-gradient(145deg, ${FACTORY_VARS.cardInterior} 0%, ${FACTORY_VARS.cardInterior2} 100%)`,
        border: `1.5px solid ${accentColor}${isActive ? "60" : "40"}`,
        borderRadius: 16,
        cursor: "pointer",
        position: "relative",
        animation: isActive ? "liveAgentGlow 2s ease-in-out infinite" : "none",
        opacity: 1,
        transition: "opacity 0.5s ease",
        boxShadow: isActive ? `0 0 20px ${accentColor}20` : "none",
        overflow: "visible",
      }}
    >
      {/* Top glow line */}
      <div style={{
        position: "absolute",
        top: 0,
        left: "15%",
        right: "15%",
        height: 2,
        background: `linear-gradient(90deg, transparent, ${accentColor}50, transparent)`,
      }} />

      {/* LIVE badge */}
      {isActive && (
        <div style={{
          position: "absolute",
          top: -6,
          right: -6,
          background: "#f05b5b",
          color: "#ffffff",
          fontSize: 8,
          fontWeight: 800,
          padding: "2px 6px",
          borderRadius: 4,
          letterSpacing: "0.1em",
          animation: "scannerPulse 1.5s ease-in-out infinite",
          boxShadow: "0 0 8px #f05b5b60",
        }}>
          LIVE
        </div>
      )}

      {/* Completed/Failed check */}
      {(agent.status === "completed" || agent.status === "failed") && (
        <div style={{
          position: "absolute",
          top: -6,
          right: -6,
          background: agent.status === "completed" ? "#26c97a" : "#f05b5b",
          color: "#ffffff",
          fontSize: 10,
          fontWeight: 800,
          padding: "1px 5px",
          borderRadius: 4,
        }}>
          {agent.status === "completed" ? "✓" : "✕"}
        </div>
      )}

      {/* Person figure with workbench scene */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, position: "relative" }}>
        <PersonFigure
          emoji={agent.emoji}
          role={agent.role}
          bouncing={isActive}
          sitting={agent.status === "completed" || agent.status === "failed"}
          agentId={agent.id}
          agentName={agent.name}
          characterConfig={agent.characterConfig}
        />
        {/* Mini workbench */}
        {isActive && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: 0.7 }}>
            <div style={{
              width: 20, height: 24,
              background: FACTORY_VARS.desk,
              border: `1px solid ${accentColor}30`,
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 8px ${accentColor}10`,
            }}>
              <div style={{
                width: 10, height: 10,
                background: accentColor,
                borderRadius: 2,
                opacity: 0.4,
                animation: "scannerPulse 2s ease-in-out infinite",
              }} />
            </div>
            <div style={{ width: 24, height: 3, background: FACTORY_VARS.desk2, borderRadius: 1 }} />
          </div>
        )}
      </div>

      {/* Name */}
      <div style={{
        fontSize: 12,
        fontWeight: 700,
        color: "#ffffff",
        textAlign: "center",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: 150,
        fontFamily: "'Courier New', monospace",
        letterSpacing: "0.03em",
      }} title={agent.name}>
        {agent.name}
      </div>

      {/* Role badges */}
      {agent.role === "Sub-Agent" && (
        <span style={{
          fontSize: 8,
          fontWeight: 700,
          color: FACTORY_VARS.accentSubAgent,
          background: FACTORY_VARS.accentSubAgent + "15",
          border: `1px solid ${FACTORY_VARS.accentSubAgent}35`,
          padding: "2px 8px",
          borderRadius: 6,
          letterSpacing: "0.08em",
        }} title="Spawned for a specific task">
          SUB-AGENT
        </span>
      )}
      {agent.role === "Dedicated Agent" && (
        <span style={{
          fontSize: 8,
          fontWeight: 700,
          color: FACTORY_VARS.accentDedicated,
          background: FACTORY_VARS.accentDedicated + "15",
          border: `1px solid ${FACTORY_VARS.accentDedicated}35`,
          padding: "2px 8px",
          borderRadius: 6,
          letterSpacing: "0.08em",
        }} title="Always-on agent">
          DEDICATED
        </span>
      )}

      {/* Task summary */}
      {agent.taskSummary && (
        <div style={{
          fontSize: 9,
          color: "#ffffff",
          opacity: 0.7,
          textAlign: "center",
          lineHeight: 1.3,
          maxWidth: 150,
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          background: `${FACTORY_VARS.desk}80`,
          border: "1px solid #ffffff10",
          borderRadius: 4,
          padding: "4px 8px",
        }} title={agent.taskSummary}>
          📋 {agent.taskSummary.length > 55 ? agent.taskSummary.slice(0, 52) + "..." : agent.taskSummary}
        </div>
      )}

      {/* Model + elapsed */}
      <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
        {agent.model && (
          <span style={{
            fontSize: 9,
            color: modelColor,
            padding: "2px 8px",
            background: modelColor + "15",
            border: `1px solid ${modelColor}35`,
            borderRadius: 8,
            fontWeight: 700,
          }}>
            {agent.model}
          </span>
        )}
        <span style={{
          fontSize: 9,
          color: isActive ? "#4d7cfe" : "#26c97a",
          fontWeight: 600,
        }}>
          {elapsed}
        </span>
      </div>
    </div>
  );
}

// ─── Walking Overlay ─────────────────────────────────────────────────────────

function WalkingOverlay({ walker }: { walker: WalkingAgent }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf: number;
    const animate = () => {
      const now = Date.now();
      const p = Math.min(1, (now - walker.startTime) / WALK_DURATION);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [walker.startTime]);

  // Easing: ease-in-out
  const ease = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  const p = ease(progress);

  const x = walker.startX + (walker.endX - walker.startX) * p;
  const y = walker.startY + (walker.endY - walker.startY) * p;

  // Stand-up effect: rise slightly at the start
  const riseOffset = progress < 0.2 ? -(progress / 0.2) * 10 : progress < 0.3 ? -10 : -10 + (Math.min(progress, 0.8) - 0.3) / 0.5 * 10;

  return (
    <div style={{
      position: "fixed",
      left: x,
      top: y + riseOffset,
      zIndex: 1000,
      pointerEvents: "none",
      transition: "none",
      filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))",
    }}>
      <div style={{
        animation: progress > 0.15 && progress < 0.85 ? "walkingBounce 0.3s ease-in-out infinite" : "none",
      }}>
        <PersonFigure
          emoji={walker.emoji}
          role={walker.role}
          bouncing={false}
          sitting={false}
          agentId={walker.id}
          agentName={walker.name}
          characterConfig={walker.characterConfig}
        />
      </div>
    </div>
  );
}

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
          ...(isMobile || isLong ? { whiteSpace: "normal" as const } : { overflow: "hidden" as const, textOverflow: "ellipsis" as const, whiteSpace: "nowrap" as const }),
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

// ─── Mobile Zone Section ──────────────────────────────────────────────────────

function MobileZoneSection({
  zoneKey,
  tasks,
  liveAgents = [],
  onSelectTask,
  onSelectAgent,
}: {
  zoneKey: keyof typeof ZONE_CONFIG;
  tasks: Task[];
  liveAgents?: LiveAgent[];
  onSelectTask: (task: Task) => void;
  onSelectAgent?: (agent: LiveAgent) => void;
}) {
  const cfg = ZONE_CONFIG[zoneKey];
  const [collapsed, setCollapsed] = useState(zoneKey === "done");

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
          {cfg.label}<span style={{ marginLeft: "6px", fontSize: "10px", color: "var(--text-muted)", cursor: "help" }} title={cfg.tooltip}>ⓘ</span>
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
          {/* Live agents in this zone */}
          {zoneLiveAgents.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "8px", padding: "12px 8px 8px", borderBottom: `1px solid var(--border-subtle)` }}>
              {zoneLiveAgents.map((agent) => (
                <WorkstationFigure key={agent.id} agent={agent} onClick={() => onSelectAgent?.(agent)} />
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
  liveAgents = [],
  onSelectTask,
  onSelectAgent,
}: {
  zoneKey: keyof typeof ZONE_CONFIG;
  tasks: Task[];
  liveAgents?: LiveAgent[];
  onSelectTask: (task: Task) => void;
  onSelectAgent?: (agent: LiveAgent) => void;
}) {
  const cfg = ZONE_CONFIG[zoneKey];

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
          {cfg.label}<span style={{ marginLeft: "6px", fontSize: "10px", color: "var(--text-muted)", cursor: "help" }} title={cfg.tooltip}>ⓘ</span>
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

      {/* Live agents in this zone */}
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
            <WorkstationFigure key={agent.id} agent={agent} onClick={() => onSelectAgent?.(agent)} />
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
  const [selectedAgent, setSelectedAgent] = useState<LiveAgent | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Walking animation state
  const [walkingAgents, setWalkingAgents] = useState<WalkingAgent[]>([]);
  const [transitioning, setTransitioning] = useState<Set<string>>(new Set());
  const prevStatusRef = useRef<Map<string, string>>(new Map());
  const deskRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

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

  // ── Walking animation trigger ──
  useEffect(() => {
    if (!data || isMobile) return;

    const liveAgents = data.liveAgents || [];
    const newStatuses = new Map<string, string>();

    // Build current status map for desk agents (primary + dedicated from liveAgents)
    for (const la of liveAgents) {
      if (la.role !== "Sub-Agent") {
        newStatuses.set(la.id, la.status);
      }
    }

    const prev = prevStatusRef.current;

    for (const [id, status] of newStatuses) {
      const oldStatus = prev.get(id);
      if (!oldStatus) continue; // First appearance, skip animation

      const agent = liveAgents.find(a => a.id === id);
      if (!agent) continue;

      // Agent went from not-active to active: walk desk → workstation
      if (oldStatus !== "active" && status === "active") {
        const deskEl = deskRefs.current.get(id);
        // Use a placeholder position for the workstation (center of viewport, slightly down)
        if (deskEl) {
          const deskRect = deskEl.getBoundingClientRect();
          const endX = window.innerWidth / 2;
          const endY = window.innerHeight / 2;

          setTransitioning(prev => new Set(prev).add(id));
          setWalkingAgents(prev => [...prev, {
            id,
            name: agent.name,
            emoji: agent.emoji,
            role: agent.role,
            model: agent.model,
            characterConfig: agent.characterConfig,
            direction: "toWork",
            startX: deskRect.left + deskRect.width / 2 - 14,
            startY: deskRect.top + 10,
            endX: endX - 14,
            endY: endY - 20,
            startTime: Date.now(),
          }]);

          setTimeout(() => {
            setWalkingAgents(prev => prev.filter(w => w.id !== id));
            setTransitioning(prev => { const s = new Set(prev); s.delete(id); return s; });
          }, WALK_DURATION);
        }
      }

      // Agent went from active to not-active: walk workstation → desk
      if (oldStatus === "active" && status !== "active") {
        const deskEl = deskRefs.current.get(id);
        if (deskEl) {
          const deskRect = deskEl.getBoundingClientRect();
          const startX = window.innerWidth / 2;
          const startY = window.innerHeight / 2;

          setTransitioning(prev => new Set(prev).add(id));
          setWalkingAgents(prev => [...prev, {
            id,
            name: agent.name,
            emoji: agent.emoji,
            role: agent.role,
            model: agent.model,
            characterConfig: agent.characterConfig,
            direction: "toDesk",
            startX: startX - 14,
            startY: startY - 20,
            endX: deskRect.left + deskRect.width / 2 - 14,
            endY: deskRect.top + 10,
            startTime: Date.now(),
          }]);

          setTimeout(() => {
            setWalkingAgents(prev => prev.filter(w => w.id !== id));
            setTransitioning(prev => { const s = new Set(prev); s.delete(id); return s; });
          }, WALK_DURATION);
        }
      }
    }

    prevStatusRef.current = newStatuses;
  }, [data, isMobile]);

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

  // ── Categorize agents for desk area ──
  const primaryAgents = liveAgents.filter(a => a.role !== "Sub-Agent" && a.role !== "Dedicated Agent");
  const dedicatedFromFactory = liveAgents.filter(a => a.role === "Dedicated Agent");
  const standbyFromTeam = agents.filter(a => a.status === "standby" || a.status === "scheduled");

  type DeskAgent = {
    id: string;
    name: string;
    emoji: string;
    role: string;
    model?: string;
    status: string;
    taskSummary?: string;
    source: "factory" | "team";
    characterConfig?: { skinColor?: string; hairStyle?: string; hairColor?: string; premium?: boolean; mugText?: string };
  };

  const allDedicated: DeskAgent[] = [
    ...dedicatedFromFactory.map(a => ({ id: a.id, name: a.name, emoji: a.emoji, role: a.role, model: a.model, status: a.status, taskSummary: a.taskSummary, characterConfig: a.characterConfig, source: "factory" as const })),
    ...standbyFromTeam.map(a => ({
      id: a.id, name: a.name, emoji: a.emoji, role: a.role,
      model: a.model, status: a.status, taskSummary: a.statusText || "",
      source: "team" as const,
    })),
  ];

  // Build desk agents list (primary + dedicated that have desks)
  const deskAgents: DeskAgent[] = [
    ...primaryAgents.map(a => ({ id: a.id, name: a.name, emoji: a.emoji, role: a.role, model: a.model, status: a.status, taskSummary: a.taskSummary, characterConfig: a.characterConfig, source: "factory" as const })),
    ...allDedicated,
  ];

  // Note: active/completed filtering happens inside FactoryZone and MobileZoneSection via liveAgents prop

  return (
    <>
      <style>{`
        @keyframes agentBounce {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        @keyframes walkingBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
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
        @keyframes deskIdle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1px); }
        }
      `}</style>

      {/* Walking overlays */}
      {walkingAgents.map(w => (
        <WalkingOverlay key={`walk-${w.id}-${w.startTime}`} walker={w} />
      ))}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100%",
          background: "var(--bg-primary)",
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

          {/* Refresh indicator */}
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

          {/* Live stats pills */}
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
            <StatPill label="Active" value={stats.activeTasks} color="#7c5cfc" isMobile={isMobile} />
            <StatPill label="Done Today" value={stats.completedToday} color="#26c97a" isMobile={isMobile} />
            <StatPill label="Agents" value={`${stats.activeAgents}/${stats.totalAgents}`} color="#4d7cfe" isMobile={isMobile} />
            {(stats.liveAgentCount || 0) > 0 && (
              <StatPill label="Live" value={stats.liveAgentCount || 0} color="#f05b5b" isMobile={isMobile} />
            )}
            <StatPill label="Uptime" value={formatUptime(uptime)} color="#f0b429" isMobile={isMobile} />
          </div>
        </div>

        {/* ── Agent Desk Area ── */}
        {deskAgents.length > 0 && (
          <div
            style={{
              flexShrink: 0,
              padding: isMobile ? "8px 14px" : "10px 24px",
              borderBottom: "1px solid var(--border-subtle)",
              background: "linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-secondary) 100%)",
              overflowX: "auto",
            }}
          >
            <div style={{ display: "flex", gap: "8px", flexWrap: "nowrap", alignItems: "stretch" }}>
              {/* Primary section */}
              {primaryAgents.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "8px", color: "#7c5cfc", letterSpacing: "0.1em", fontWeight: 700 }}>
                    🟣 PRIMARY
                  </span>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {primaryAgents.map(a => {
                      const isWorking = a.status === "active" && !transitioning.has(a.id);
                      return (
                        <AgentDesk
                          key={a.id}
                          agent={{
                            id: a.id,
                            name: a.name,
                            emoji: a.emoji,
                            role: a.role,
                            model: a.model,
                            status: a.status,
                            taskSummary: a.taskSummary,
                            characterConfig: a.characterConfig,
                          }}
                          isWorking={isWorking}
                          onClick={() => setSelectedAgent(a)}
                          onMount={(el) => deskRefs.current.set(a.id, el)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Divider */}
              {primaryAgents.length > 0 && allDedicated.length > 0 && (
                <div style={{ width: "1px", background: "var(--border-default)", alignSelf: "stretch", margin: "0 4px" }} />
              )}

              {/* Dedicated section */}
              {allDedicated.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "8px", color: "#4d7cfe", letterSpacing: "0.1em", fontWeight: 700 }}>
                    🔵 DEDICATED
                  </span>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {allDedicated.map(a => {
                      const isWorking = a.status === "active" && !transitioning.has(a.id);
                      return (
                        <AgentDesk
                          key={a.id}
                          agent={a}
                          isWorking={isWorking}
                          onClick={a.source === "factory" ? () => setSelectedAgent(a as unknown as LiveAgent) : undefined}
                          onMount={(el) => deskRefs.current.set(a.id, el)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Floor line */}
            <div style={{
              height: "2px",
              background: "linear-gradient(90deg, transparent 0%, #ffffff08 20%, #ffffff08 80%, transparent 100%)",
              marginTop: "8px",
            }} />
          </div>
        )}

        {/* ── Factory Floor ──────────────────────────────────────────────── */}
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
                liveAgents={liveAgents}
                onSelectTask={setSelectedTask}
                onSelectAgent={setSelectedAgent}
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
                    liveAgents={liveAgents}
                    onSelectTask={setSelectedTask}
                    onSelectAgent={setSelectedAgent}
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
            /* Mobile bottom bar */
            <>
              {/* Row 1: scanner status */}
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

              {/* Row 2: task counts */}
              <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center" }}>
                {(["backlog", "in-progress", "in-review", "done"] as const).map((zone) => {
                  const cfg = ZONE_CONFIG[zone];
                  const count = tasks.filter((t) => t.status === zone).length;
                  return (
                    <span key={zone} style={{ fontSize: "14px", color: "#ffffff" }}>
                      <span style={{ color: cfg.topBorder, fontWeight: 700 }}>{count}</span>{" "}
                      <span style={{ opacity: 0.7, fontSize: "12px" }}>{cfg.label}<span style={{ marginLeft: "6px", fontSize: "10px", color: "var(--text-muted)", cursor: "help" }} title={cfg.tooltip}>ⓘ</span></span>
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
            /* Desktop bottom bar */
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
                      {cfg.label}<span style={{ marginLeft: "6px", fontSize: "10px", color: "var(--text-muted)", cursor: "help" }} title={cfg.tooltip}>ⓘ</span>
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

      {/* ── Task Detail Modal ── */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {/* ── Agent Detail Modal ── */}
      {selectedAgent && (
        <div
          onClick={() => setSelectedAgent(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "500px",
              width: "100%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <PersonFigure
                  emoji={selectedAgent.emoji}
                  role={selectedAgent.role}
                  bouncing={selectedAgent.status === "active"}
                  agentId={selectedAgent.id}
                  agentName={selectedAgent.name}
                />
                <div>
                  <div style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-primary)" }}>{selectedAgent.name}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>{selectedAgent.role}</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedAgent(null)}
                style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: "20px", cursor: "pointer", padding: "4px 8px" }}
              >✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ padding: "12px", borderRadius: "8px", background: "var(--bg-primary)" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</div>
                <span style={{
                  fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "6px",
                  background: selectedAgent.status === "active" ? "#4d7cfe18" : selectedAgent.status === "completed" ? "#26c97a18" : "#f05b5b18",
                  color: selectedAgent.status === "active" ? "#4d7cfe" : selectedAgent.status === "completed" ? "#26c97a" : "#f05b5b",
                }}>
                  {selectedAgent.status === "active" ? "🟢 LIVE" : selectedAgent.status === "completed" ? "✅ Completed" : selectedAgent.status}
                </span>
              </div>

              <div style={{ padding: "12px", borderRadius: "8px", background: "var(--bg-primary)" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Model</div>
                <div style={{ fontSize: "14px", color: "var(--text-primary)" }}>{selectedAgent.model || "—"}</div>
              </div>

              <div style={{ padding: "12px", borderRadius: "8px", background: "var(--bg-primary)" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Task</div>
                <div style={{ fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.5 }}>{selectedAgent.taskSummary || "No task description"}</div>
              </div>

              {selectedAgent.sessionKey && (
                <div style={{ padding: "12px", borderRadius: "8px", background: "var(--bg-primary)" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Session</div>
                  <div style={{ fontSize: "11px", color: "var(--text-tertiary)", fontFamily: "monospace", wordBreak: "break-all" }}>{selectedAgent.sessionKey}</div>
                </div>
              )}

              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ flex: 1, padding: "12px", borderRadius: "8px", background: "var(--bg-primary)" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Started</div>
                  <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>{new Date(selectedAgent.startedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                </div>
                {selectedAgent.completedAt && (
                  <div style={{ flex: 1, padding: "12px", borderRadius: "8px", background: "var(--bg-primary)" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Completed</div>
                    <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>{new Date(selectedAgent.completedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                  </div>
                )}
              </div>

              {/* ── Appearance Editor ── */}
              <div style={{ padding: "12px", borderRadius: "8px", background: "var(--bg-primary)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>✨ Appearance</div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "12px" }}>
                  <PersonFigure
                    emoji={selectedAgent.emoji}
                    role={selectedAgent.role}
                    agentId={selectedAgent.id}
                    agentName={selectedAgent.name}
                    characterConfig={selectedAgent.characterConfig}
                    size="normal"
                  />
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Preview</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div>
                    <label style={{ fontSize: "10px", color: "var(--text-tertiary)", display: "block", marginBottom: "3px" }}>Skin Color</label>
                    <input
                      type="color"
                      defaultValue={selectedAgent.characterConfig?.skinColor || "#d4a574"}
                      onChange={async (e) => {
                        const res = await fetch("/api/factory/agents", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: selectedAgent.id, character_config: { ...selectedAgent.characterConfig, skinColor: e.target.value } }),
                        });
                        if (res.ok) { const d = await fetch('/api/factory').then(r=>r.json()); setData(d); const updated = (d.liveAgents||[]).find((a:any)=>a.id===selectedAgent.id); if(updated) setSelectedAgent(updated); }
                      }}
                      style={{ width: "100%", height: "28px", border: "1px solid var(--border-subtle)", borderRadius: "4px", background: "var(--bg-secondary)", cursor: "pointer" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "10px", color: "var(--text-tertiary)", display: "block", marginBottom: "3px" }}>Hair Color</label>
                    <input
                      type="color"
                      defaultValue={selectedAgent.characterConfig?.hairColor || "#4a3520"}
                      onChange={async (e) => {
                        const res = await fetch("/api/factory/agents", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: selectedAgent.id, character_config: { ...selectedAgent.characterConfig, hairColor: e.target.value } }),
                        });
                        if (res.ok) { const d = await fetch('/api/factory').then(r=>r.json()); setData(d); const updated = (d.liveAgents||[]).find((a:any)=>a.id===selectedAgent.id); if(updated) setSelectedAgent(updated); }
                      }}
                      style={{ width: "100%", height: "28px", border: "1px solid var(--border-subtle)", borderRadius: "4px", background: "var(--bg-secondary)", cursor: "pointer" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "10px", color: "var(--text-tertiary)", display: "block", marginBottom: "3px" }}>Hair Style</label>
                    <select
                      defaultValue={selectedAgent.characterConfig?.hairStyle || "short"}
                      onChange={async (e) => {
                        const res = await fetch("/api/factory/agents", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: selectedAgent.id, character_config: { ...selectedAgent.characterConfig, hairStyle: e.target.value } }),
                        });
                        if (res.ok) { const d = await fetch('/api/factory').then(r=>r.json()); setData(d); const updated = (d.liveAgents||[]).find((a:any)=>a.id===selectedAgent.id); if(updated) setSelectedAgent(updated); }
                      }}
                      style={{ width: "100%", height: "28px", border: "1px solid var(--border-subtle)", borderRadius: "4px", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "12px", cursor: "pointer" }}
                    >
                      <option value="short">Short</option>
                      <option value="long">Long</option>
                      <option value="bun">Bun</option>
                      <option value="redspiky">Red Spiky</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "10px", color: "var(--text-tertiary)", display: "block", marginBottom: "3px" }}>Premium Desk</label>
                    <button
                      onClick={async () => {
                        const newVal = !(selectedAgent.characterConfig?.premium);
                        const res = await fetch("/api/factory/agents", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: selectedAgent.id, character_config: { ...selectedAgent.characterConfig, premium: newVal } }),
                        });
                        if (res.ok) { const d = await fetch('/api/factory').then(r=>r.json()); setData(d); const updated = (d.liveAgents||[]).find((a:any)=>a.id===selectedAgent.id); if(updated) setSelectedAgent(updated); }
                      }}
                      style={{
                        width: "100%", height: "28px", border: "1px solid var(--border-subtle)", borderRadius: "4px",
                        background: selectedAgent.characterConfig?.premium ? "#7c5cfc18" : "var(--bg-secondary)",
                        color: selectedAgent.characterConfig?.premium ? "#7c5cfc" : "var(--text-tertiary)",
                        fontSize: "11px", fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      {selectedAgent.characterConfig?.premium ? "👑 ON" : "OFF"}
                    </button>
                  </div>
                </div>
                {/* Mug text — only shows when premium is on */}
                {selectedAgent.characterConfig?.premium && (
                  <div style={{ marginTop: "8px" }}>
                    <label style={{ fontSize: "10px", color: "var(--text-tertiary)", display: "block", marginBottom: "3px" }}>☕ Mug Text</label>
                    <input
                      type="text"
                      defaultValue={selectedAgent.characterConfig?.mugText || "BOSS"}
                      maxLength={6}
                      onBlur={async (e) => {
                        const res = await fetch("/api/factory/agents", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: selectedAgent.id, character_config: { ...selectedAgent.characterConfig, mugText: e.target.value } }),
                        });
                        if (res.ok) { const d = await fetch('/api/factory').then(r=>r.json()); setData(d); const updated = (d.liveAgents||[]).find((a:any)=>a.id===selectedAgent.id); if(updated) setSelectedAgent(updated); }
                      }}
                      style={{ width: "100%", height: "28px", border: "1px solid var(--border-subtle)", borderRadius: "4px", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "12px", padding: "0 8px", textAlign: "center", fontWeight: 700 }}
                      placeholder="BOSS"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
