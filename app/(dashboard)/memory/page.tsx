"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Brain,
  Calendar,
  Clock,
  Search,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  FileText,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DateEntry {
  date: string;
  size: number;
  wordCount: number;
  lastModified: string;
}

interface ApiListResponse {
  dates: DateEntry[];
  longTermMemory: string;
  longTermSize: number;
  longTermWordCount: number;
  longTermLastModified: string;
}

interface ApiDetailResponse {
  date?: string;
  content: string | null;
  size: number;
  wordCount: number;
  lastModified: string;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);

function formatDateLabel(d: string) {
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function fullDateLabel(d: string) {
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function daysAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  return `${diff} days ago`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function groupDates(dates: DateEntry[]): Record<string, DateEntry[]> {
  const groups: Record<string, DateEntry[]> = {};
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  for (const entry of dates) {
    const d = new Date(entry.date + "T12:00:00");
    let group: string;

    if (entry.date === todayStr) {
      group = "Today";
    } else if (entry.date === yesterdayStr) {
      group = "Yesterday";
    } else if (d >= weekAgo) {
      group = "This Week";
    } else if (d >= monthStart) {
      group = "This Month";
    } else {
      group = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }

    if (!groups[group]) groups[group] = [];
    groups[group].push(entry);
  }

  return groups;
}

const GROUP_ORDER = ["Today", "Yesterday", "This Week", "This Month"];

function sortedGroupKeys(groups: Record<string, DateEntry[]>): string[] {
  const fixed = GROUP_ORDER.filter((k) => groups[k]);
  const monthly = Object.keys(groups)
    .filter((k) => !GROUP_ORDER.includes(k))
    .sort((a, b) => {
      // Sort month+year descending
      const da = new Date(groups[a][0].date + "T12:00:00");
      const db = new Date(groups[b][0].date + "T12:00:00");
      return db.getTime() - da.getTime();
    });
  return [...fixed, ...monthly];
}

// ─── Markdown Parser ──────────────────────────────────────────────────────────

interface ParsedBlock {
  type: "timestamp-header" | "field" | "h1" | "h3" | "paragraph" | "list-item" | "hr" | "blank";
  time?: string;
  title?: string;
  fieldName?: string;
  fieldValue?: string;
  text?: string;
  raw?: string;
}

function parseMemoryMarkdown(md: string): ParsedBlock[] {
  const lines = md.split("\n");
  const blocks: ParsedBlock[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // H1
    if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: line.slice(2) });
      continue;
    }

    // H2 — check if it matches "HH:MM AM/PM — Title"
    if (line.startsWith("## ")) {
      const rest = line.slice(3);
      const tsMatch = rest.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[—–-]+\s*(.+)$/i);
      if (tsMatch) {
        blocks.push({ type: "timestamp-header", time: tsMatch[1], title: tsMatch[2] });
      } else {
        blocks.push({ type: "h3", text: rest });
      }
      continue;
    }

    // H3
    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4) });
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/)) {
      blocks.push({ type: "hr" });
      continue;
    }

    // Bold field line: **Field:** value
    const fieldMatch = line.match(/^\*\*([^*]+):\*\*\s*(.*)/);
    if (fieldMatch) {
      blocks.push({ type: "field", fieldName: fieldMatch[1], fieldValue: fieldMatch[2] });
      continue;
    }

    // List item
    if (line.match(/^[-*]\s+/)) {
      blocks.push({ type: "list-item", text: line.replace(/^[-*]\s+/, "") });
      continue;
    }

    // Blank
    if (line.trim() === "") {
      blocks.push({ type: "blank" });
      continue;
    }

    // Paragraph
    blocks.push({ type: "paragraph", text: line });
  }

  return blocks;
}

function renderInline(text: string): React.ReactNode {
  // Handle **bold** inline
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} style={{ color: "#e2e8f0", fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function MemoryContent({ content, title }: { content: string; title: string }) {
  const blocks = useMemo(() => parseMemoryMarkdown(content), [content]);

  return (
    <div style={{ fontFamily: "inherit" }}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h1":
            return null; // We render the title in the header

          case "timestamp-header":
            return (
              <div
                key={i}
                className="flex items-center gap-2 mt-8 mb-3"
                style={{ borderBottom: "1px solid rgba(77,184,200,0.2)", paddingBottom: "8px" }}
              >
                <Clock size={14} style={{ color: "#4db8c8", flexShrink: 0 }} />
                <span style={{ color: "#4db8c8", fontWeight: 600, fontSize: "0.85rem", letterSpacing: "0.01em" }}>
                  {block.time}
                </span>
                <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>—</span>
                <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "0.9rem" }}>{block.title}</span>
              </div>
            );

          case "field":
            return (
              <div key={i} className="flex gap-2 mb-2" style={{ fontSize: "0.875rem", lineHeight: "1.6" }}>
                <span style={{ color: "#94a3b8", fontWeight: 600, flexShrink: 0, minWidth: "90px" }}>
                  {block.fieldName}:
                </span>
                <span style={{ color: "#cbd5e1" }}>{renderInline(block.fieldValue || "")}</span>
              </div>
            );

          case "h3":
            return (
              <div
                key={i}
                className="mt-6 mb-2"
                style={{ color: "#a78bfa", fontWeight: 600, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}
              >
                {block.text}
              </div>
            );

          case "hr":
            return (
              <hr key={i} style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.06)", margin: "24px 0" }} />
            );

          case "list-item":
            return (
              <div key={i} className="flex gap-2 mb-1" style={{ fontSize: "0.875rem", color: "#94a3b8", paddingLeft: "4px" }}>
                <span style={{ color: "#4db8c8", flexShrink: 0 }}>·</span>
                <span>{renderInline(block.text || "")}</span>
              </div>
            );

          case "blank":
            return <div key={i} style={{ height: "6px" }} />;

          case "paragraph":
            return (
              <p key={i} style={{ fontSize: "0.875rem", color: "#94a3b8", lineHeight: "1.7", marginBottom: "8px" }}>
                {renderInline(block.text || "")}
              </p>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Selected = { type: "date"; date: string } | { type: "longterm" };

export default function MemoryPage() {
  const [entries, setEntries] = useState<DateEntry[]>([]);
  const [longTerm, setLongTerm] = useState({ content: "", size: 0, wordCount: 0, lastModified: "" });
  const [selected, setSelected] = useState<Selected>({ type: "longterm" });
  const [detail, setDetail] = useState<ApiDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(["This Month"]));
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    fetch("/api/memory")
      .then((r) => r.json())
      .then((data: ApiListResponse) => {
        setEntries(data.dates || []);
        setLongTerm({
          content: data.longTermMemory || "",
          size: data.longTermSize || 0,
          wordCount: data.longTermWordCount || 0,
          lastModified: data.longTermLastModified || "",
        });
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (selected.type === "date") {
      setDetailLoading(true);
      fetch(`/api/memory?date=${selected.date}`)
        .then((r) => r.json())
        .then((data: ApiDetailResponse) => {
          setDetail(data);
          setDetailLoading(false);
        });
    } else {
      setDetail(null);
    }
  }, [selected]);

  const filteredEntries = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter((e) => e.date.includes(q) || formatDateLabel(e.date).toLowerCase().includes(q));
  }, [entries, search]);

  const groups = useMemo(() => groupDates(filteredEntries), [filteredEntries]);
  const groupKeys = useMemo(() => sortedGroupKeys(groups), [groups]);

  function toggleCollapse(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const isSelected = (d: string) => selected.type === "date" && selected.date === d;
  const isLongTermSelected = selected.type === "longterm";

  // Content for right panel
  let contentTitle = "";
  let contentSubtitle = "";
  let contentMeta = "";
  let contentBody = "";
  let contentModified = "";
  let contentSize = 0;
  let contentWords = 0;

  if (selected.type === "longterm") {
    contentTitle = "Long-Term Memory";
    contentSubtitle = "MEMORY.md";
    contentSize = longTerm.size;
    contentWords = longTerm.wordCount;
    contentModified = longTerm.lastModified;
    contentBody = longTerm.content;
  } else if (detail) {
    contentTitle = `Journal: ${selected.date}`;
    contentSubtitle = fullDateLabel(selected.date);
    contentSize = detail.size;
    contentWords = detail.wordCount;
    contentModified = detail.lastModified;
    contentBody = detail.content || "";
  }

  // On mobile: if something is selected, show content; else show list
  const mobileShowContent = isMobile && (selected.type === "longterm" || selected.type === "date");
  // Track whether user has explicitly selected something on mobile
  const [mobileViewingContent, setMobileViewingContent] = useState(false);

  function selectEntry(s: Selected) {
    setSelected(s);
    if (isMobile) setMobileViewingContent(true);
  }

  return (
    <div
      className="flex h-full overflow-hidden"
      style={{ background: "#0d0d0d", fontFamily: "Inter, system-ui, sans-serif", flexDirection: isMobile ? "column" : "row" }}
    >
      {/* Middle Column: Date List */}
      {(!isMobile || !mobileViewingContent) && (
      <div
        style={{
          width: isMobile ? "100%" : "250px",
          flexShrink: 0,
          borderRight: isMobile ? "none" : "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "#111111",
          flex: isMobile ? 1 : undefined,
        }}
      >
        {/* Search */}
        <div style={{ padding: "14px 12px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "6px",
              padding: "6px 10px",
            }}
          >
            <Search size={12} style={{ color: "#64748b", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search memory..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: "none",
                border: "none",
                outline: "none",
                color: "#e2e8f0",
                fontSize: "0.78rem",
                width: "100%",
              }}
            />
          </div>
        </div>

        <div className="fab-scroll-pad" style={{ flex: 1, overflowY: "auto", padding: "10px 8px 16px" }}>
          {/* Long-Term Memory Card */}
          <button
            onClick={() => selectEntry({ type: "longterm" })}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 10px",
              borderRadius: "7px",
              border: isLongTermSelected ? "1px solid rgba(139,92,246,0.4)" : "1px solid rgba(255,255,255,0.06)",
              background: isLongTermSelected ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.02)",
              cursor: "pointer",
              marginBottom: "16px",
              textAlign: "left",
              borderLeft: isLongTermSelected ? "3px solid #8b5cf6" : "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Brain size={16} color="white" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "#e2e8f0", fontSize: "0.8rem", fontWeight: 600, marginBottom: "2px" }}>
                Long-Term Memory
              </div>
              <div style={{ color: "#64748b", fontSize: "0.7rem" }}>
                {longTerm.wordCount > 0 ? `${longTerm.wordCount.toLocaleString()} words` : "MEMORY.md"}
                {longTerm.lastModified ? ` · ${daysAgo(longTerm.lastModified)}` : ""}
              </div>
            </div>
          </button>

          {/* Daily Journal section */}
          <div style={{ marginBottom: "8px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "0 4px",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  color: "#475569",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Daily Journal
              </span>
              <span
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "#64748b",
                  fontSize: "0.62rem",
                  fontWeight: 600,
                  padding: "1px 6px",
                  borderRadius: "10px",
                }}
              >
                {entries.length}
              </span>
            </div>

            {loading && (
              <div style={{ display: "flex", justifyContent: "center", padding: "16px" }}>
                <RefreshCw size={14} style={{ color: "#475569", animation: "spin 1s linear infinite" }} />
              </div>
            )}

            {!loading && groupKeys.map((groupKey) => {
              const groupEntries = groups[groupKey];
              const isCollapsed = collapsed.has(groupKey);
              const isFixedGroup = GROUP_ORDER.includes(groupKey);

              return (
                <div key={groupKey} style={{ marginBottom: "4px" }}>
                  {/* Group header */}
                  <button
                    onClick={() => !isFixedGroup && toggleCollapse(groupKey)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "4px 4px",
                      background: "none",
                      border: "none",
                      cursor: isFixedGroup ? "default" : "pointer",
                      marginBottom: "2px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ color: "#475569", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.05em" }}>
                        {groupKey}
                      </span>
                      <span style={{ color: "#334155", fontSize: "0.62rem" }}>
                        ({groupEntries.length})
                      </span>
                    </div>
                    {!isFixedGroup && (
                      isCollapsed
                        ? <ChevronRight size={11} style={{ color: "#475569" }} />
                        : <ChevronDown size={11} style={{ color: "#475569" }} />
                    )}
                  </button>

                  {/* Group entries */}
                  {!isCollapsed && groupEntries.map((entry) => (
                    <button
                      key={entry.date}
                      onClick={() => selectEntry({ type: "date", date: entry.date })}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "none",
                        borderLeft: isSelected(entry.date) ? "2px solid #8b5cf6" : "2px solid transparent",
                        background: isSelected(entry.date) ? "rgba(139,92,246,0.1)" : "transparent",
                        cursor: "pointer",
                        marginBottom: "1px",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            color: isSelected(entry.date) ? "#e2e8f0" : "#94a3b8",
                            fontSize: "0.8rem",
                            fontWeight: isSelected(entry.date) ? 600 : 400,
                            marginBottom: "2px",
                          }}
                        >
                          {entry.date === TODAY ? "Today" : formatDateLabel(entry.date)}
                        </div>
                        <div style={{ color: "#475569", fontSize: "0.68rem" }}>
                          {formatSize(entry.size)} · {entry.wordCount.toLocaleString()} words
                        </div>
                      </div>
                      {entry.date === TODAY && (
                        <span
                          style={{
                            background: "rgba(139,92,246,0.2)",
                            color: "#a78bfa",
                            fontSize: "0.6rem",
                            fontWeight: 700,
                            padding: "2px 5px",
                            borderRadius: "4px",
                            flexShrink: 0,
                          }}
                        >
                          TODAY
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      )} {/* end left panel conditional */}

      {/* Right Column: Content */}
      {(!isMobile || mobileViewingContent) && (
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {contentBody || selected.type === "longterm" ? (
          <>
            {/* Content Header */}
            <div
              style={{
                padding: isMobile ? "14px 16px 12px" : "20px 28px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: "#111111",
                flexShrink: 0,
              }}
            >
              {/* Mobile back button */}
              {isMobile && (
                <button onClick={() => setMobileViewingContent(false)}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#8b5cf6", fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "0 0 10px 0", marginLeft: -2 }}>
                  ← Back to Memory
                </button>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                {selected.type === "longterm" ? (
                  <Brain size={18} style={{ color: "#8b5cf6" }} />
                ) : (
                  <Calendar size={18} style={{ color: "#4db8c8" }} />
                )}
                <h1 style={{ color: "#f1f5f9", fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
                  {contentTitle}
                </h1>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", paddingLeft: "28px" }}>
                <span style={{ color: "#64748b", fontSize: "0.78rem" }}>{contentSubtitle}</span>
                {contentSize > 0 && (
                  <>
                    <span style={{ color: "#1e293b" }}>·</span>
                    <span style={{ color: "#475569", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "4px" }}>
                      <FileText size={11} />
                      {formatSize(contentSize)}
                    </span>
                    <span style={{ color: "#475569", fontSize: "0.75rem" }}>
                      {contentWords.toLocaleString()} words
                    </span>
                    {contentModified && (
                      <>
                        <span style={{ color: "#1e293b" }}>·</span>
                        <span style={{ color: "#475569", fontSize: "0.75rem" }}>
                          Modified {daysAgo(contentModified)}
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Content Body */}
            <div style={{ flex: 1, padding: "24px 28px 48px" }}>
              {detailLoading ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#475569" }}>
                  <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
                  <span style={{ fontSize: "0.875rem" }}>Loading...</span>
                </div>
              ) : contentBody ? (
                <MemoryContent content={contentBody} title={contentTitle} />
              ) : (
                <p style={{ color: "#475569", fontSize: "0.875rem" }}>No content found.</p>
              )}
            </div>
          </>
        ) : (
          /* Empty state */
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#334155",
            }}
          >
            <Calendar size={36} style={{ marginBottom: "12px", opacity: 0.4 }} />
            <p style={{ fontSize: "0.875rem", margin: 0 }}>Select a date to view journal</p>
          </div>
        )}
      </div>
      )} {/* end right panel conditional */}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
        input::placeholder { color: #475569; }
      `}</style>
    </div>
  );
}
