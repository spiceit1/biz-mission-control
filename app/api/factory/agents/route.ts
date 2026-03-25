import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET — Return all agents (active + recently completed)
export async function GET() {
  try {
    const sql = getDb();
    // Try mc_factory_agents first, fall back to mc_live_agents
    let rows;
    try {
      rows = await sql`
        SELECT * FROM mc_factory_agents
        WHERE status IN ('active', 'running')
          OR (status = 'completed' AND updated_at > NOW() - interval '30 minutes')
          OR (status = 'failed' AND updated_at > NOW() - interval '30 minutes')
        ORDER BY created_at DESC
      `;
    } catch {
      // Fallback to mc_live_agents if mc_factory_agents doesn't exist
      rows = await sql`
        SELECT * FROM mc_live_agents
        WHERE status = 'active'
          OR (status = 'completed' AND completed_at > NOW() - interval '30 minutes')
          OR (status = 'failed' AND completed_at > NOW() - interval '30 minutes')
        ORDER BY started_at DESC
      `;
    }
    return NextResponse.json({ agents: rows });
  } catch (e) {
    console.error("GET /api/factory/agents error:", e);
    return NextResponse.json({ agents: [] });
  }
}

// POST — Register a new agent
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, session_key, name, emoji, role, model, task_summary } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const sql = getDb();
    await sql`
      INSERT INTO mc_factory_agents (id, session_key, name, emoji, role, model, task_summary, status, created_at, updated_at)
      VALUES (
        ${id},
        ${session_key || null},
        ${name || id},
        ${emoji || '🤖'},
        ${role || 'Sub-Agent'},
        ${model || 'sonnet'},
        ${task_summary || null},
        'running',
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, mc_factory_agents.name),
        emoji = COALESCE(EXCLUDED.emoji, mc_factory_agents.emoji),
        role = COALESCE(EXCLUDED.role, mc_factory_agents.role),
        model = COALESCE(EXCLUDED.model, mc_factory_agents.model),
        task_summary = COALESCE(EXCLUDED.task_summary, mc_factory_agents.task_summary),
        session_key = COALESCE(EXCLUDED.session_key, mc_factory_agents.session_key),
        status = 'running',
        updated_at = NOW()
    `;

    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error("POST /api/factory/agents error:", e);
    return NextResponse.json({ error: "Failed to register agent" }, { status: 500 });
  }
}

// PATCH — Update agent status (completed, failed)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const sql = getDb();
    await sql`
      UPDATE mc_factory_agents
      SET status = ${status || 'completed'},
          updated_at = NOW()
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error("PATCH /api/factory/agents error:", e);
    return NextResponse.json({ error: "Failed to update agent" }, { status: 500 });
  }
}
