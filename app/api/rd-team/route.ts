import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  try {
    const sql = getDb();

    if (date) {
      const rows = await sql`SELECT content FROM mc_rd_memos WHERE date = ${date} LIMIT 1`;
      if (rows.length === 0) {
        return NextResponse.json({ error: "Memo not found" }, { status: 404 });
      }
      return NextResponse.json({ date, content: rows[0].content });
    }

    const [memoRows, statusRows] = await Promise.all([
      sql`SELECT date FROM mc_rd_memos ORDER BY date DESC`,
      sql`SELECT data FROM mc_rd_status WHERE id = 'config' LIMIT 1`,
    ]);

    const memos = memoRows.map((r: { date: string }) => ({
      date: r.date,
      filename: `${r.date}.md`,
    }));

    const status =
      statusRows.length > 0
        ? statusRows[0].data
        : { lastRunAt: null, lastRunStatus: null };

    let latestContent: string | null = null;
    if (memos.length > 0) {
      const latest = await sql`SELECT content FROM mc_rd_memos WHERE date = ${memos[0].date} LIMIT 1`;
      if (latest.length > 0) {
        latestContent = latest[0].content as string;
      }
    }

    return NextResponse.json({ memos, status, latestContent });
  } catch (e) {
    console.error("GET /api/rd-team error:", e);
    return NextResponse.json({ error: "Failed to read R&D data" }, { status: 500 });
  }
}

export async function POST() {
  // R&D runs require spawning a local process — can't do this on Netlify
  return NextResponse.json(
    {
      error: "R&D runs can only be triggered locally. Use the sync script or run from the local dev server.",
    },
    { status: 400 }
  );
}
