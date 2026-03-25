import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getDb();
    const rows = await sql`SELECT * FROM mc_heartbeat ORDER BY timestamp DESC LIMIT 50`;

    const entries = rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      timestamp: r.timestamp,
      type: r.type,
      summary: r.summary,
      details: r.details,
      taskName: r.task_name,
    }));

    // Calculate stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEntries = entries.filter(
      (e: { timestamp: string }) => new Date(e.timestamp) >= todayStart
    );

    const lastHeartbeat = entries.length > 0 ? entries[0].timestamp : null;
    const totalToday = todayEntries.length;

    return NextResponse.json({
      entries,
      lastHeartbeat,
      totalToday,
    });
  } catch (e) {
    console.error("GET /api/heartbeat error:", e);
    return NextResponse.json(
      { error: "Failed to read heartbeat log" },
      { status: 500 }
    );
  }
}
