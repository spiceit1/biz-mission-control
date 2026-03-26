"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, Clock, AlertTriangle, RefreshCw, Cpu, ClipboardList, Check, RotateCcw } from "lucide-react";

interface ReviewItem {
  type: "task" | "agent";
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  assignee?: string;
  agentId?: string;
  role?: string;
  reviewNotes?: string;
  updatedAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/review");
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setItems(json.items || []);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
    const interval = setInterval(fetchItems, 30000);
    return () => clearInterval(interval);
  }, [fetchItems]);

  const handleAction = async (item: ReviewItem, action: "approve" | "return") => {
    setActioningId(item.id);
    try {
      await fetch("/api/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: item.type, id: item.id, action }),
      });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch {
      // ignore
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div style={{ padding: "24px 32px", maxWidth: "1000px" }} className="fab-scroll-pad">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
            <CheckCircle size={20} style={{ display: "inline", marginRight: "8px", verticalAlign: "middle", color: "var(--accent-yellow)" }} />
            Review Queue
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Items requiring human review · {items.length} pending
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchItems(); }}
          style={{
            display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px",
            borderRadius: "8px", border: "1px solid var(--border-subtle)",
            background: "var(--bg-secondary)", color: "var(--text-secondary)", cursor: "pointer", fontSize: "13px",
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Items */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ height: "120px", background: "var(--bg-secondary)", borderRadius: "12px" }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div style={{
          padding: "60px 20px", textAlign: "center",
          background: "var(--bg-secondary)", borderRadius: "12px", border: "1px solid var(--border-subtle)",
        }}>
          <CheckCircle size={40} style={{ color: "var(--accent-green)", marginBottom: "16px" }} />
          <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
            All clear!
          </div>
          <div style={{ color: "var(--text-tertiary)", fontSize: "14px" }}>
            No items need review right now. Tasks and agents marked as &quot;needs_review&quot; will appear here.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {items.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              style={{
                padding: "20px", background: "var(--bg-secondary)", borderRadius: "12px",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0,
                  background: item.type === "task" ? "rgba(240,180,41,0.1)" : "rgba(77,124,254,0.1)",
                }}>
                  {item.type === "task" ? (
                    <ClipboardList size={18} style={{ color: "var(--accent-yellow)" }} />
                  ) : (
                    <Cpu size={18} style={{ color: "var(--accent-blue)" }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>
                      {item.title}
                    </span>
                    <span style={{
                      fontSize: "10px", padding: "2px 8px", borderRadius: "4px",
                      background: "var(--bg-tertiary)", color: "var(--text-tertiary)",
                      textTransform: "uppercase", fontWeight: 600,
                    }}>
                      {item.type}
                    </span>
                  </div>
                  {item.description && (
                    <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "10px", lineHeight: 1.5 }}>
                      {item.description}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "14px" }}>
                    <span><Clock size={11} style={{ marginRight: "4px", verticalAlign: "middle" }} />{timeAgo(item.updatedAt)}</span>
                    {item.priority && <span>Priority: {item.priority}</span>}
                    {item.assignee && <span>Assignee: {item.assignee}</span>}
                    {item.role && <span>Role: {item.role}</span>}
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => handleAction(item, "approve")}
                      disabled={actioningId === item.id}
                      style={{
                        display: "flex", alignItems: "center", gap: "6px",
                        padding: "8px 16px", borderRadius: "8px", border: "none",
                        background: "var(--accent-green)", color: "white",
                        cursor: "pointer", fontSize: "13px", fontWeight: 500,
                        opacity: actioningId === item.id ? 0.5 : 1,
                      }}
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      onClick={() => handleAction(item, "return")}
                      disabled={actioningId === item.id}
                      style={{
                        display: "flex", alignItems: "center", gap: "6px",
                        padding: "8px 16px", borderRadius: "8px",
                        border: "1px solid var(--border-subtle)", background: "var(--bg-tertiary)",
                        color: "var(--text-secondary)", cursor: "pointer", fontSize: "13px",
                        opacity: actioningId === item.id ? 0.5 : 1,
                      }}
                    >
                      <RotateCcw size={14} /> Return
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
