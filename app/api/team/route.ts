import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getDb();
    const rows = await sql`SELECT data FROM mc_team WHERE id = 'config' LIMIT 1`;
    if (rows.length === 0) {
      return NextResponse.json({ mission: "", agents: [], liveSubagents: [], lastUpdated: new Date().toISOString() });
    }
    const data = rows[0].data as Record<string, unknown>;
    return NextResponse.json({
      ...data,
      liveSubagents: [],
      lastUpdated: new Date().toISOString(),
    });
  } catch (e) {
    console.error("GET /api/team error:", e);
    return NextResponse.json({ error: "Failed to read team data" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const sql = getDb();

    // Get current data
    const rows = await sql`SELECT data FROM mc_team WHERE id = 'config' LIMIT 1`;
    const data = rows.length > 0 ? (rows[0].data as { mission?: string; agents?: Array<{ id: string; status?: string }> }) : { mission: "", agents: [] };

    if (typeof body.mission === "string") {
      data.mission = body.mission;
    }

    if (body.agentId && body.status) {
      const agent = (data.agents || []).find((a) => a.id === body.agentId);
      if (agent) {
        agent.status = body.status;
      }
    }

    await sql`INSERT INTO mc_team (id, data, updated_at) VALUES ('config', ${JSON.stringify(data)}, NOW())
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.error("PATCH /api/team error:", e);
    return NextResponse.json({ error: "Failed to update team data" }, { status: 500 });
  }
}
