import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

async function ensureTable() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS mc_agent_inbox (
      id SERIAL PRIMARY KEY,
      from_agent TEXT NOT NULL,
      to_agent TEXT NOT NULL,
      subject TEXT,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'unread',
      priority TEXT DEFAULT 'normal',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      read_at TIMESTAMPTZ,
      reply_to_id INTEGER REFERENCES mc_agent_inbox(id),
      metadata JSONB
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_agent_inbox_to_status ON mc_agent_inbox(to_agent, status)`;
}

export async function GET(req: Request) {
  try {
    await ensureTable();
    const sql = getDb();
    const { searchParams } = new URL(req.url);
    const agent = searchParams.get("agent"); // filter by to_agent
    const status = searchParams.get("status"); // filter by status

    let rows;
    if (agent && status) {
      rows = await sql`
        SELECT * FROM mc_agent_inbox
        WHERE to_agent = ${agent} AND status = ${status}
        ORDER BY created_at DESC
        LIMIT 100
      `;
    } else if (agent) {
      rows = await sql`
        SELECT * FROM mc_agent_inbox
        WHERE to_agent = ${agent} OR from_agent = ${agent}
        ORDER BY created_at DESC
        LIMIT 100
      `;
    } else {
      rows = await sql`
        SELECT * FROM mc_agent_inbox
        ORDER BY created_at DESC
        LIMIT 100
      `;
    }

    return NextResponse.json({ messages: rows });
  } catch (e) {
    console.error("GET /api/inbox error:", e);
    return NextResponse.json({ error: "Failed to load inbox" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureTable();
    const sql = getDb();
    const body = await req.json();
    const { from_agent, to_agent, subject, message, priority, reply_to_id } = body;

    if (!from_agent || !to_agent || !message) {
      return NextResponse.json({ error: "from_agent, to_agent, and message are required" }, { status: 400 });
    }

    const rows = await sql`
      INSERT INTO mc_agent_inbox (from_agent, to_agent, subject, message, priority, reply_to_id)
      VALUES (${from_agent}, ${to_agent}, ${subject || null}, ${message}, ${priority || 'normal'}, ${reply_to_id || null})
      RETURNING *
    `;

    return NextResponse.json({ message: rows[0] });
  } catch (e) {
    console.error("POST /api/inbox error:", e);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await ensureTable();
    const sql = getDb();
    const body = await req.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "id and status are required" }, { status: 400 });
    }

    const readAt = status === 'read' ? new Date().toISOString() : null;

    await sql`
      UPDATE mc_agent_inbox
      SET status = ${status}, read_at = ${readAt}
      WHERE id = ${id}
    `;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/inbox error:", e);
    return NextResponse.json({ error: "Failed to update message" }, { status: 500 });
  }
}
