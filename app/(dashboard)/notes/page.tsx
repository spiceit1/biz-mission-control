"use client";

import { useState, useEffect, useRef } from "react";
import { Save, CheckCircle2, FileText } from "lucide-react";

export default function NotesPage() {
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/notes")
      .then((r) => r.json())
      .then((data) => {
        setContent(data.content || "");
        setLoading(false);
        setLastSaved(new Date());
      });
  }, []);

  const handleChange = (val: string) => {
    setContent(val);
    setSaved(false);

    // Auto-save after 1.5s of inactivity
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      handleSave(val);
    }, 1500);
  };

  const handleSave = async (val?: string) => {
    const toSave = val ?? content;
    setSaving(true);
    await fetch("/api/notes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: toSave }),
    });
    setSaving(false);
    setSaved(true);
    setLastSaved(new Date());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      handleSave();
    }
  };

  const lineCount = content.split("\n").length;
  const charCount = content.length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Notes
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
            Quick thoughts · Stored in notes.md · Douglas & Shmack both read this
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Save status */}
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-tertiary)" }}>
            {saving ? (
              <>
                <Save size={12} className="animate-pulse" />
                Saving...
              </>
            ) : saved ? (
              <>
                <CheckCircle2 size={12} style={{ color: "#26c97a" }} />
                {lastSaved
                  ? `Saved ${lastSaved.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                  : "Saved"}
              </>
            ) : (
              <>
                <Save size={12} style={{ color: "#f0b429" }} />
                Unsaved changes
              </>
            )}
          </div>

          <button
            onClick={() => handleSave()}
            disabled={saved || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium"
            style={{
              background: saved || saving ? "var(--bg-elevated)" : "var(--accent-purple)",
              color: saved || saving ? "var(--text-muted)" : "white",
              cursor: saved || saving ? "default" : "pointer",
            }}
          >
            <Save size={13} />
            Save
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center flex-1" style={{ color: "var(--text-tertiary)" }}>
            <FileText size={24} style={{ marginRight: 8 }} />
            Loading notes...
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className="flex-1 w-full px-8 py-6 resize-none font-mono text-sm leading-relaxed"
            style={{
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              border: "none",
              outline: "none",
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
              fontSize: "0.85rem",
              lineHeight: "1.7",
            }}
            placeholder="# Notes&#10;&#10;Start writing... ⌘S to save."
          />
        )}
      </div>

      {/* Status bar */}
      <div
        className="flex items-center justify-between px-6 py-1.5 border-t flex-shrink-0"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-muted)", fontSize: "0.65rem" }}>
          <span>{lineCount} lines</span>
          <span>{charCount} chars</span>
        </div>
        <div className="text-xs" style={{ color: "var(--text-muted)", fontSize: "0.65rem" }}>
          notes.md · Auto-saves after 1.5s · ⌘S to save now
        </div>
      </div>
    </div>
  );
}
