import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getDb();
    const rows = await sql`SELECT * FROM mc_tasks ORDER BY created_at DESC`;
    // Map to camelCase to match frontend expectations
    const tasks = rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      priority: r.priority,
      assignee: r.assignee,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    return NextResponse.json(tasks);
  } catch (e) {
    console.error("GET /api/tasks error:", e);
    return NextResponse.json({ error: "Failed to read tasks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sql = getDb();
    const id = body.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await sql`INSERT INTO mc_tasks (id, title, description, status, priority, assignee, created_at, updated_at)
      VALUES (${id}, ${body.title}, ${body.description || null}, ${body.status || "backlog"}, ${body.priority || "medium"}, ${body.assignee || null}, ${body.createdAt || new Date().toISOString()}, NOW())`;
    return NextResponse.json({ ...body, id });
  } catch (e) {
    console.error("POST /api/tasks error:", e);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const sql = getDb();
    await sql`UPDATE mc_tasks SET
      title = ${body.title},
      description = ${body.description || null},
      status = ${body.status || "backlog"},
      priority = ${body.priority || "medium"},
      assignee = ${body.assignee || null},
      updated_at = NOW()
      WHERE id = ${body.id}`;
    return NextResponse.json(body);
  } catch (e) {
    console.error("PUT /api/tasks error:", e);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    const sql = getDb();
    await sql`DELETE FROM mc_tasks WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/tasks error:", e);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
