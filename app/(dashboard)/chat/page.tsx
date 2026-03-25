"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw, X, Send, ArrowDown, Loader2, Paperclip, Menu, ChevronDown } from "lucide-react";

interface ChatMessage {
  id: number;
  message_id: number | null;
  direction: "inbound" | "outbound";
  sender_name: string | null;
  text: string | null;
  reply_to_message_id: number | null;
  reply_to_text: string | null;
  timestamp: string;
  image_url: string | null;
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function renderMarkdown(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    if (line.trim() === '---') return <hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.2)', margin: '4px 0' }} />;

    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;

    while (remaining) {
      const boldMatch = remaining.match(/^(.*?)\*\*(.*?)\*\*(.*)/s);
      const italicMatch = remaining.match(/^(.*?)\*(.*?)\*(.*)/s);
      const codeMatch = remaining.match(/^(.*?)`(.*?)`(.*)/s);

      // Find which pattern appears first
      const boldIdx = boldMatch ? remaining.indexOf('**') : Infinity;
      const codeIdx = codeMatch ? remaining.indexOf('`') : Infinity;
      const italicIdx = italicMatch ? remaining.indexOf('*') : Infinity;

      if (boldIdx !== Infinity && boldIdx <= codeIdx && boldIdx <= italicIdx) {
        if (boldMatch![1]) parts.push(<span key={key++}>{boldMatch![1]}</span>);
        parts.push(<strong key={key++}>{boldMatch![2]}</strong>);
        remaining = boldMatch![3];
      } else if (codeIdx !== Infinity && codeIdx <= italicIdx) {
        if (codeMatch![1]) parts.push(<span key={key++}>{codeMatch![1]}</span>);
        parts.push(<code key={key++} style={{ fontFamily: 'monospace', fontSize: '0.85em', background: 'rgba(0,0,0,0.2)', padding: '1px 4px', borderRadius: '3px' }}>{codeMatch![2]}</code>);
        remaining = codeMatch![3];
      } else if (italicIdx !== Infinity) {
        if (italicMatch![1]) parts.push(<span key={key++}>{italicMatch![1]}</span>);
        parts.push(<em key={key++}>{italicMatch![2]}</em>);
        remaining = italicMatch![3];
      } else {
        parts.push(<span key={key++}>{remaining}</span>);
        remaining = '';
      }
    }

    return <div key={i} style={{ minHeight: line ? 'auto' : '0.5em' }}>{parts}</div>;
  });
}

function formatDay(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

const IS_BIZ = process.env.NEXT_PUBLIC_INSTANCE === 'biz';
const BIZ_TABS = ['Douglas', 'Morris'] as const;

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'Douglas' | 'Morris'>('Douglas');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastMessageIdRef = useRef<number>(0);
  const userScrolledUpRef = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }, []);

  const fetchMessages = useCallback(async (initial = false) => {
    try {
      const res = await fetch("/api/chat");
      if (!res.ok) return;
      const data = (await res.json()) as { messages: ChatMessage[] };
      const newMessages = data.messages ?? [];

      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const incoming = newMessages.filter((m) => !existingIds.has(m.id));

        if (incoming.length === 0 && !initial) return prev;

        const merged = [...prev, ...incoming].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const newestId = merged[merged.length - 1]?.id ?? 0;
        const hadNew = newestId !== lastMessageIdRef.current;
        lastMessageIdRef.current = newestId;

        if (hadNew && !userScrolledUpRef.current) {
          setTimeout(() => scrollToBottom(), 50);
        } else if (hadNew && userScrolledUpRef.current) {
          setShowScrollButton(true);
        }

        return merged;
      });

      setLastRefreshed(new Date());
      if (initial) {
        setLoading(false);
        setTimeout(() => scrollToBottom(false), 80);
      }
    } catch (e) {
      console.error("fetchMessages error:", e);
      if (initial) setLoading(false);
    }
  }, [scrollToBottom]);

  useEffect(() => {
    fetchMessages(true);
  }, [fetchMessages]);

  useEffect(() => {
    pollIntervalRef.current = setInterval(() => fetchMessages(false), 3000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchMessages]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const onScroll = () => {
      const near = isNearBottom();
      userScrolledUpRef.current = !near;
      if (near) setShowScrollButton(false);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [isNearBottom]);

  // --- Image helpers ---
  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImagePreview(result);
    };
    reader.readAsDataURL(file);
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          handleImageFile(file);
          return;
        }
      }
    }
  }, [handleImageFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const hasFiles = Array.from(e.dataTransfer.types).includes("Files");
    if (hasFiles) setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleImageFile(files[0]);
    }
  }, [handleImageFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
    e.target.value = "";
  }, [handleImageFile]);

  const sendMessage = async () => {
    const text = inputText.trim();
    if ((!text && !imagePreview) || sending) return;

    setSending(true);
    setInputText("");
    const replyToMessageId = replyTarget?.message_id ?? null;
    setReplyTarget(null);
    const currentImagePreview = imagePreview;
    setImagePreview(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text || undefined,
          replyToMessageId: replyToMessageId ?? undefined,
          imageUrl: currentImagePreview ?? undefined,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { message: ChatMessage };
        const newMsg = data.message;
        setMessages((prev) => {
          if (prev.find((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        lastMessageIdRef.current = newMsg.id;
        setTimeout(() => scrollToBottom(), 50);
      }
    } catch (e) {
      console.error("send error:", e);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleScrollToBottom = () => {
    userScrolledUpRef.current = false;
    setShowScrollButton(false);
    scrollToBottom();
  };

  const canSend = !sending && !!(inputText.trim() || imagePreview);

  // Filter messages by active tab on biz instance
  const visibleMessages = IS_BIZ
    ? messages.filter((m) => {
        if (m.direction === "outbound") return activeTab === "Douglas"; // agent replies — show in Douglas tab for now
        return m.sender_name === activeTab;
      })
    : messages;

  // Group messages by day for date separators
  const groups: { date: string; messages: ChatMessage[] }[] = [];
  for (const msg of visibleMessages) {
    const day = new Date(msg.timestamp).toDateString();
    if (groups.length === 0 || groups[groups.length - 1].date !== day) {
      groups.push({ date: day, messages: [msg] });
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--bg-primary)",
        overflow: "hidden",
        position: "relative",
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Drag overlay */}
      {isDragOver && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 100,
            background: "rgba(139,92,246,0.12)",
            border: "3px dashed var(--accent-purple)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span style={{ color: "var(--accent-purple)", fontSize: "18px", fontWeight: 600 }}>
            📎 Drop image to attach
          </span>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────── */}
      <style>{`
        .chat-mobile-menu-btn { display: none; }
        @media (max-width: 767px) {
          .chat-mobile-menu-btn { display: flex !important; }
        }
      `}</style>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Mobile hamburger menu — only visible on mobile where layout topbar is hidden */}
          <button
            className="chat-mobile-menu-btn"
            onClick={() => window.dispatchEvent(new Event("open-mobile-menu"))}
            aria-label="Open menu"
            style={{
              display: "none",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "transparent",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Menu size={18} />
          </button>

          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "var(--accent-purple)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              flexShrink: 0,
              position: "relative",
            }}
          >
            🤙
            <span
              style={{
                position: "absolute",
                bottom: "1px",
                right: "1px",
                width: "11px",
                height: "11px",
                borderRadius: "50%",
                background: "#22c55e",
                border: "2px solid var(--bg-secondary)",
              }}
            />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "15px", color: "var(--text-primary)" }}>
              {IS_BIZ ? activeTab : "Douglas"}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
              {lastRefreshed
                ? `Synced ${lastRefreshed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                : "Syncing…"}
            </div>
          </div>
        </div>

        <button
          onClick={() => fetchMessages(false)}
          title="Refresh"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            background: "transparent",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* ── Biz tab switcher ────────────────────────────────────── */}
      {IS_BIZ && (
        <div style={{ display: "flex", padding: "10px 20px 0", gap: "8px", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "10px" }}>
          {BIZ_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "6px 20px",
                fontSize: "13px",
                fontWeight: activeTab === tab ? 600 : 500,
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                background: activeTab === tab ? "#3b82f6" : "var(--bg-elevated)",
                color: activeTab === tab ? "#fff" : "var(--text-secondary)",
                transition: "all 0.15s",
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* ── Messages area ─────────────────────────────────────── */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          scrollBehavior: "smooth",
        }}
      >
        {loading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              color: "var(--text-tertiary)",
              gap: "8px",
            }}
          >
            <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
            Loading conversation…
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              color: "var(--text-tertiary)",
              fontSize: "14px",
            }}
          >
            No messages yet. Say hi! 👋
          </div>
        )}

        {groups.map((group) => (
          <div key={group.date}>
            {/* Day separator */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                margin: "16px 0 12px",
              }}
            >
              <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-tertiary)",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {formatDay(group.messages[0].timestamp)}
              </span>
              <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
            </div>

            {group.messages.map((msg) => {
              // "outbound" here means right-side (user bubble) — Douglas or Morris inbound messages
              const outbound = msg.direction === "inbound" ||
                msg.sender_name === "Douglas" ||
                msg.sender_name === "Morris";
              return (
                <div
                  key={msg.id}
                  onClick={() => setReplyTarget(msg)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: outbound ? "flex-end" : "flex-start",
                    marginBottom: "6px",
                    cursor: "pointer",
                  }}
                >
                  {/* Sender name */}
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--text-tertiary)",
                      marginBottom: "3px",
                      paddingLeft: outbound ? 0 : "4px",
                      paddingRight: outbound ? "4px" : 0,
                    }}
                  >
                    {msg.sender_name ?? (outbound ? "Douglas" : "Mr. Shmack")}
                  </div>

                  {/* Bubble */}
                  <div
                    style={{
                      maxWidth: "75%",
                      borderRadius: outbound ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                      background: outbound ? "var(--accent-purple)" : "var(--bg-elevated)",
                      color: outbound ? "#fff" : "var(--text-primary)",
                      padding: msg.image_url ? "4px" : "10px 14px",
                      wordBreak: "break-word",
                      fontSize: "15px",
                      lineHeight: "1.45",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                      overflow: "hidden",
                    }}
                  >
                    {/* Reply preview */}
                    {msg.reply_to_text && (
                      <div
                        style={{
                          borderLeft: outbound
                            ? "3px solid rgba(255,255,255,0.5)"
                            : "3px solid var(--accent-purple)",
                          paddingLeft: "8px",
                          marginBottom: "6px",
                          marginLeft: msg.image_url ? "6px" : undefined,
                          marginRight: msg.image_url ? "6px" : undefined,
                          marginTop: msg.image_url ? "4px" : undefined,
                          fontSize: "12px",
                          color: outbound ? "rgba(255,255,255,0.75)" : "var(--text-tertiary)",
                          maxHeight: "40px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {msg.reply_to_text}
                      </div>
                    )}

                    {/* Image */}
                    {msg.image_url && (
                      <img
                        src={msg.image_url}
                        alt="Attached image"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxSrc(msg.image_url);
                        }}
                        style={{
                          display: "block",
                          maxWidth: "100%",
                          width: "100%",
                          borderRadius: "14px",
                          cursor: "pointer",
                          objectFit: "contain",
                        }}
                      />
                    )}

                    {/* Text */}
                    {msg.text && (
                      <div style={{
                        padding: msg.image_url ? "6px 10px 4px" : undefined,
                      }}>
                        {renderMarkdown(msg.text)}
                      </div>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      marginTop: "2px",
                      paddingLeft: outbound ? 0 : "4px",
                      paddingRight: outbound ? "4px" : 0,
                    }}
                  >
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Scroll-to-bottom button ───────────────────────────── */}
      {showScrollButton && (
        <div
          style={{
            position: "absolute",
            bottom: replyTarget ? "148px" : "92px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
          }}
        >
          <button
            onClick={handleScrollToBottom}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              borderRadius: "20px",
              background: "var(--accent-purple)",
              color: "#fff",
              border: "none",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              whiteSpace: "nowrap",
            }}
          >
            <ArrowDown size={14} />
            New message
          </button>
        </div>
      )}

      {/* ── Reply quote bar ───────────────────────────────────── */}
      {replyTarget && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "10px 16px",
            background: "var(--bg-secondary)",
            borderTop: "1px solid var(--border-subtle)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              flex: 1,
              borderLeft: "3px solid var(--accent-purple)",
              paddingLeft: "10px",
              overflow: "hidden",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--accent-purple)", fontWeight: 600, marginBottom: "2px" }}>
              Replying to {replyTarget.sender_name ?? (replyTarget.direction === "outbound" ? "Mr. Shmack" : "Douglas")}
            </div>
            <div
              style={{
                fontSize: "13px",
                color: "var(--text-secondary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {replyTarget.text ?? ""}
            </div>
          </div>
          <button
            onClick={() => setReplyTarget(null)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "var(--bg-hover)",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Image preview strip ───────────────────────────────── */}
      {imagePreview && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "10px 16px",
            background: "var(--bg-secondary)",
            borderTop: "1px solid var(--border-subtle)",
            flexShrink: 0,
          }}
        >
          <div style={{ position: "relative", flexShrink: 0 }}>
            <img
              src={imagePreview}
              alt="Preview"
              style={{
                width: "60px",
                height: "60px",
                objectFit: "cover",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
              }}
            />
            <button
              onClick={() => setImagePreview(null)}
              style={{
                position: "absolute",
                top: "-8px",
                right: "-8px",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: "#ef4444",
                border: "2px solid var(--bg-secondary)",
                color: "#fff",
                fontSize: "10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
            >
              <X size={10} />
            </button>
          </div>
          <div>
            <div style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 500 }}>
              Image attached
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
              Add a caption below (optional)
            </div>
          </div>
        </div>
      )}

      {/* ── Input bar ─────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "10px",
          padding: "12px 16px",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          background: "var(--bg-secondary)",
          borderTop: (replyTarget || imagePreview) ? "none" : "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        {/* Attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          title="Attach image"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            background: imagePreview ? "#3b82f620" : "var(--bg-elevated)",
            border: imagePreview ? "1px solid #3b82f6" : "1px solid var(--border-subtle)",
            color: imagePreview ? "#3b82f6" : "var(--text-tertiary)",
            cursor: sending ? "not-allowed" : "pointer",
            flexShrink: 0,
            transition: "all 0.15s",
          }}
        >
          <Paperclip size={18} />
        </button>

        <textarea
          ref={inputRef}
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={imagePreview ? "Add a caption…" : "Message Douglas…"}
          disabled={sending}
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            background: "var(--bg-primary)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "20px",
            padding: "10px 16px",
            color: "var(--text-primary)",
            fontSize: "15px",
            lineHeight: "1.45",
            outline: "none",
            minHeight: "44px",
            maxHeight: "120px",
            overflowY: "auto",
            fontFamily: "inherit",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!canSend}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            background: canSend ? "var(--accent-purple)" : "var(--bg-elevated)",
            border: "none",
            color: canSend ? "#fff" : "var(--text-tertiary)",
            cursor: canSend ? "pointer" : "not-allowed",
            flexShrink: 0,
            transition: "background 0.15s, color 0.15s",
          }}
        >
          {sending ? (
            <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          onClick={() => setLightboxSrc(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          <button
            onClick={() => setLightboxSrc(null)}
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              zIndex: 10001,
            }}
          >
            <X size={20} />
          </button>
          <img
            src={lightboxSrc}
            alt="Full size"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "92vw",
              maxHeight: "92vh",
              objectFit: "contain",
              borderRadius: "10px",
              cursor: "default",
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
