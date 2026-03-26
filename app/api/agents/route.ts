import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getDb();

    const [agentRows, statusRows, heartbeatRows, taskRows] = await Promise.all([
      sql`SELECT * FROM mc_factory_agents ORDER BY created_at DESC`,
      sql`SELECT * FROM mc_agent_status`,
      sql`SELECT task_name, timestamp, type, summary FROM mc_heartbeat ORDER BY timestamp DESC LIMIT 100`,
      sql`SELECT id, title, status, agent_id, assignee FROM mc_tasks WHERE agent_id IS NOT NULL`,
    ]);

    // Build status lookup
    const statusMap: Record<string, { status: string; statusText: string | null; lastActiveAt: string | null }> = {};
    for (const row of statusRows) {
      statusMap[row.agent_id as string] = {
        status: row.status as string,
        statusText: row.status_text as string | null,
        lastActiveAt: row.last_active_at as string | null,
      };
    }

    // Build heartbeat lookup (latest per agent/task)
    const heartbeatMap: Record<string, { timestamp: string; type: string; summary: string }[]> = {};
    for (const h of heartbeatRows) {
      const name = (h.task_name as string) || "unknown";
      if (!heartbeatMap[name]) heartbeatMap[name] = [];
      if (heartbeatMap[name].length < 5) {
        heartbeatMap[name].push({
          timestamp: h.timestamp as string,
          type: h.type as string,
          summary: h.summary as string,
        });
      }
    }

    // Build task lookup per agent
    const taskMap: Record<string, { id: string; title: string; status: string }[]> = {};
    for (const t of taskRows) {
      const agentId = t.agent_id as string;
      if (!taskMap[agentId]) taskMap[agentId] = [];
      taskMap[agentId].push({
        id: t.id as string,
        title: t.title as string,
        status: t.status as string,
      });
    }

    const agents = agentRows.map((a: Record<string, unknown>) => {
      const id = a.id as string;
      const override = statusMap[id];
      return {
        id,
        sessionKey: a.session_key,
        name: a.name,
        emoji: a.emoji || "🤖",
        role: a.role || "Sub-Agent",
        model: a.model,
        status: override?.status || (a.status as string),
        statusText: override?.statusText || null,
        taskSummary: a.task_summary,
        startedAt: a.created_at,
        updatedAt: a.updated_at,
        lastActiveAt: override?.lastActiveAt || null,
        characterConfig: a.character_config || {},
        recentHeartbeats: heartbeatMap[a.name as string] || [],
        tasks: taskMap[id] || [],
      };
    });

    return NextResponse.json({ agents });
  } catch (e) {
    console.error("GET /api/agents error:", e);
    return NextResponse.json({ error: "Failed to load agents" }, { status: 500 });
  }
}
