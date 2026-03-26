import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET — Return all live agents (active + recently completed within 30 min)
export async function GET() {
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT * FROM mc_live_agents
      WHERE status = 'active'
        OR (status = 'completed' AND completed_at > NOW() - interval '30 minutes')
        OR (status = 'failed' AND completed_at > NOW() - interval '30 minutes')
      ORDER BY started_at DESC
    `;
    return NextResponse.json({ agents: rows });
  } catch (e) {
    console.error("GET /api/factory/agents error:", e);
    return NextResponse.json({ error: "Failed to fetch live agents" }, { status: 500 });
  }
}

// POST — Register a new live agent
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, session_key, name, emoji, role, model, task_summary, task_id } = body;

    if (!id || !name) {
      return NextResponse.json({ error: "id and name are required" }, { status: 400 });
    }

    const sql = getDb();
    await sql`
      INSERT INTO mc_live_agents (id, session_key, name, emoji, role, model, task_summary, task_id, status, started_at, updated_at)
      VALUES (
        ${id},
        ${session_key || null},
        ${name},
        ${emoji || '🤖'},
        ${role || 'Sub-Agent'},
        ${model || null},
        ${task_summary || null},
        ${task_id || null},
        'active',
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        emoji = EXCLUDED.emoji,
        role = EXCLUDED.role,
        model = EXCLUDED.model,
        task_summary = EXCLUDED.task_summary,
        task_id = EXCLUDED.task_id,
        status = 'active',
        started_at = EXCLUDED.started_at,
        updated_at = NOW()
    `;

    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error("POST /api/factory/agents error:", e);
    return NextResponse.json({ error: "Failed to register agent" }, { status: 500 });
  }
}

// PATCH — Update agent status or character config
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, completed_at, character_config } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const sql = getDb();

    // Update character_config if provided
    if (character_config) {
      await sql`
        UPDATE mc_factory_agents
        SET character_config = ${JSON.stringify(character_config)}::jsonb,
            updated_at = NOW()
        WHERE id = ${id}
      `;
    }

    // Update status if provided
    if (status) {
      await sql`
        UPDATE mc_factory_agents
        SET status = ${status},
            updated_at = NOW()
        WHERE id = ${id}
      `;
      // Also update legacy table
      await sql`
        UPDATE mc_live_agents
        SET status = ${status},
            completed_at = ${completed_at || new Date().toISOString()},
            updated_at = NOW()
        WHERE id = ${id}
      `.catch(() => {});
    }

    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error("PATCH /api/factory/agents error:", e);
    return NextResponse.json({ error: "Failed to update agent" }, { status: 500 });
  }
}

// DELETE — Cleanup old completed agents (completed > 1 hour ago)
export async function DELETE() {
  try {
    const sql = getDb();
    const result = await sql`
      DELETE FROM mc_live_agents
      WHERE status IN ('completed', 'failed')
        AND completed_at < NOW() - interval '1 hour'
    `;

    return NextResponse.json({ success: true, deleted: result.length });
  } catch (e) {
    console.error("DELETE /api/factory/agents error:", e);
    return NextResponse.json({ error: "Failed to cleanup agents" }, { status: 500 });
  }
}
