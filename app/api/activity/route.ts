import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getDb();
    const rows = await sql`SELECT data FROM mc_activity ORDER BY created_at DESC LIMIT 100`;
    return NextResponse.json(rows.map((r: { data: unknown }) => r.data));
  } catch (e) {
    console.error("GET /api/activity error:", e);
    return NextResponse.json({ error: "Failed to read activity" }, { status: 500 });
  }
}
