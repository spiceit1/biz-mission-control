import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getDb();

    const [
      agentRows,
      taskRows,
      heartbeatRows,
      cronRows,
      docRows,
      memoryRows,
      activityRows,
    ] = await Promise.all([
      sql`SELECT id, name, emoji, role, model, status, task_summary, updated_at FROM mc_factory_agents`,
      sql`SELECT id, title, status, priority, assignee, agent_id, updated_at FROM mc_tasks ORDER BY updated_at DESC`,
      sql`SELECT id, timestamp, type, summary, task_name FROM mc_heartbeat ORDER BY timestamp DESC LIMIT 50`,
      sql`SELECT data FROM mc_cron WHERE id = 'config' LIMIT 1`,
      sql`SELECT id, title, last_modified FROM mc_docs ORDER BY last_modified DESC`,
      sql`SELECT id, filename, last_modified FROM mc_memory_files ORDER BY last_modified DESC`,
      sql`SELECT id, data, created_at FROM mc_activity ORDER BY created_at DESC LIMIT 10`,
    ]);

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Agent counts
    const activeAgents = agentRows.filter((a: Record<string, unknown>) =>
      ["active", "running"].includes(a.status as string)
    ).length;
    const needsReviewAgents = agentRows.filter(
      (a: Record<string, unknown>) => a.status === "needs_review"
    ).length;
    const totalAgents = agentRows.length;

    // Failed heartbeats in last 24h
    const failedJobs24h = heartbeatRows.filter((h: Record<string, unknown>) => {
      const ts = new Date(h.timestamp as string);
      return h.type === "error" && ts >= last24h;
    }).length;

    // Task breakdown
    const tasksByStatus: Record<string, number> = {};
    for (const t of taskRows) {
      const s = t.status as string;
      tasksByStatus[s] = (tasksByStatus[s] || 0) + 1;
    }

    // Docs changed today
    const docsChangedToday = docRows.filter((d: Record<string, unknown>) => {
      const lm = d.last_modified ? new Date(d.last_modified as string) : null;
      return lm && lm >= todayStart;
    }).length;

    // Memory changed today
    const memoryChangedToday = memoryRows.filter((m: Record<string, unknown>) => {
      const lm = m.last_modified ? new Date(m.last_modified as string) : null;
      return lm && lm >= todayStart;
    }).length;

    // Cron jobs due soon (next 1 hour)
    let cronJobsDueSoon = 0;
    let totalCronJobs = 0;
    if (cronRows.length > 0) {
      const data = cronRows[0].data as { jobs?: Record<string, unknown>[] };
      const jobs = data.jobs || [];
      totalCronJobs = jobs.length;
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      for (const job of jobs) {
        const state = job.state as Record<string, unknown> | undefined;
        const nextRunMs = state?.nextRunAtMs as number | undefined;
        if (nextRunMs) {
          const nextRun = new Date(nextRunMs);
          if (nextRun <= oneHourFromNow && nextRun >= now) {
            cronJobsDueSoon++;
          }
        }
      }
    }

    // Recent activity
    const recentActivity = activityRows.map((r: Record<string, unknown>) => ({
      ...(r.data as Record<string, unknown>),
      createdAt: r.created_at,
    }));

    // Agent status cards
    const agentCards = agentRows.map((a: Record<string, unknown>) => ({
      id: a.id,
      name: a.name,
      emoji: a.emoji,
      role: a.role,
      model: a.model,
      status: a.status,
      taskSummary: a.task_summary,
      updatedAt: a.updated_at,
    }));

    return NextResponse.json({
      metrics: {
        activeAgents,
        needsReviewAgents,
        totalAgents,
        failedJobs24h,
        cronJobsDueSoon,
        totalCronJobs,
        docsChangedToday,
        totalDocs: docRows.length,
        memoryChangedToday,
        totalMemoryFiles: memoryRows.length,
        tasksByStatus,
        totalTasks: taskRows.length,
      },
      recentActivity,
      agentCards,
      recentTasks: taskRows.slice(0, 5).map((t: Record<string, unknown>) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        assignee: t.assignee,
        updatedAt: t.updated_at,
      })),
    });
  } catch (e) {
    console.error("GET /api/overview error:", e);
    return NextResponse.json({ error: "Failed to load overview" }, { status: 500 });
  }
}
