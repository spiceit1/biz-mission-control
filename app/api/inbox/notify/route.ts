import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/inbox/notify
 * 
 * Receives a real-time webhook from another Mission Control instance
 * when a new inbox message is sent to this agent.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { event, from_agent, to_agent, message_id } = body;

    if (event !== "new_message") {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const sql = getDb();
    await sql`
      CREATE TABLE IF NOT EXISTS mc_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMPTZ DEFAULT NOW())
    `;
    await sql`
      INSERT INTO mc_settings (key, value, updated_at)
      VALUES ('inbox_notify_pending', ${JSON.stringify({ from_agent, to_agent, message_id, received_at: new Date().toISOString() })}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;

    console.log(`[inbox/notify] New message from ${from_agent} to ${to_agent} (id: ${message_id})`);
    return NextResponse.json({ ok: true, received: true });
  } catch (e) {
    console.error("POST /api/inbox/notify error:", e);
    return NextResponse.json({ error: "Failed to process notification" }, { status: 500 });
  }
}

/**
 * GET /api/inbox/notify
 * 
 * Lets an agent poll to check if a new inbox notification is pending.
 * Returns the pending notification and clears it.
 */
export async function GET() {
  try {
    const sql = getDb();
    const rows = await sql`SELECT value FROM mc_settings WHERE key = 'inbox_notify_pending' LIMIT 1`;
    if (rows.length === 0) {
      return NextResponse.json({ pending: false });
    }
    // Clear the flag
    await sql`DELETE FROM mc_settings WHERE key = 'inbox_notify_pending'`;
    return NextResponse.json({ pending: true, notification: JSON.parse(rows[0].value) });
  } catch (e) {
    return NextResponse.json({ pending: false });
  }
}
