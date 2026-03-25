"use client";

import { useState, useEffect } from "react";
import { Project } from "@/lib/types";

/* ── Assignee map ── */
const ASSIGNEE_MAP: Record<string, { emoji: string; name: string }> = {
  shmack: { emoji: "🤙", name: "Mr. Shmack" },
  douglas: { emoji: "👤", name: "Douglas" },
};

/* ── Status badge config ── */
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  active:    { label: "Active",    bg: "rgba(34,197,94,0.15)",  text: "#22c55e" },
  planning:  { label: "Planning",  bg: "rgba(59,130,246,0.15)", text: "#3b82f6" },
  completed: { label: "Completed", bg: "rgba(168,85,247,0.15)", text: "#a855f7" },
  // Legacy statuses
  "in-progress": { label: "In Progress", bg: "rgba(124,92,252,0.15)", text: "#7c5cfc" },
  paused:    { label: "Paused",    bg: "rgba(234,179,8,0.15)",  text: "#eab308" },
  done:      { label: "Done",      bg: "rgba(168,85,247,0.15)", text: "#a855f7" },
};

/* ── Priority badge config ── */
const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  high:   { label: "High",   bg: "rgba(239,68,68,0.15)",  text: "#ef4444" },
  medium: { label: "Medium", bg: "rgba(234,179,8,0.15)",  text: "#eab308" },
  low:    { label: "Low",    bg: "rgba(59,130,246,0.15)", text: "#3b82f6" },
};

/* ── Relative time ── */
function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "1 day ago";
  if (diffDay < 7) return `${diffDay} days ago`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek === 1) return "1 week ago";
  if (diffWeek < 5) return `${diffWeek} weeks ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth === 1) return "1 month ago";
  return `${diffMonth} months ago`;
}

/* ── Progress bar component ── */
function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Color based on percentage
  let barColor = "#3b82f6"; // blue default
  if (pct >= 80) barColor = "#22c55e"; // green
  else if (pct >= 50) barColor = "#eab308"; // yellow
  else if (pct >= 25) barColor = "#f97316"; // orange

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
          {completed}/{total} tasks
        </span>
        <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 600 }}>
          {pct}%
        </span>
      </div>
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ background: "var(--bg-tertiary)", height: "8px" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

/* ── Project Card ── */
function ProjectCard({ project }: { project: Project }) {
  const statusCfg = STATUS_CONFIG[project.status] || STATUS_CONFIG.active;
  const priorityCfg = PRIORITY_CONFIG[project.priority] || PRIORITY_CONFIG.medium;
  const assignee = ASSIGNEE_MAP[project.assignee] || { emoji: "🔹", name: project.assignee };
  const tasks = project.tasks || { total: 0, completed: 0 };

  return (
    <div
      className="rounded-2xl border p-6 flex flex-col gap-4 transition-all duration-200"
      style={{
        background: "var(--bg-elevated)",
        borderColor: "var(--border-subtle)",
        minHeight: "220px",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {/* Top row: Name + Status */}
      <div className="flex items-start justify-between gap-3">
        <h3
          className="text-lg font-bold leading-snug"
          style={{ color: "var(--text-primary)", fontSize: "1.2rem" }}
        >
          {project.name}
        </h3>
        <span
          className="px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 whitespace-nowrap"
          style={{ background: statusCfg.bg, color: statusCfg.text }}
        >
          {statusCfg.label}
        </span>
      </div>

      {/* Description */}
      <p
        className="leading-relaxed"
        style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: "1.6" }}
      >
        {project.description}
      </p>

      {/* Progress bar */}
      <ProgressBar completed={tasks.completed} total={tasks.total} />

      {/* Bottom row: Agent, Priority, Time */}
      <div className="flex items-center justify-between mt-auto pt-2">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "1.2rem" }}>{assignee.emoji}</span>
          <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 500 }}>
            {assignee.name}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: priorityCfg.bg, color: priorityCfg.text }}
          >
            {priorityCfg.label}
          </span>
          <span style={{ color: "var(--text-tertiary)", fontSize: "0.8rem" }}>
            {timeAgo(project.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="px-8 pt-8 pb-6 border-b flex-shrink-0"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--text-primary)", fontSize: "1.75rem" }}
        >
          Projects
        </h1>
        <p className="mt-1" style={{ color: "var(--text-tertiary)", fontSize: "0.95rem" }}>
          {loading ? "Loading..." : `${projects.length} project${projects.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Projects Grid */}
      <div className="fab-scroll-pad" style={{ flex: 1, overflowY: "auto", padding: "24px 32px 32px" }}>
        {loading ? (
          <div
            className="flex items-center justify-center py-20"
            style={{ color: "var(--text-tertiary)" }}
          >
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: "var(--accent-purple)", borderTopColor: "transparent" }}
              />
              <span style={{ fontSize: "0.9rem" }}>Loading projects...</span>
            </div>
          </div>
        ) : projects.length === 0 ? (
          <div
            className="flex items-center justify-center py-20"
            style={{ color: "var(--text-tertiary)" }}
          >
            <span style={{ fontSize: "0.95rem" }}>No projects yet</span>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 400px), 1fr))", gap: 20 }}>
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
