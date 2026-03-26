"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardList, RefreshCw, X, Plus } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assignee?: string;
  agentId?: string;
  createdAt: string;
  updatedAt?: string;
  reviewNotes?: string;
}

const COLUMNS = [
  { key: "backlog", label: "Backlog", color: "var(--text-tertiary)" },
  { key: "in-progress", label: "In Progress", color: "var(--accent-blue)" },
  { key: "standby", label: "Standby", color: "var(--accent-blue)" },
  { key: "needs_review", label: "Needs Review", color: "var(--accent-yellow)" },
  { key: "in-review", label: "In Review", color: "var(--accent-yellow)" },
  { key: "blocked", label: "Blocked", color: "var(--accent-red)" },
  { key: "done", label: "Done", color: "var(--accent-green)" },
];

function priorityBadge(p: string) {
  const colors: Record<string, { bg: string; text: string }> = {
    high: { bg: "rgba(240,91,91,0.15)", text: "var(--accent-red)" },
    medium: { bg: "rgba(240,180,41,0.15)", text: "var(--accent-yellow)" },
    low: { bg: "rgba(107,107,117,0.15)", text: "var(--text-tertiary)" },
  };
  const c = colors[p] || colors.low;
  return (
    <span style={{
      fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px",
      background: c.bg, color: c.text, textTransform: "uppercase",
    }}>
      {p}
    </span>
  );
}

function timeAgo(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newStatus, setNewStatus] = useState("backlog");

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setTasks(Array.isArray(json) ? json : []);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...task, status: newStatus }),
      });
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
      if (selectedTask?.id === taskId) setSelectedTask({ ...selectedTask, status: newStatus });
    } catch { /* ignore */ }
  };

  const createTask = async () => {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, description: newDesc, priority: newPriority, status: newStatus }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewTitle(""); setNewDesc(""); setNewPriority("medium"); setNewStatus("backlog");
        fetchTasks();
      }
    } catch { /* ignore */ }
  };

  // Group tasks by status
  const grouped: Record<string, Task[]> = {};
  for (const col of COLUMNS) grouped[col.key] = [];
  for (const task of tasks) {
    const key = task.status || "backlog";
    if (grouped[key]) grouped[key].push(task);
    else if (grouped["backlog"]) grouped["backlog"].push(task);
  }

  // Only show columns that have tasks or are core columns
  const coreColumns = ["backlog", "in-progress", "needs_review", "in-review", "done"];
  const visibleColumns = COLUMNS.filter((col) =>
    coreColumns.includes(col.key) || (grouped[col.key] && grouped[col.key].length > 0)
  );

  if (loading) {
    return (
      <div style={{ padding: "32px" }}>
        <div style={{ height: "32px", width: "200px", background: "var(--bg-tertiary)", borderRadius: "8px", marginBottom: "24px" }} />
        <div style={{ display: "flex", gap: "16px" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: "300px", background: "var(--bg-secondary)", borderRadius: "12px" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px", height: "100%", display: "flex", flexDirection: "column" }} className="fab-scroll-pad">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>Tasks</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>{tasks.length} tasks across {visibleColumns.length} columns</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px",
              borderRadius: "8px", border: "none",
              background: "var(--accent-purple)", color: "white", cursor: "pointer", fontSize: "13px", fontWeight: 500,
            }}
          >
            <Plus size={14} /> New Task
          </button>
          <button
            onClick={() => { setLoading(true); fetchTasks(); }}
            style={{
              display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px",
              borderRadius: "8px", border: "1px solid var(--border-subtle)",
              background: "var(--bg-secondary)", color: "var(--text-secondary)", cursor: "pointer", fontSize: "13px",
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div style={{ display: "flex", gap: "16px", flex: 1, overflow: "auto", minHeight: 0, paddingBottom: "16px" }}>
        {visibleColumns.map((col) => (
          <div
            key={col.key}
            style={{
              flex: "0 0 280px", display: "flex", flexDirection: "column",
              background: "var(--bg-secondary)", borderRadius: "12px",
              border: "1px solid var(--border-subtle)", overflow: "hidden",
            }}
          >
            {/* Column Header */}
            <div style={{
              padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: col.color }} />
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{col.label}</span>
              </div>
              <span style={{
                fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "8px",
                background: "var(--bg-tertiary)", color: "var(--text-tertiary)",
              }}>
                {grouped[col.key].length}
              </span>
            </div>

            {/* Cards */}
            <div style={{ flex: 1, overflow: "auto", padding: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {grouped[col.key].length === 0 ? (
                <div style={{ padding: "20px 12px", textAlign: "center", fontSize: "12px", color: "var(--text-tertiary)" }}>
                  No tasks
                </div>
              ) : (
                grouped[col.key].map((task) => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    style={{
                      padding: "14px",
                      background: "var(--bg-tertiary)",
                      borderRadius: "8px",
                      border: "1px solid var(--border-subtle)",
                      cursor: "pointer",
                      transition: "border-color 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-subtle)"; }}
                  >
                    <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "8px" }}>
                      {task.title}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      {priorityBadge(task.priority)}
                      <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                        {timeAgo(task.updatedAt || task.createdAt)}
                      </span>
                    </div>
                    {task.assignee && (
                      <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--text-tertiary)" }}>
                        {task.assignee}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Task Detail Drawer */}
      {selectedTask && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", justifyContent: "flex-end" }}
        >
          <div
            onClick={() => setSelectedTask(null)}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }}
          />
          <div style={{
            position: "relative", width: "440px", maxWidth: "90vw", height: "100%",
            background: "var(--bg-secondary)", borderLeft: "1px solid var(--border-subtle)",
            display: "flex", flexDirection: "column", animation: "slideInRight 0.2s ease",
          }}>
            <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
            <div style={{
              padding: "20px", borderBottom: "1px solid var(--border-subtle)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-primary)" }}>Task Detail</h2>
              <button
                onClick={() => setSelectedTask(null)}
                style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: "20px", flex: 1, overflow: "auto" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>
                {selectedTask.title}
              </h3>
              {selectedTask.description && (
                <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "20px", lineHeight: 1.6 }}>
                  {selectedTask.description}
                </p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "var(--text-tertiary)" }}>Status</span>
                  <select
                    value={selectedTask.status}
                    onChange={(e) => updateTaskStatus(selectedTask.id, e.target.value)}
                    style={{
                      background: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)",
                      borderRadius: "6px", color: "var(--text-primary)", padding: "4px 8px", fontSize: "12px",
                    }}
                  >
                    {COLUMNS.map((col) => (
                      <option key={col.key} value={col.key}>{col.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "var(--text-tertiary)" }}>Priority</span>
                  <span>{priorityBadge(selectedTask.priority)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "var(--text-tertiary)" }}>Assignee</span>
                  <span style={{ color: "var(--text-primary)" }}>{selectedTask.assignee || "Unassigned"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "var(--text-tertiary)" }}>Created</span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {selectedTask.createdAt ? new Date(selectedTask.createdAt).toLocaleString() : "—"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "var(--text-tertiary)" }}>Updated</span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {timeAgo(selectedTask.updatedAt || selectedTask.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setShowCreate(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
          <div style={{
            position: "relative", width: "480px", maxWidth: "90vw",
            background: "var(--bg-secondary)", borderRadius: "16px",
            border: "1px solid var(--border-subtle)", padding: "24px",
          }}>
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "20px" }}>New Task</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Task title..."
                style={{
                  padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-subtle)",
                  background: "var(--bg-tertiary)", color: "var(--text-primary)", fontSize: "14px", outline: "none",
                }}
              />
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description (optional)..."
                rows={3}
                style={{
                  padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-subtle)",
                  background: "var(--bg-tertiary)", color: "var(--text-primary)", fontSize: "14px",
                  outline: "none", resize: "vertical",
                }}
              />
              <div style={{ display: "flex", gap: "12px" }}>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  style={{
                    flex: 1, padding: "8px 12px", borderRadius: "8px",
                    border: "1px solid var(--border-subtle)", background: "var(--bg-tertiary)",
                    color: "var(--text-primary)", fontSize: "13px",
                  }}
                >
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  style={{
                    flex: 1, padding: "8px 12px", borderRadius: "8px",
                    border: "1px solid var(--border-subtle)", background: "var(--bg-tertiary)",
                    color: "var(--text-primary)", fontSize: "13px",
                  }}
                >
                  {COLUMNS.map((col) => (
                    <option key={col.key} value={col.key}>{col.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
                <button
                  onClick={() => setShowCreate(false)}
                  style={{
                    padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border-subtle)",
                    background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: "13px",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={createTask}
                  disabled={!newTitle.trim()}
                  style={{
                    padding: "8px 20px", borderRadius: "8px", border: "none",
                    background: newTitle.trim() ? "var(--accent-purple)" : "var(--bg-tertiary)",
                    color: newTitle.trim() ? "white" : "var(--text-tertiary)",
                    cursor: newTitle.trim() ? "pointer" : "default", fontSize: "13px", fontWeight: 500,
                  }}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
