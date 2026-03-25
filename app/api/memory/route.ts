import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const longTerm = searchParams.get("longterm");

  try {
    const sql = getDb();

    if (longTerm === "1") {
      const rows = await sql`SELECT content, size, word_count, last_modified FROM mc_memory_files WHERE filename = 'MEMORY.md' LIMIT 1`;
      if (rows.length === 0) {
        return NextResponse.json({ content: null, error: "MEMORY.md not found" });
      }
      const r = rows[0];
      return NextResponse.json({
        content: r.content,
        size: r.size,
        wordCount: r.word_count,
        lastModified: r.last_modified,
      });
    }

    if (date) {
      const filename = `${date}.md`;
      const rows = await sql`SELECT content, size, word_count, last_modified FROM mc_memory_files WHERE filename = ${filename} LIMIT 1`;
      if (rows.length === 0) {
        return NextResponse.json({ date, content: null, error: "No log for this date" });
      }
      const r = rows[0];
      return NextResponse.json({
        date,
        content: r.content,
        size: r.size,
        wordCount: r.word_count,
        lastModified: r.last_modified,
      });
    }

    // Return list of available dates + MEMORY.md summary
    const allFiles = await sql`SELECT filename, size, word_count, last_modified, content FROM mc_memory_files ORDER BY filename DESC`;

    const dates: Array<{ date: string; size: number; wordCount: number; lastModified: string }> = [];
    let longTermMemory = "";
    let longTermSize = 0;
    let longTermWordCount = 0;
    let longTermLastModified = new Date().toISOString();

    for (const r of allFiles) {
      if (r.filename === "MEMORY.md") {
        longTermMemory = r.content || "";
        longTermSize = r.size || 0;
        longTermWordCount = r.word_count || 0;
        longTermLastModified = r.last_modified || new Date().toISOString();
      } else {
        const match = (r.filename as string).match(/^(\d{4}-\d{2}-\d{2})\.md$/);
        if (match) {
          dates.push({
            date: match[1],
            size: r.size || 0,
            wordCount: r.word_count || 0,
            lastModified: r.last_modified || new Date().toISOString(),
          });
        }
      }
    }

    return NextResponse.json({
      dates,
      longTermMemory,
      longTermSize,
      longTermWordCount,
      longTermLastModified,
    });
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("GET /api/memory error:", err);
    return NextResponse.json({ error: err.message || "Unknown error", dates: [], longTermMemory: "" });
  }
}
