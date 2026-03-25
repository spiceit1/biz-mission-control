"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Mail, MailOpen, Send, RefreshCw, Clock, ChevronDown, ChevronRight, ArrowLeft, Loader2, Inbox as InboxIcon } from "lucide-react";

interface InboxMessage {
  id: number;
  from_agent: string;
  to_agent: string;
  subject: string | null;
  message: string;
  status: string;
  priority: string;
  created_at: string;
  read_at: string | null;
  reply_to_id: number | null;
}

const AGENT_COLORS: Record<string, string> = {
  shmack: "#8b5cf6",
  paul: "#3b82f6",
  douglas: "#f59e0b",
  morris: "#10b981",
};

const AGENT_EMOJI: Record<string, string> = {
  shmack: "🤙",
  paul: "🤖",
  douglas: "👤",
  morris: "👤",
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function InboxPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<InboxMessage | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/inbox");
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch (e) {
      console.error("fetch inbox error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const markRead = async (msg: InboxMessage) => {
    if (msg.status === "read") return;
    try {
      await fetch("/api/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: msg.id, status: "read" }),
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, status: "read", read_at: new Date().toISOString() } : m))
      );
    } catch (e) {
      console.error("mark read error:", e);
    }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selected || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_agent: selected.to_agent,
          to_agent: selected.from_agent,
          subject: `Re: ${selected.subject || "No subject"}`,
          message: replyText.trim(),
          reply_to_id: selected.id,
        }),
      });
      if (res.ok) {
        setReplyText("");
        setReplyOpen(false);
        await fetchMessages();
      }
    } catch (e) {
      console.error("send reply error:", e);
    } finally {
      setSending(false);
    }
  };

  const openMessage = (msg: InboxMessage) => {
    setSelected(msg);
    setReplyOpen(false);
    setReplyText("");
    markRead(msg);
  };

  const filtered = filter === "unread" ? messages.filter((m) => m.status === "unread") : messages;
  const unreadCount = messages.filter((m) => m.status === "unread").length;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* ── Message list panel ──────────────────────────────── */}
      <div
        style={{
          width: selected ? "380px" : "100%",
          maxWidth: "100%",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          borderRight: selected ? "1px solid var(--border-subtle)" : "none",
          overflow: "hidden",
          transition: "width 0.2s",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <InboxIcon size={22} style={{ color: "var(--accent-purple)" }} />
              <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                Agent Inbox
              </h1>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: "#ef4444",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "10px",
                    lineHeight: "1.4",
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </div>
            <button
              onClick={fetchMessages}
              title="Refresh"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              <RefreshCw size={15} />
            </button>
          </div>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: "8px" }}>
            {(["all", "unread"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "6px 16px",
                  fontSize: "13px",
                  fontWeight: filter === f ? 600 : 500,
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  background: filter === f ? "var(--accent-purple)" : "var(--bg-elevated)",
                  color: filter === f ? "#fff" : "var(--text-secondary)",
                  transition: "all 0.15s",
                  textTransform: "capitalize",
                }}
              >
                {f} {f === "unread" && unreadCount > 0 ? `(${unreadCount})` : ""}
              </button>
            ))}
          </div>
        </div>

        {/* Message list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px", color: "var(--text-tertiary)", gap: "8px" }}>
              <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> Loading…
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", color: "var(--text-tertiary)" }}>
              <MailOpen size={40} style={{ marginBottom: "12px", opacity: 0.4 }} />
              <div style={{ fontSize: "15px", fontWeight: 500 }}>
                {filter === "unread" ? "No unread messages" : "Inbox is empty"}
              </div>
              <div style={{ fontSize: "13px", marginTop: "4px" }}>
                Agent-to-agent messages will appear here
              </div>
            </div>
          )}

          {filtered.map((msg) => {
            const isSelected = selected?.id === msg.id;
            const isUnread = msg.status === "unread";
            const color = AGENT_COLORS[msg.from_agent] || "#6b7280";
            const emoji = AGENT_EMOJI[msg.from_agent] || "📨";

            return (
              <div
                key={msg.id}
                onClick={() => openMessage(msg)}
                style={{
                  display: "flex",
                  gap: "12px",
                  padding: "14px 16px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  background: isSelected ? "var(--bg-hover)" : "transparent",
                  borderLeft: isUnread ? `3px solid ${color}` : "3px solid transparent",
                  marginBottom: "4px",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "var(--bg-hover)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "50%",
                    background: color + "20",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    flexShrink: 0,
                  }}
                >
                  {emoji}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: isUnread ? 700 : 500,
                        color: "var(--text-primary)",
                        textTransform: "capitalize",
                      }}
                    >
                      {msg.from_agent}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--text-tertiary)", flexShrink: 0 }}>
                      {timeAgo(msg.created_at)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: isUnread ? 600 : 500,
                      color: isUnread ? "var(--text-primary)" : "var(--text-secondary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      marginBottom: "2px",
                    }}
                  >
                    {msg.subject || "No subject"}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--text-tertiary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {msg.message.slice(0, 80)}
                  </div>
                </div>

                {/* Priority + unread dot */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  {isUnread && (
                    <div
                      style={{
                        width: "9px",
                        height: "9px",
                        borderRadius: "50%",
                        background: color,
                      }}
                    />
                  )}
                  {msg.priority === "high" && (
                    <span style={{ fontSize: "10px", color: "#ef4444", fontWeight: 700 }}>!</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Detail panel ───────────────────────────────────── */}
      {selected && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          {/* Detail header */}
          <div
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid var(--border-subtle)",
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => setSelected(null)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "none",
                border: "none",
                color: "var(--text-tertiary)",
                cursor: "pointer",
                fontSize: "13px",
                padding: 0,
                marginBottom: "12px",
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%",
                  background: (AGENT_COLORS[selected.from_agent] || "#6b7280") + "20",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  flexShrink: 0,
                }}
              >
                {AGENT_EMOJI[selected.from_agent] || "📨"}
              </div>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", textTransform: "capitalize" }}>
                  {selected.from_agent}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
                  to {selected.to_agent} · {formatDate(selected.created_at)}
                </div>
              </div>
            </div>

            <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
              {selected.subject || "No subject"}
            </h2>

            {selected.priority === "high" && (
              <span
                style={{
                  display: "inline-block",
                  marginTop: "8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: "6px",
                  background: "#ef444420",
                  color: "#ef4444",
                }}
              >
                ⚡ High Priority
              </span>
            )}
          </div>

          {/* Message body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
            <div
              style={{
                fontSize: "15px",
                lineHeight: "1.7",
                color: "var(--text-primary)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {selected.message}
            </div>
          </div>

          {/* Reply section */}
          <div
            style={{
              borderTop: "1px solid var(--border-subtle)",
              padding: "16px 24px",
              flexShrink: 0,
            }}
          >
            {!replyOpen ? (
              <button
                onClick={() => setReplyOpen(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  background: "var(--accent-purple)",
                  color: "#fff",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <Send size={14} /> Reply
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply to ${selected.from_agent}…`}
                  style={{
                    width: "100%",
                    minHeight: "80px",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-subtle)",
                    background: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    fontSize: "14px",
                    lineHeight: "1.5",
                    resize: "vertical",
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                  autoFocus
                />
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={sendReply}
                    disabled={!replyText.trim() || sending}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 18px",
                      borderRadius: "8px",
                      background: replyText.trim() ? "var(--accent-purple)" : "var(--bg-elevated)",
                      color: replyText.trim() ? "#fff" : "var(--text-tertiary)",
                      border: "none",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: replyText.trim() ? "pointer" : "not-allowed",
                    }}
                  >
                    {sending ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
                    Send
                  </button>
                  <button
                    onClick={() => { setReplyOpen(false); setReplyText(""); }}
                    style={{
                      padding: "8px 18px",
                      borderRadius: "8px",
                      background: "var(--bg-elevated)",
                      color: "var(--text-secondary)",
                      border: "none",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @media (max-width: 767px) {
          /* On mobile, hide list when message is selected */
        }
      `}</style>
    </div>
  );
}
