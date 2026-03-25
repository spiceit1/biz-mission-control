"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ClipboardList,
  Plus,
  CheckSquare,
  Square,
  CheckCircle2,
  Circle,
  Filter,
  RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequestItem {
  id: string;
  text: string;
  done: boolean;
}

interface RequestCategory {
  name: string;
  items: RequestItem[];
}

interface RequestsData {
  categories: RequestCategory[];
  lastUpdated: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pendingCount(items: RequestItem[]) {
  return items.filter((i) => !i.done).length;
}

function allItems(categories: RequestCategory[]): RequestItem[] {
  return categories.flatMap((c) => c.items);
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "10px 16px",
        borderRadius: 12,
        border: "1px solid var(--border-subtle)",
        background: "var(--bg-elevated)",
        flex: "1 1 90px",
        minWidth: 80,
      }}
    >
      <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 600, color: color ?? "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RequestsPage() {
  const [data, setData] = useState<RequestsData>({ categories: [], lastUpdated: null });
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [filterPending, setFilterPending] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const addInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  // Mobile: null = show category list, string = show that category's items
  const [mobilePanel, setMobilePanel] = useState<"categories" | "items">("categories");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/requests");
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (adding) {
      setTimeout(() => addInputRef.current?.focus(), 50);
    }
  }, [adding]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const all = allItems(data.categories);
  const totalPending = all.filter((i) => !i.done).length;
  const totalDone = all.filter((i) => i.done).length;

  const visibleCategories: RequestCategory[] =
    selectedCategory === "All"
      ? data.categories
      : data.categories.filter((c) => c.name === selectedCategory);

  const visibleItems: RequestItem[] = visibleCategories
    .flatMap((c) => c.items)
    .filter((i) => (filterPending ? !i.done : true));

  // Category for add button (only valid when not "All")
  const addCategory =
    selectedCategory !== "All" ? selectedCategory : null;

  // ── Toggle item ───────────────────────────────────────────────────────────

  const toggleItem = useCallback(
    async (item: RequestItem, categoryName: string) => {
      const key = item.id;
      setToggling((prev) => new Set(prev).add(key));

      // Optimistic update
      setData((prev) => ({
        ...prev,
        categories: prev.categories.map((c) => ({
          ...c,
          items: c.items.map((i) =>
            i.id === item.id ? { ...i, done: !item.done } : i
          ),
        })),
      }));

      try {
        await fetch("/api/requests", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: categoryName,
            itemText: item.text,
            done: !item.done,
          }),
        });
      } catch {
        // Revert on error
        setData((prev) => ({
          ...prev,
          categories: prev.categories.map((c) => ({
            ...c,
            items: c.items.map((i) =>
              i.id === item.id ? { ...i, done: item.done } : i
            ),
          })),
        }));
      } finally {
        setToggling((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    []
  );

  // ── Add request ───────────────────────────────────────────────────────────

  const submitAdd = useCallback(async () => {
    if (!addCategory || !newText.trim()) return;
    const text = newText.trim();
    setAdding(false);
    setNewText("");

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    setData((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.name === addCategory
          ? { ...c, items: [...c.items, { id: tempId, text, done: false }] }
          : c
      ),
    }));

    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: addCategory, text }),
      });
      const json = await res.json();
      if (json.categories) {
        setData(json);
      }
    } catch {
      // Remove temp on error
      setData((prev) => ({
        ...prev,
        categories: prev.categories.map((c) =>
          c.name === addCategory
            ? { ...c, items: c.items.filter((i) => i.id !== tempId) }
            : c
        ),
      }));
    }
  }, [addCategory, newText]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div>
          <h1
            className="text-lg font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Requests
          </h1>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--text-tertiary)" }}
          >
            {totalPending} pending · {totalDone} done · {data.categories.length} categories
          </p>
        </div>
        <button
          onClick={fetchData}
          title="Refresh"
          className="p-1.5 rounded-md"
          style={{ color: "var(--text-tertiary)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--text-primary)";
            e.currentTarget.style.background = "var(--bg-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-tertiary)";
            e.currentTarget.style.background = "transparent";
          }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────────────── */}
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}
      >
        <StatCard label="Pending" value={totalPending} color="#f0b429" />
        <StatCard label="Done" value={totalDone} color="#26c97a" />
        <StatCard label="Categories" value={data.categories.length} />
        <StatCard label="Last Updated" value={data.lastUpdated ?? "—"} />
      </div>

      {/* ── Body: sidebar + main ────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", flexDirection: isMobile ? "column" : "row" }}>

        {/* ── Category sidebar / mobile category list ─────────────────── */}
        {(!isMobile || mobilePanel === "categories") && (
        <aside
          style={{
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            borderRight: isMobile ? "none" : "1px solid var(--border-subtle)",
            overflowY: "auto",
            width: isMobile ? "100%" : 210,
            background: "var(--bg-secondary)",
            flex: isMobile ? 1 : undefined,
          }}
        >
          <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: 2 }}>
            {/* All */}
            {(() => {
              const isActive = selectedCategory === "All";
              return (
                <button
                  onClick={() => { setSelectedCategory("All"); if (isMobile) setMobilePanel("items"); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 6, fontSize: 14, fontWeight: 500, textAlign: "left", cursor: "pointer", background: isActive ? "var(--bg-hover)" : "transparent", color: isActive ? "var(--text-primary)" : "var(--text-secondary)", border: "none", borderLeft: isActive ? "2px solid var(--accent-purple)" : "2px solid transparent", boxSizing: "border-box" }}
                >
                  <span>All</span>
                  <span style={{ color: "var(--text-tertiary)", fontSize: 13, flexShrink: 0 }}>{totalPending}/{all.length}</span>
                </button>
              );
            })()}

            {/* Per category */}
            {data.categories.map((cat) => {
              const isActive = selectedCategory === cat.name;
              const pending = pendingCount(cat.items);
              return (
                <button
                  key={cat.name}
                  onClick={() => { setSelectedCategory(cat.name); if (isMobile) setMobilePanel("items"); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 6, fontSize: 14, textAlign: "left", cursor: "pointer", background: isActive ? "var(--bg-hover)" : "transparent", color: isActive ? "var(--text-primary)" : "var(--text-secondary)", border: "none", borderLeft: isActive ? "2px solid var(--accent-purple)" : "2px solid transparent" }}
                  onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-primary)"; } }}
                  onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; } }}
                >
                  <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.name}</span>
                  <span style={{ marginLeft: 8, flexShrink: 0, color: pending > 0 ? "#f0b429" : "var(--text-muted)", fontSize: 13 }}>{pending}/{cat.items.length}</span>
                  {isMobile && <span style={{ color: "var(--text-muted)", fontSize: 16, marginLeft: 4 }}>›</span>}
                </button>
              );
            })}
          </div>
        </aside>
        )}

        {/* ── Main content ──────────────────────────────────────────────── */}
        {(!isMobile || mobilePanel === "items") && (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          {/* Content header */}
          <div
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "12px 14px" : "12px 24px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0, gap: 12, flexWrap: "wrap" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Mobile back button */}
              {isMobile && (
                <button onClick={() => setMobilePanel("categories")} style={{ background: "none", border: "none", color: "var(--accent-purple)", fontSize: 14, fontWeight: 600, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}>← Back</button>
              )}
              <h2
                style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}
              >
                {selectedCategory}
              </h2>
              {/* Pending badge */}
              {(() => {
                const pending =
                  selectedCategory === "All"
                    ? totalPending
                    : pendingCount(
                        data.categories.find(
                          (c) => c.name === selectedCategory
                        )?.items ?? []
                      );
                return pending > 0 ? (
                  <span
                    className="px-2 py-0.5 rounded text-xs font-semibold"
                    style={{
                      background: "#f0b42920",
                      color: "#f0b429",
                    }}
                  >
                    {pending} pending
                  </span>
                ) : null;
              })()}
            </div>

            <div className="flex items-center gap-2">
              {/* Filter toggle */}
              <button
                onClick={() => setFilterPending((p) => !p)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors"
                style={{
                  borderColor: filterPending
                    ? "var(--accent-purple)"
                    : "var(--border-default)",
                  background: filterPending
                    ? "var(--accent-purple)20"
                    : "transparent",
                  color: filterPending
                    ? "var(--accent-purple)"
                    : "var(--text-secondary)",
                }}
              >
                <Filter size={12} />
                {filterPending ? "Pending Only" : "Show All"}
              </button>

              {/* Add button (only when a specific category is selected) */}
              {addCategory && (
                <button
                  onClick={() => {
                    setAdding(true);
                    setNewText("");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
                  style={{
                    background: "var(--accent-purple)",
                    color: "white",
                  }}
                >
                  <Plus size={12} />
                  Add Request
                </button>
              )}
            </div>
          </div>

          {/* Items list */}
          <div className="fab-scroll-pad" style={{ flex: 1, overflowY: "auto", padding: isMobile ? "12px 14px" : "16px 24px", display: "flex", flexDirection: "column", gap: 4 }}>
            {loading ? (
              <div
                className="flex items-center justify-center h-40 text-sm"
                style={{ color: "var(--text-tertiary)" }}
              >
                Loading...
              </div>
            ) : visibleItems.length === 0 && !adding ? (
              <div
                className="flex flex-col items-center justify-center h-40 rounded-xl border border-dashed gap-2"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-muted)",
                }}
              >
                <ClipboardList size={28} style={{ opacity: 0.3 }} />
                <p className="text-sm">
                  {filterPending
                    ? "All caught up! No pending items."
                    : "No requests yet."}
                </p>
              </div>
            ) : (
              <>
                {/* Group items by category when "All" is selected */}
                {selectedCategory === "All" ? (
                  data.categories.map((cat) => {
                    const items = filterPending
                      ? cat.items.filter((i) => !i.done)
                      : cat.items;
                    if (items.length === 0) return null;
                    return (
                      <div key={cat.name} className="mb-4">
                        <div
                          className="text-xs font-semibold uppercase tracking-wider mb-2 px-1"
                          style={{
                            color: "var(--text-tertiary)",
                            fontSize: "0.6rem",
                            letterSpacing: "0.1em",
                          }}
                        >
                          {cat.name}
                        </div>
                        <div className="space-y-0.5">
                          {items.map((item) => (
                            <RequestRow
                              key={item.id}
                              item={item}
                              categoryName={cat.name}
                              toggling={toggling.has(item.id)}
                              onToggle={toggleItem}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => (
                      <RequestRow
                        key={item.id}
                        item={item}
                        categoryName={selectedCategory}
                        toggling={toggling.has(item.id)}
                        onToggle={toggleItem}
                      />
                    ))}
                  </div>
                )}

                {/* Inline add input */}
                {adding && addCategory && (
                  <div
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border mt-1"
                    style={{
                      background: "var(--bg-elevated)",
                      borderColor: "var(--accent-purple)",
                    }}
                  >
                    <Circle size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    <input
                      ref={addInputRef}
                      value={newText}
                      onChange={(e) => setNewText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitAdd();
                        if (e.key === "Escape") {
                          setAdding(false);
                          setNewText("");
                        }
                      }}
                      placeholder="New request..."
                      className="flex-1 bg-transparent text-sm outline-none"
                      style={{ color: "var(--text-primary)" }}
                    />
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => {
                          setAdding(false);
                          setNewText("");
                        }}
                        className="px-2 py-1 rounded text-xs"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={submitAdd}
                        className="px-2.5 py-1 rounded text-xs font-medium"
                        style={{
                          background: "var(--accent-purple)",
                          color: "white",
                        }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        )} {/* end main content conditional */}
      </div>
    </div>
  );
}

// ─── Request Row ──────────────────────────────────────────────────────────────

function RequestRow({
  item,
  categoryName,
  toggling,
  onToggle,
}: {
  item: RequestItem;
  categoryName: string;
  toggling: boolean;
  onToggle: (item: RequestItem, category: string) => void;
}) {
  return (
    <div
      className="flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer group transition-colors"
      style={{
        background: "transparent",
        opacity: toggling ? 0.6 : 1,
      }}
      onClick={() => !toggling && onToggle(item, categoryName)}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-elevated)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {/* Checkbox */}
      <div className="flex-shrink-0 mt-0.5">
        {item.done ? (
          <CheckCircle2
            size={16}
            style={{ color: "#26c97a" }}
          />
        ) : (
          <Circle
            size={16}
            style={{ color: "var(--text-muted)" }}
          />
        )}
      </div>

      {/* Text */}
      <span
        className="text-sm leading-relaxed flex-1"
        style={{
          color: item.done ? "var(--text-tertiary)" : "var(--text-primary)",
          textDecoration: item.done ? "line-through" : "none",
          fontWeight: item.done ? 400 : 500,
        }}
      >
        {item.text}
      </span>
    </div>
  );
}
