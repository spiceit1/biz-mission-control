import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getDb();

    const [taskRows, agentRows] = await Promise.all([
      sql`SELECT id, title, description, status, priority, assignee, agent_id, review_notes, updated_at
          FROM mc_tasks WHERE status = 'needs_review' OR status = 'in-review'
          ORDER BY updated_at DESC`,
      sql`SELECT id, name, emoji, role, task_summary, status, updated_at
          FROM mc_factory_agents WHERE status = 'needs_review'
          ORDER BY updated_at DESC`,
    ]);

    const items = [
      ...taskRows.map((t: Record<string, unknown>) => ({
        type: "task" as const,
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        assignee: t.assignee,
        agentId: t.agent_id,
        reviewNotes: t.review_notes,
        updatedAt: t.updated_at,
      })),
      ...agentRows.map((a: Record<string, unknown>) => ({
        type: "agent" as const,
        id: a.id,
        title: `${a.emoji || "🤖"} ${a.name} needs review`,
        description: a.task_summary,
        status: a.status,
        role: a.role,
        updatedAt: a.updated_at,
      })),
    ].sort((a, b) => new Date(b.updatedAt as string).getTime() - new Date(a.updatedAt as string).getTime());

    return NextResponse.json({ items, total: items.length });
  } catch (e) {
    console.error("GET /api/review error:", e);
    return NextResponse.json({ error: "Failed to load review queue" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, id, action } = body;
    const sql = getDb();

    if (type === "task") {
      const newStatus = action === "approve" ? "done" : "in-progress";
      await sql`UPDATE mc_tasks SET status = ${newStatus}, reviewed_at = NOW(), updated_at = NOW() WHERE id = ${id}`;
    } else if (type === "agent") {
      const newStatus = action === "approve" ? "idle" : "active";
      await sql`UPDATE mc_factory_agents SET status = ${newStatus}, updated_at = NOW() WHERE id = ${id}`;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/review error:", e);
    return NextResponse.json({ error: "Failed to update review" }, { status: 500 });
  }
}
