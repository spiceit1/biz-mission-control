import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

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

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseMarkdown(content: string): RequestCategory[] {
  const lines = content.split("\n");
  const categories: RequestCategory[] = [];
  let current: RequestCategory | null = null;
  let itemIndex = 0;

  for (const line of lines) {
    const sectionMatch = line.match(/^##\s+(.+)/);
    if (sectionMatch) {
      if (current) categories.push(current);
      current = { name: sectionMatch[1].trim(), items: [] };
      continue;
    }

    if (current) {
      const doneMatch = line.match(/^- \[x\]\s+(.+)/i);
      const pendingMatch = line.match(/^- \[ \]\s+(.+)/);
      if (doneMatch || pendingMatch) {
        const text = (doneMatch || pendingMatch)![1].trim();
        const done = !!doneMatch;
        current.items.push({
          id: `item-${itemIndex++}`,
          text,
          done,
        });
      }
    }
  }

  if (current) categories.push(current);
  return categories;
}

function getLastUpdated(content: string): string {
  const match = content.match(/\*Last updated:\s*(.+?)\*/);
  return match ? match[1].trim() : "unknown";
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const sql = getDb();
    const rows = await sql`SELECT content FROM mc_requests WHERE id = 'main' LIMIT 1`;
    if (rows.length === 0) {
      return NextResponse.json({ categories: [], lastUpdated: null });
    }
    const content = rows[0].content as string;
    const categories = parseMarkdown(content);
    const lastUpdated = getLastUpdated(content);
    return NextResponse.json({ categories, lastUpdated });
  } catch (e) {
    console.error("GET /api/requests error:", e);
    return NextResponse.json({ error: "Failed to read requests" }, { status: 500 });
  }
}

// ─── PATCH (toggle done/not done) ─────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const { category, itemText, done } = await req.json();
    const sql = getDb();

    const rows = await sql`SELECT content FROM mc_requests WHERE id = 'main' LIMIT 1`;
    if (rows.length === 0) {
      return NextResponse.json({ error: "No requests file" }, { status: 404 });
    }

    let content = rows[0].content as string;
    void category; // used for context

    const escapedText = itemText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const donePattern = new RegExp(`^(- \\[x\\]\\s+)(${escapedText})$`, "m");
    const pendingPattern = new RegExp(`^(- \\[ \\]\\s+)(${escapedText})$`, "m");

    if (done) {
      content = content.replace(pendingPattern, `- [x] $2`);
    } else {
      content = content.replace(donePattern, `- [ ] $2`);
    }

    await sql`UPDATE mc_requests SET content = ${content}, updated_at = NOW() WHERE id = 'main'`;

    return NextResponse.json({ category, text: itemText, done });
  } catch (e) {
    console.error("PATCH /api/requests error:", e);
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
  }
}

// ─── POST (add new request) ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { category, text } = await req.json();
    if (!category || !text?.trim()) {
      return NextResponse.json({ error: "category and text required" }, { status: 400 });
    }

    const sql = getDb();
    const rows = await sql`SELECT content FROM mc_requests WHERE id = 'main' LIMIT 1`;
    if (rows.length === 0) {
      return NextResponse.json({ error: "No requests file" }, { status: 404 });
    }

    let content = rows[0].content as string;
    const lines = content.split("\n");

    const sectionIdx = lines.findIndex((l) =>
      l.match(new RegExp(`^##\\s+${category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`))
    );

    if (sectionIdx === -1) {
      return NextResponse.json({ error: `Category "${category}" not found` }, { status: 404 });
    }

    let insertAt = sectionIdx + 1;
    for (let i = sectionIdx + 1; i < lines.length; i++) {
      if (lines[i].match(/^##\s+/)) break;
      if (lines[i].match(/^- \[[ x]\]\s+/i)) {
        insertAt = i + 1;
      }
    }

    lines.splice(insertAt, 0, `- [ ] ${text.trim()}`);
    content = lines.join("\n");

    await sql`UPDATE mc_requests SET content = ${content}, updated_at = NOW() WHERE id = 'main'`;

    const categories = parseMarkdown(content);
    const lastUpdated = getLastUpdated(content);
    return NextResponse.json({ categories, lastUpdated });
  } catch (e) {
    console.error("POST /api/requests error:", e);
    return NextResponse.json({ error: "Failed to add request" }, { status: 500 });
  }
}
