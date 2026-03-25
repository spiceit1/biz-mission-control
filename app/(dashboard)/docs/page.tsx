"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Files,
  Search,
  Copy,
  Check,
  Loader2,
  FileText,
  RefreshCw,
  Plus,
  X,
  Save,
  ChevronLeft,
} from "lucide-react";

interface DocMeta {
  id: string;
  title: string;
  path: string;
  category: string;
  size: number;
  wordCount: number;
  lastModified: string;
  preview: string;
  tags?: string[];
  date?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getExtension(path: string): string {
  const parts = path.split(".");
  if (parts.length < 2) return "";
  return "." + parts[parts.length - 1].toLowerCase();
}

function getFilename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

const CATEGORY_PALETTE = [
  { bg: "#7c5cfc22", text: "#a78bfa" },
  { bg: "#4d7cfe22", text: "#4d7cfe" },
  { bg: "#26c97a22", text: "#26c97a" },
  { bg: "#f0b42922", text: "#f0b429" },
  { bg: "#f05b5b22", text: "#f05b5b" },
  { bg: "#e879f922", text: "#e879f9" },
  { bg: "#06b6d422", text: "#06b6d4" },
  { bg: "#fb923c22", text: "#fb923c" },
  { bg: "#a3e63522", text: "#a3e635" },
  { bg: "#f472b622", text: "#f472b6" },
];

function getCategoryColor(category: string, allCategories: string[]): { bg: string; text: string } {
  const idx = allCategories.indexOf(category);
  if (idx >= 0) return CATEGORY_PALETTE[idx % CATEGORY_PALETTE.length];
  return { bg: "#6b6b7522", text: "#9898a0" };
}

function CategoryBadge({ category, allCategories }: { category: string; allCategories: string[] }) {
  const colors = getCategoryColor(category, allCategories);
  return (
    <span
      style={{
        background: colors.bg,
        color: colors.text,
        fontSize: 10,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 4,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        whiteSpace: "nowrap",
      }}
    >
      {category}
    </span>
  );
}

// ─── New Doc Form ─────────────────────────────────────────────────────────────

interface NewDocFormProps {
  onClose: () => void;
  onSaved: () => void;
  categories: string[];
}

function NewDocForm({ onClose, onSaved, categories }: NewDocFormProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(categories[0] || "Other");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category,
          content: content.trim(),
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Save failed");
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save document");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          width: "100%",
          maxWidth: 600,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileText size={16} style={{ color: "var(--accent-purple)" }} />
            <span style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 600 }}>New Document</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
            <div>
              <label style={{ display: "block", color: "var(--text-tertiary)", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Title *</label>
              <input type="text" placeholder="e.g. NFL ROI Analysis Q1 2026" value={title} onChange={(e) => setTitle(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", background: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)", borderRadius: 7, color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                autoFocus />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", color: "var(--text-tertiary)", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", background: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)", borderRadius: 7, color: "var(--text-primary)", fontSize: 13, outline: "none", cursor: "pointer" }}>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-tertiary)", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tags <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(comma-separated)</span></label>
                <input type="text" placeholder="e.g. nfl, roi, q1" value={tags} onChange={(e) => setTags(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", background: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)", borderRadius: 7, color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", color: "var(--text-tertiary)", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Content <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(Markdown)</span></label>
              <textarea placeholder="Write your document content here..." value={content} onChange={(e) => setContent(e.target.value)} rows={10}
                style={{ width: "100%", padding: "10px 12px", background: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)", borderRadius: 7, color: "var(--text-primary)", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.6, boxSizing: "border-box", minHeight: 200 }} />
            </div>
            {error && <p style={{ color: "#f05b5b", fontSize: 12, margin: 0 }}>{error}</p>}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: "1px solid var(--border-subtle)" }}>
            <button type="button" onClick={onClose} style={{ padding: "7px 14px", background: "transparent", border: "1px solid var(--border-subtle)", borderRadius: 7, color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", background: "var(--accent-purple)", border: "none", borderRadius: 7, color: "white", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {saving ? "Saving..." : "Save Document"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function MarkdownRenderer({ content }: { content: string }) {
  let body = content;
  if (content.startsWith("---")) {
    const endIdx = content.indexOf("\n---", 3);
    if (endIdx !== -1) body = content.slice(endIdx + 4).trimStart();
  }

  const lines = body.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) { codeLines.push(lines[i]); i++; }
      elements.push(
        <div key={`code-${i}`} style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "12px 16px", margin: "12px 0", overflowX: "auto" }}>
          {lang && <div style={{ color: "var(--text-muted)", fontSize: 10, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>{lang}</div>}
          <pre style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "var(--text-secondary)", margin: 0, whiteSpace: "pre-wrap" }}>{codeLines.join("\n")}</pre>
        </div>
      );
      i++; continue;
    }

    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) { quoteLines.push(lines[i].slice(2)); i++; }
      elements.push(
        <blockquote key={`bq-${i}`} style={{ borderLeft: "3px solid var(--accent-purple)", paddingLeft: 16, margin: "12px 0", color: "var(--text-secondary)", fontStyle: "italic" }}>
          {quoteLines.map((ql, qi) => <p key={qi} style={{ fontSize: 13, lineHeight: 1.7, margin: "4px 0" }}>{renderInline(ql)}</p>)}
        </blockquote>
      );
      continue;
    }

    if (line.startsWith("# ")) { elements.push(<h1 key={i} style={{ color: "var(--text-primary)", fontSize: 22, fontWeight: 700, margin: "0 0 16px", lineHeight: 1.3 }}>{renderInline(line.slice(2))}</h1>); }
    else if (line.startsWith("## ")) { elements.push(<h2 key={i} style={{ color: "var(--accent-purple)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: "28px 0 10px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 6 }}>{renderInline(line.slice(3))}</h2>); }
    else if (line.startsWith("### ")) { elements.push(<h3 key={i} style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 600, margin: "18px 0 8px" }}>{renderInline(line.slice(4))}</h3>); }
    else if (line.startsWith("#### ")) { elements.push(<h4 key={i} style={{ color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, margin: "14px 0 6px" }}>{renderInline(line.slice(5))}</h4>); }
    else if (line.startsWith("---") || line.startsWith("***")) { elements.push(<hr key={i} style={{ border: "none", borderTop: "1px solid var(--border-subtle)", margin: "20px 0" }} />); }
    else if (line.match(/^[-*+] /)) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*+] /)) { listItems.push(lines[i].slice(2)); i++; }
      elements.push(<ul key={`ul-${i}`} style={{ margin: "8px 0", paddingLeft: 20 }}>{listItems.map((item, j) => <li key={j} style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7, marginBottom: 3 }}>{renderInline(item)}</li>)}</ul>);
      continue;
    } else if (line.match(/^\d+\. /)) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) { listItems.push(lines[i].replace(/^\d+\. /, "")); i++; }
      elements.push(<ol key={`ol-${i}`} style={{ margin: "8px 0", paddingLeft: 20 }}>{listItems.map((item, j) => <li key={j} style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7, marginBottom: 3 }}>{renderInline(item)}</li>)}</ol>);
      continue;
    } else if (line.match(/^\|.+\|/)) {
      const tableRows: string[] = [];
      while (i < lines.length && lines[i].match(/^\|.+\|/)) { tableRows.push(lines[i]); i++; }
      const headers = tableRows[0].split("|").filter(Boolean).map((h) => h.trim());
      const dataRows = tableRows.slice(2);
      elements.push(
        <div key={`table-${i}`} style={{ overflowX: "auto", margin: "12px 0" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
            <thead><tr>{headers.map((h, j) => <th key={j} style={{ padding: "6px 12px", background: "var(--bg-tertiary)", color: "var(--text-secondary)", fontWeight: 600, textAlign: "left", borderBottom: "1px solid var(--border-subtle)", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
            <tbody>{dataRows.map((row, ri) => { const cells = row.split("|").filter(Boolean).map((c) => c.trim()); return <tr key={ri} style={{ borderBottom: "1px solid var(--border-subtle)" }}>{cells.map((cell, ci) => <td key={ci} style={{ padding: "6px 12px", color: "var(--text-secondary)" }}>{renderInline(cell)}</td>)}</tr>; })}</tbody>
          </table>
        </div>
      );
      continue;
    } else if (line === "") { elements.push(<div key={i} style={{ height: 8 }} />); }
    else { elements.push(<p key={i} style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.8, margin: "4px 0" }}>{renderInline(line)}</p>); }

    i++;
  }

  return <div>{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\[.*?\]\(.*?\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    const linkMatch = part.match(/^\[(.+?)\]\((.+?)\)$/);
    if (linkMatch) return <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-blue)", textDecoration: "none" }}>{linkMatch[1]}</a>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.85em", background: "var(--bg-elevated)", color: "#26c97a", padding: "1px 5px", borderRadius: 4 }}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} style={{ color: "var(--text-primary)", fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) return <em key={i} style={{ color: "var(--text-secondary)" }}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function FilterPill({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick} style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: active ? (color || "var(--accent-purple)") : "var(--bg-tertiary)", color: active ? "white" : "var(--text-tertiary)", border: active ? `1px solid ${color || "var(--accent-purple)"}` : "1px solid var(--border-subtle)", cursor: "pointer", whiteSpace: "nowrap", lineHeight: "18px" }}>
      {label}
    </button>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [extFilter, setExtFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<DocMeta | null>(null);
  const [docContent, setDocContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/docs");
      const json = await res.json();
      const all: DocMeta[] = json.docs || [];
      all.sort((a, b) => {
        const da = a.date || a.lastModified || "";
        const db = b.date || b.lastModified || "";
        return db.localeCompare(da);
      });
      setDocs(all);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    docs.forEach((d) => { if (d.category) cats.add(d.category); });
    return Array.from(cats).sort();
  }, [docs]);

  const allExtensions = useMemo(() => {
    const exts = new Set<string>();
    docs.forEach((d) => { const ext = getExtension(d.path); if (ext) exts.add(ext); });
    return Array.from(exts).sort();
  }, [docs]);

  async function selectDoc(doc: DocMeta) {
    setSelectedDoc(doc);
    setDocContent(null);
    setContentLoading(true);
    try {
      const res = await fetch(`/api/docs?path=${encodeURIComponent(doc.path)}`);
      const json = await res.json();
      setDocContent(json.content || "");
    } catch {
      setDocContent("Failed to load document.");
    } finally {
      setContentLoading(false);
    }
  }

  async function handleCopy() {
    if (!docContent) return;
    await navigator.clipboard.writeText(docContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const filtered = useMemo(() => {
    return docs.filter((doc) => {
      if (categoryFilter && doc.category !== categoryFilter) return false;
      if (extFilter && getExtension(doc.path) !== extFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const title = doc.title.toLowerCase();
        const filename = getFilename(doc.path).toLowerCase();
        if (!title.includes(q) && !filename.includes(q) && !(doc.preview || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [docs, categoryFilter, extFilter, search]);

  // ─── Mobile: if a doc is selected, show content panel; else show list
  const showContentOnMobile = isMobile && selectedDoc !== null;

  // ─── Left panel (file list) ───────────────────────────────────────────────

  const leftPanel = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-secondary)",
        borderRight: isMobile ? "none" : "1px solid var(--border-subtle)",
        overflow: "hidden",
        width: isMobile ? "100%" : 380,
        minWidth: isMobile ? "100%" : 380,
        maxWidth: isMobile ? "100%" : 380,
        height: "100%",
      }}
    >
      {/* Search bar */}
      <div style={{ padding: "16px 16px 12px" }}>
        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
          <input type="text" placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", paddingLeft: 32, paddingRight: 12, paddingTop: 9, paddingBottom: 9, background: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)", borderRadius: 8, color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        </div>
      </div>

      {/* Category filter pills */}
      <div style={{ padding: "0 16px 8px", display: "flex", flexWrap: "wrap", gap: 6 }}>
        <FilterPill label="All" active={categoryFilter === null} onClick={() => setCategoryFilter(null)} />
        {allCategories.map((cat) => (
          <FilterPill key={cat} label={cat} active={categoryFilter === cat} onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)} color={getCategoryColor(cat, allCategories).text} />
        ))}
      </div>

      {/* File type filter pills */}
      {allExtensions.length > 1 && (
        <div style={{ padding: "0 16px 10px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {allExtensions.map((ext) => (
            <FilterPill key={ext} label={ext} active={extFilter === ext} onClick={() => setExtFilter(extFilter === ext ? null : ext)} />
          ))}
        </div>
      )}

      <div style={{ height: 1, background: "var(--border-subtle)", flexShrink: 0 }} />

      {/* Document list */}
      <div className="fab-scroll-pad" style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 0" }}>
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-muted)" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 16px" }}>
            <FileText size={28} style={{ color: "var(--text-muted)", margin: "0 auto 12px", display: "block" }} />
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No documents found</p>
          </div>
        ) : (
          filtered.map((doc) => {
            const isSelected = !isMobile && selectedDoc?.id === doc.id;
            const filename = getFilename(doc.path);
            return (
              <button key={doc.id} onClick={() => selectDoc(doc)}
                style={{ width: "100%", textAlign: "left", padding: "12px 16px", minHeight: 64, display: "flex", alignItems: "flex-start", gap: 12, background: isSelected ? "var(--bg-hover)" : "transparent", border: "none", borderLeft: isSelected ? "3px solid var(--accent-purple)" : "3px solid transparent", cursor: "pointer", transition: "background 0.15s" }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--bg-tertiary)"; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>📄</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>
                    {filename}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CategoryBadge category={doc.category} allCategories={allCategories} />
                    <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{formatDate(doc.lastModified)}</span>
                  </div>
                </div>
                {isMobile && <span style={{ color: "var(--text-muted)", fontSize: 16, alignSelf: "center" }}>›</span>}
              </button>
            );
          })
        )}
      </div>

      {/* Bottom bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderTop: "1px solid var(--border-subtle)", flexShrink: 0 }}>
        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{filtered.length} of {docs.length} docs</span>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={fetchDocs} title="Refresh" style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", background: "transparent", border: "1px solid var(--border-subtle)", borderRadius: 6, color: "var(--text-muted)", fontSize: 11, cursor: "pointer" }}>
            <RefreshCw size={11} />
          </button>
          <button onClick={() => setShowNewDoc(true)} title="New Document" style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "var(--accent-purple)", border: "none", borderRadius: 6, color: "white", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            <Plus size={11} />
            New
          </button>
        </div>
      </div>
    </div>
  );

  // ─── Right panel (content viewer) ────────────────────────────────────────

  const rightPanel = (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", width: isMobile ? "100%" : undefined }}>
      {!selectedDoc ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", padding: 24 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Files size={28} style={{ color: "var(--accent-purple)" }} />
            </div>
            <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Select a document</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>Pick a file from the left panel to read it here.</p>
            <button onClick={() => setShowNewDoc(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "var(--accent-purple)", border: "none", borderRadius: 8, color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <Plus size={14} />New Document
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Document header */}
          <div style={{ padding: isMobile ? "14px 16px 12px" : "20px 32px 16px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", flexShrink: 0 }}>
            {/* Mobile: Back button */}
            {isMobile && (
              <button
                onClick={() => setSelectedDoc(null)}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--accent-purple)", fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "0 0 12px 0", marginLeft: -2 }}
              >
                <ChevronLeft size={18} />
                Back to Documents
              </button>
            )}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h1 style={{ color: "var(--text-primary)", fontSize: isMobile ? 16 : 20, fontWeight: 700, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {getFilename(selectedDoc.path)}
                </h1>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                  <CategoryBadge category={selectedDoc.category} allCategories={allCategories} />
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{formatSize(selectedDoc.size)} · {selectedDoc.wordCount.toLocaleString()} words</span>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{formatDate(selectedDoc.lastModified)}</span>
                  {selectedDoc.tags && selectedDoc.tags.length > 0 && (
                    <div style={{ display: "flex", gap: 4 }}>
                      {selectedDoc.tags.map((t) => <span key={t} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "var(--bg-tertiary)", color: "var(--text-muted)" }}>#{t}</span>)}
                    </div>
                  )}
                </div>
              </div>
              <button onClick={handleCopy} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: copied ? "#26c97a22" : "var(--bg-elevated)", color: copied ? "#26c97a" : "var(--text-secondary)", border: "1px solid var(--border-subtle)", borderRadius: 7, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Document content */}
          <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 16px 40px" : "24px 32px 48px" }}>
            <div style={{ maxWidth: 720 }}>
              {contentLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "64px 0" }}>
                  <Loader2 size={20} className="animate-spin" style={{ color: "var(--accent-purple)" }} />
                </div>
              ) : docContent !== null ? (
                <MarkdownRenderer content={docContent} />
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      {showNewDoc && (
        <NewDocForm
          onClose={() => setShowNewDoc(false)}
          onSaved={() => { fetchDocs(); }}
          categories={allCategories.length > 0 ? allCategories : ["Other"]}
        />
      )}

      <div style={{ display: "flex", height: "100%", overflow: "hidden", background: "var(--bg-primary)" }}>
        {isMobile ? (
          /* Mobile: single-panel flip */
          showContentOnMobile ? rightPanel : leftPanel
        ) : (
          /* Desktop: side-by-side */
          <>
            {leftPanel}
            {rightPanel}
          </>
        )}
      </div>
    </>
  );
}
