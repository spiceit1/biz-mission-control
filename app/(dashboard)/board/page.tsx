"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, X, Clock, AlertCircle, Minus, ChevronDown } from "lucide-react";
import { Task, Priority, TaskStatus, Assignee } from "@/lib/types";

// ── Heartbeat types ─────────────────────────────────────────────────────────
interface HeartbeatEntry {
  id: string;
  timestamp: string;
  type: "ok" | "action" | "alert" | "task";
  summary: string;
  details?: string;
  taskName?: string;
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const HB_ICONS: Record<string, string> = {
  ok: "✅",
  action: "⚡",
  task: "📋",
  alert: "🚨",
};

const HB_BADGE: Record<string, { bg: string; color: string }> = {
  ok:     { bg: "#9898a018", color: "#9898a0" },
  action: { bg: "#4d7cfe18", color: "#4d7cfe" },
  task:   { bg: "#7c5cfc18", color: "#7c5cfc" },
  alert:  { bg: "#f05b5b18", color: "#f05b5b" },
};

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "in-progress", label: "In Progress" },
  { id: "in-review", label: "In Review" },
  { id: "done", label: "Done" },
];

const COLUMN_COLORS: Record<TaskStatus, string> = {
  backlog: "#9898a0",
  "in-progress": "#7c5cfc",
  "in-review": "#f0b429",
  done: "#26c97a",
};

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; icon: React.ReactNode }> = {
  high: { label: "High", color: "#f05b5b", icon: <AlertCircle size={11} /> },
  medium: { label: "Medium", color: "#f0b429", icon: <ChevronDown size={11} /> },
  low: { label: "Low", color: "#4d7cfe", icon: <Minus size={11} /> },
};

function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 6px", borderRadius: 4, color: cfg.color, background: cfg.color + "18", fontSize: "0.7rem", fontWeight: 500 }}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function AssigneeBadge({ assignee }: { assignee: Assignee }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 6px", borderRadius: 4, color: assignee === "shmack" ? "#7c5cfc" : "#26c97a", background: assignee === "shmack" ? "#7c5cfc18" : "#26c97a18", fontSize: "0.7rem", fontWeight: 500 }}>
      {assignee === "shmack" ? "🤙 Shmack" : "👤 Douglas"}
    </span>
  );
}

function TaskDetailModal({ task, onClose, onStatusChange, onDelete }: {
  task: Task; onClose: () => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
}) {
  const dateObj = task.createdAt ? new Date(task.createdAt) : null;
  const date = dateObj && !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 480, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 24, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>{task.title}</h2>
          <button onClick={onClose} style={{ color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <PriorityBadge priority={task.priority} />
          <AssigneeBadge assignee={task.assignee} />
          <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: "0.75rem", fontWeight: 500, color: task.status === "done" ? "#26c97a" : task.status === "in-progress" ? "#7c5cfc" : "#9898a0", background: task.status === "done" ? "#26c97a18" : task.status === "in-progress" ? "#7c5cfc18" : "#9898a018" }}>{task.status}</span>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Description</label>
          <div style={{ fontSize: 14, lineHeight: 1.6, borderRadius: 6, padding: 12, border: "1px solid var(--border-subtle)", background: "var(--bg-tertiary)", color: task.description ? "var(--text-primary)" : "var(--text-muted)", minHeight: 64 }}>{task.description || "No description"}</div>
        </div>
        {date && <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20, fontSize: 12, color: "var(--text-tertiary)" }}><Clock size={12} />Created {date}</div>}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 8 }}>Move to</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {COLUMNS.filter((c) => c.id !== task.status).map((col) => (
              <button key={col.id} onClick={() => { onStatusChange(task.id, col.id); onClose(); }}
                style={{ padding: "6px 12px", borderRadius: 6, fontSize: 13, fontWeight: 500, border: "1px solid var(--border-default)", color: "var(--text-secondary)", background: "transparent", cursor: "pointer" }}>→ {col.label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "8px 16px", borderRadius: 6, fontSize: 14, fontWeight: 500, border: "1px solid var(--border-default)", color: "var(--text-secondary)", background: "transparent", cursor: "pointer" }}>Close</button>
          <button onClick={() => { onDelete(task.id); onClose(); }} style={{ padding: "8px 16px", borderRadius: 6, fontSize: 14, fontWeight: 500, background: "#f05b5b18", color: "#f05b5b", border: "1px solid #f05b5b40", cursor: "pointer" }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task, onStatusChange, onDelete, onSelect }: {
  task: Task; onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void; onSelect: (task: Task) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const dateObj = task.createdAt ? new Date(task.createdAt) : null;
  const date = dateObj && !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;

  return (
    <div draggable onDragStart={(e) => { e.dataTransfer.setData("taskId", task.id); setDragging(true); }} onDragEnd={() => setDragging(false)}
      onClick={() => onSelect(task)}
      className="group"
      style={{ borderRadius: 8, padding: 12, cursor: "pointer", border: `1px solid ${dragging ? "var(--border-strong)" : "var(--border-subtle)"}`, background: dragging ? "var(--bg-hover)" : "var(--bg-elevated)", opacity: dragging ? 0.5 : 1, boxShadow: "0 1px 3px rgba(0,0,0,0.3)", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.4, flex: 1 }}>{task.title}</h3>
        <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} style={{ color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer", padding: 2, opacity: 0, transition: "opacity 0.15s" }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}><X size={12} /></button>
      </div>
      {task.description && <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{task.description}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        <PriorityBadge priority={task.priority} />
        <AssigneeBadge assignee={task.assignee} />
      </div>
      {date && <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}><Clock size={10} />{date}</div>}
    </div>
  );
}

function Column({ column, tasks, onStatusChange, onDelete, onDrop, onSelect }: {
  column: { id: TaskStatus; label: string }; tasks: Task[];
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void; onDrop: (taskId: string, status: TaskStatus) => void;
  onSelect: (task: Task) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 200, maxWidth: 320 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "0 4px" }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLUMN_COLORS[column.id], flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)" }}>{column.label}</span>
        <span style={{ marginLeft: "auto", fontSize: "0.65rem", fontWeight: 500, padding: "1px 6px", borderRadius: 4, color: "var(--text-tertiary)", background: "var(--bg-elevated)" }}>{tasks.length}</span>
      </div>
      <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); onDrop(e.dataTransfer.getData("taskId"), column.id); setDragOver(false); }}
        style={{ flex: 1, minHeight: 96, borderRadius: 8, padding: 8, background: dragOver ? "var(--bg-elevated)" : "transparent", border: dragOver ? "1px dashed var(--border-strong)" : "1px dashed transparent", transition: "background 0.15s, border 0.15s" }}>
        {tasks.map((task, i) => (
          <TaskCard key={task.id || `task-${i}`} task={task} onStatusChange={onStatusChange} onDelete={onDelete} onSelect={onSelect} />
        ))}
        {tasks.length === 0 && !dragOver && (
          <div style={{ fontSize: 12, textAlign: "center", padding: "32px 12px", borderRadius: 8, border: "1px dashed var(--border-subtle)", color: "var(--text-muted)" }}>Drop here</div>
        )}
      </div>
    </div>
  );
}

// ── Mobile column section (collapsible) ─────────────────────────────────────
function MobileColumn({ column, tasks, onStatusChange, onDelete, onSelect }: {
  column: { id: TaskStatus; label: string }; tasks: Task[];
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void; onSelect: (task: Task) => void;
}) {
  const [collapsed, setCollapsed] = useState(column.id === "done");
  const color = COLUMN_COLORS[column.id];

  return (
    <div style={{ background: "var(--bg-secondary)", border: `1px solid var(--border-subtle)`, borderTop: `3px solid ${color}`, borderRadius: 8, marginBottom: 12, overflow: "hidden" }}>
      <div onClick={() => setCollapsed((c) => !c)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", cursor: "pointer", userSelect: "none" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.08em", flex: 1 }}>{column.label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: color + "30", color: color }}>{tasks.length}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{collapsed ? "▶" : "▼"}</span>
      </div>
      {!collapsed && (
        <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "10px 12px" }}>
          {tasks.length === 0 ? (
            <div style={{ textAlign: "center", padding: "16px", fontSize: 13, color: "var(--text-muted)", opacity: 0.6 }}>Empty</div>
          ) : (
            tasks.map((task, i) => (
              <div key={task.id || i} onClick={() => onSelect(task)}
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderLeft: `3px solid ${PRIORITY_CONFIG[task.priority].color}`, borderRadius: 6, padding: "12px 14px", marginBottom: 8, cursor: "pointer" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8, lineHeight: 1.4 }}>{task.title}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <PriorityBadge priority={task.priority} />
                  <AssigneeBadge assignee={task.assignee} />
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AddTaskModal({ onClose, onAdd }: { onClose: () => void; onAdd: (task: Omit<Task, "id" | "createdAt">) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState<Assignee>("douglas");
  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<TaskStatus>("backlog");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({ title: title.trim(), description: description.trim(), assignee, priority, status });
    onClose();
  };

  const inputStyle = { background: "var(--bg-tertiary)", borderColor: "var(--border-default)", color: "var(--text-primary)", outline: "none" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 480, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 24, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>New Task</h2>
          <button onClick={onClose} style={{ color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer" }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Title *</label>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?"
              className="w-full px-3 py-2 rounded-md border text-sm" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details..." rows={3}
              className="w-full px-3 py-2 rounded-md border text-sm resize-none" style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className="w-full px-3 py-2 rounded-md border text-sm" style={inputStyle}>
                {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Assignee</label>
              <select value={assignee} onChange={(e) => setAssignee(e.target.value as Assignee)} className="w-full px-3 py-2 rounded-md border text-sm" style={inputStyle}>
                <option value="douglas">Douglas</option>
                <option value="shmack">Shmack 🤙</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="w-full px-3 py-2 rounded-md border text-sm" style={inputStyle}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, paddingTop: 8 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "8px 16px", borderRadius: 6, fontSize: 14, fontWeight: 500, border: "1px solid var(--border-default)", color: "var(--text-secondary)", background: "transparent", cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={!title.trim()} style={{ flex: 1, padding: "8px 16px", borderRadius: 6, fontSize: 14, fontWeight: 500, background: title.trim() ? "var(--accent-purple)" : "var(--bg-hover)", color: title.trim() ? "white" : "var(--text-muted)", border: "none", cursor: title.trim() ? "pointer" : "default" }}>Create Task</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HeartbeatFeed({ isMobile }: { isMobile: boolean }) {
  const [entries, setEntries] = useState<HeartbeatEntry[]>([]);
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchHeartbeat = useCallback(async () => {
    try {
      const res = await fetch("/api/heartbeat");
      if (!res.ok) return;
      const data = await res.json();
      setEntries((data.entries ?? []).slice(0, 20));
      setLastHeartbeat(data.lastHeartbeat ?? null);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchHeartbeat();
    const interval = setInterval(fetchHeartbeat, 60_000);
    return () => clearInterval(interval);
  }, [fetchHeartbeat]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [entries]);

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      width: isMobile ? "100%" : 220,
      flexShrink: 0,
      background: "var(--bg-secondary)",
      borderTop: isMobile ? "1px solid var(--border-subtle)" : "none",
      borderLeft: isMobile ? "none" : "1px solid var(--border-subtle)",
      maxHeight: isMobile ? 280 : "100%",
    }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", margin: 0 }}>Heartbeat Activity</h3>
        {lastHeartbeat && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, marginBottom: 0 }}>Last: {relativeTime(lastHeartbeat)}</p>
        )}
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        {entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No heartbeat activity yet</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {entries.map((entry) => {
              const badge = HB_BADGE[entry.type] ?? HB_BADGE.ok;
              return (
                <div key={entry.id} style={{ borderRadius: 6, padding: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-elevated)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 12 }}>{HB_ICONS[entry.type] ?? "✅"}</span>
                    <span style={{ padding: "2px 6px", borderRadius: 4, fontWeight: 500, background: badge.bg, color: badge.color, fontSize: 11 }}>{entry.type}</span>
                    <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: 11 }}>{relativeTime(entry.timestamp)}</span>
                  </div>
                  <p style={{ color: "var(--text-primary)", fontSize: 13, lineHeight: 1.4, margin: 0 }}>{entry.summary}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BoardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fetchTasks = useCallback(async () => {
    const res = await fetch("/api/tasks");
    setTasks(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const handleAddTask = async (taskData: Omit<Task, "id" | "createdAt">) => {
    const newTask: Task = { ...taskData, id: `task-${Date.now()}`, createdAt: new Date().toISOString() };
    await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newTask) });
    setTasks((prev) => [...prev, newTask]);
  };

  const handleStatusChange = async (id: string, status: TaskStatus) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const updated = { ...task, status };
    await fetch("/api/tasks", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
  };

  const handleDelete = async (id: string) => {
    await fetch("/api/tasks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div style={{ display: "flex", height: "100%", flexDirection: isMobile ? "column" : "row", overflow: "hidden" }}>
      {/* Board area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "12px 14px" : "16px 24px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0, gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Task Board</h1>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2, marginBottom: 0 }}>{tasks.length} tasks{!isMobile ? " · Drag to move" : ""}</p>
          </div>
          <button onClick={() => setShowModal(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: isMobile ? "8px 12px" : "6px 12px", borderRadius: 6, fontSize: 14, fontWeight: 500, background: "var(--accent-purple)", color: "white", border: "none", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>
            <Plus size={14} />New Task
          </button>
        </div>

        {/* Kanban */}
        {isMobile ? (
          /* Mobile: vertically stacked collapsible columns */
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 4px" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>Loading...</div>
            ) : (
              COLUMNS.map((column) => (
                <MobileColumn key={column.id} column={column}
                  tasks={tasks.filter((t) => t.status === column.id)}
                  onStatusChange={handleStatusChange} onDelete={handleDelete} onSelect={setSelectedTask} />
              ))
            )}
          </div>
        ) : (
          /* Desktop: flex columns that share space */
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", gap: 12, padding: "20px 20px", flex: 1, minHeight: 0, overflow: "hidden" }}>
              {loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", color: "var(--text-tertiary)" }}>Loading...</div>
              ) : (
                COLUMNS.map((column) => (
                  <Column key={column.id} column={column}
                    tasks={tasks.filter((t) => t.status === column.id)}
                    onStatusChange={handleStatusChange} onDelete={handleDelete}
                    onDrop={handleStatusChange} onSelect={setSelectedTask} />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Heartbeat sidebar */}
      <HeartbeatFeed isMobile={isMobile} />

      {showModal && <AddTaskModal onClose={() => setShowModal(false)} onAdd={handleAddTask} />}

      {selectedTask && (
        <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)}
          onStatusChange={(id, status) => { handleStatusChange(id, status); setSelectedTask(null); }}
          onDelete={(id) => { handleDelete(id); setSelectedTask(null); }} />
      )}
    </div>
  );
}
