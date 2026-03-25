import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getDb();
    const rows = await sql`SELECT content FROM mc_notes WHERE id = 'main' LIMIT 1`;
    const content = rows.length > 0 ? rows[0].content : "# Notes\n\n";
    return NextResponse.json({ content });
  } catch (e) {
    console.error("GET /api/notes error:", e);
    return NextResponse.json({ error: "Failed to read notes" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { content } = await req.json();
    const sql = getDb();
    await sql`INSERT INTO mc_notes (id, content, updated_at) VALUES ('main', ${content}, NOW())
      ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/notes error:", e);
    return NextResponse.json({ error: "Failed to save notes" }, { status: 500 });
  }
}
