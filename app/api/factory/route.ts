import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getDb();

    const [taskRows, teamRows, scannerRows, liveAgentRows, agentStatusRows] = await Promise.all([
      sql`SELECT * FROM mc_tasks ORDER BY created_at DESC`,
      sql`SELECT data FROM mc_team WHERE id = 'config' LIMIT 1`,
      sql`SELECT * FROM mc_scanner WHERE id = 'config' LIMIT 1`,
      sql`SELECT * FROM mc_factory_agents
          WHERE status IN ('active', 'running', 'standby', 'idle')
            OR (status = 'completed' AND updated_at > NOW() - interval '24 hours')
            OR (status = 'failed' AND updated_at > NOW() - interval '24 hours')
          ORDER BY created_at DESC`,
      sql`SELECT * FROM mc_agent_status`,
    ]);

    interface TaskRow {
      id: string;
      title: string;
      description?: string;
      status: string;
      priority: string;
      assignee: string;
      createdAt?: string;
      updatedAt?: string;
    }
    const tasks: TaskRow[] = taskRows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      title: r.title as string,
      description: r.description as string | undefined,
      status: r.status as string,
      priority: r.priority as string,
      assignee: r.assignee as string,
      createdAt: r.created_at as string | undefined,
      updatedAt: r.updated_at as string | undefined,
    }));

    const teamData = teamRows.length > 0 ? (teamRows[0].data as Record<string, unknown>) : { agents: [] };
    const rawAgents = (teamData.agents as Record<string, unknown>[]) || [];

    // Build a lookup from mc_agent_status
    const statusMap: Record<string, { status: string; statusText: string | null }> = {};
    for (const row of agentStatusRows) {
      statusMap[row.agent_id as string] = {
        status: row.status as string,
        statusText: row.status_text as string | null,
      };
    }

    // Merge real status into roster agents
    const agents = rawAgents.map((a) => {
      const id = a.id as string;
      const override = statusMap[id];
      if (override) {
        return { ...a, status: override.status, statusText: override.statusText };
      }
      return { ...a, statusText: null };
    });

    const scannerRow = scannerRows.length > 0 ? scannerRows[0] : null;
    const scanner = scannerRow
      ? {
          lastScan: scannerRow.last_scan,
          status: scannerRow.status,
          nextScanMins: scannerRow.next_scan_mins,
        }
      : { lastScan: null, status: "unknown", nextScanMins: null };

    const liveAgents = liveAgentRows.map((r: Record<string, unknown>) => ({
      id: r.id,
      sessionKey: r.session_key,
      name: r.name,
      emoji: r.emoji || '🤖',
      role: r.role || 'Sub-Agent',
      model: r.model,
      status: r.status,
      taskSummary: r.task_summary,
      taskId: r.task_id,
      startedAt: r.started_at || r.created_at,
      completedAt: r.completed_at || (r.status === 'completed' ? r.updated_at : null),
      updatedAt: r.updated_at,
      characterConfig: r.character_config || {},
    }));

    // Compute stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const completedTasksToday = tasks.filter((t) => {
      if (t.status !== "done") return false;
      const date = new Date(t.updatedAt || t.createdAt || "");
      return date >= today;
    }).length;

    const completedAgentsToday = liveAgents.filter((a: Record<string, unknown>) => {
      if (a.status !== "completed") return false;
      const date = new Date((a.updatedAt || a.createdAt || "") as string);
      return date >= today;
    }).length;

    const completedToday = completedTasksToday + completedAgentsToday;

    const activeTasks = tasks.filter(
      (t) => t.status === "in-progress" || t.status === "in-review"
    ).length;

    // Count all visible agents: factory agents + team dedicated agents (standby/scheduled)
    const teamDedicated = agents.filter(
      (a: Record<string, unknown>) => a.status === "standby" || a.status === "scheduled"
    ).length;

    const allActive = liveAgents.filter(
      (a: Record<string, unknown>) => a.status === "active"
    ).length;

    const allIdle = liveAgents.filter(
      (a: Record<string, unknown>) => a.status === "idle"
    ).length;

    const allCompleted = liveAgents.filter(
      (a: Record<string, unknown>) => a.status === "completed"
    ).length;

    // Total = all factory agents (active + idle + completed) + team dedicated (standby + scheduled)
    const totalVisible = allActive + allIdle + allCompleted + teamDedicated;

    return NextResponse.json({
      tasks,
      agents,
      liveAgents,
      scanner,
      stats: {
        activeTasks,
        completedToday,
        activeAgents: allActive,
        totalAgents: totalVisible,
        liveAgentCount: allActive,
      },
    });
  } catch (e) {
    console.error("GET /api/factory error:", e);
    return NextResponse.json({ error: "Failed to read factory data" }, { status: 500 });
  }
}
