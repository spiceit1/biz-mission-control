import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getDb();
    const rows = await sql`SELECT data FROM mc_projects ORDER BY updated_at DESC`;
    return NextResponse.json(rows.map((r: { data: unknown }) => r.data));
  } catch (e) {
    console.error("GET /api/projects error:", e);
    return NextResponse.json({ error: "Failed to read projects" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const sql = getDb();
    await sql`UPDATE mc_projects SET data = ${JSON.stringify(body)}, updated_at = NOW() WHERE id = ${body.id}`;
    return NextResponse.json(body);
  } catch (e) {
    console.error("PUT /api/projects error:", e);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}
