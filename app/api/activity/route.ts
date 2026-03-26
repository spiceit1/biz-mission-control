import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const typeFilter = searchParams.get("type");
  const agentFilter = searchParams.get("agent");
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  try {
    const sql = getDb();

    // Fetch from both mc_activity and mc_heartbeat for a combined feed
    const [activityRows, heartbeatRows] = await Promise.all([
      sql`SELECT id, data, type, agent_id, title, description, metadata, created_at
          FROM mc_activity ORDER BY created_at DESC LIMIT ${limit}`,
      sql`SELECT id, timestamp, type, summary, details, task_name
          FROM mc_heartbeat ORDER BY timestamp DESC LIMIT ${limit}`,
    ]);

    // Normalize activity rows
    const activityItems = activityRows.map((r: Record<string, unknown>) => {
      const data = (r.data as Record<string, unknown>) || {};
      return {
        id: `activity-${r.id}`,
        type: (r.type as string) || (data.type as string) || "agent_action",
        title: (r.title as string) || (data.message as string) || (data.title as string) || "",
        description: (r.description as string) || "",
        agentId: (r.agent_id as string) || (data.actor as string) || null,
        timestamp: r.created_at as string,
        source: "activity" as const,
        metadata: r.metadata || data || {},
      };
    });

    // Normalize heartbeat rows into activity format
    const heartbeatItems = heartbeatRows.map((r: Record<string, unknown>) => ({
      id: `heartbeat-${r.id}`,
      type: r.type === "error" ? "error" : "heartbeat_fired",
      title: r.summary as string,
      description: r.details as string,
      agentId: r.task_name as string,
      timestamp: r.timestamp as string,
      source: "heartbeat" as const,
      metadata: {},
    }));

    // Combine and sort
    let combined = [...activityItems, ...heartbeatItems].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply filters
    if (typeFilter) {
      combined = combined.filter((item) => item.type === typeFilter);
    }
    if (agentFilter) {
      combined = combined.filter((item) => item.agentId === agentFilter);
    }

    return NextResponse.json({
      items: combined.slice(0, limit),
      total: combined.length,
    });
  } catch (e) {
    console.error("GET /api/activity error:", e);
    return NextResponse.json({ error: "Failed to read activity" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const sql = getDb();
    await sql`INSERT INTO mc_activity (data, type, agent_id, title, description, metadata, created_at)
      VALUES (${JSON.stringify(body)}, ${body.type || null}, ${body.agentId || null}, ${body.title || null}, ${body.description || null}, ${JSON.stringify(body.metadata || {})}, NOW())`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/activity error:", e);
    return NextResponse.json({ error: "Failed to write activity" }, { status: 500 });
  }
}
