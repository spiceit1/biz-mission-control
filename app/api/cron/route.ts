import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

function normalizeJob(job: Record<string, unknown>) {
  const schedule = job.schedule as { expr?: string } | string | undefined;
  const state = job.state as Record<string, unknown> | undefined;
  return {
    ...job,
    scheduleExpr:
      typeof schedule === "string"
        ? schedule
        : schedule?.expr || "",
    lastRun: state?.lastRunAtMs
      ? new Date(state.lastRunAtMs as number).toISOString()
      : (job.lastRun ?? null),
    nextRun: state?.nextRunAtMs
      ? new Date(state.nextRunAtMs as number).toISOString()
      : (job.nextRun ?? null),
    lastStatus:
      state?.lastRunStatus === "ok"
        ? "success"
        : ((state?.lastRunStatus as string) ?? (job.lastStatus as string) ?? null),
  };
}

export async function GET() {
  try {
    const sql = getDb();
    const rows = await sql`SELECT data FROM mc_cron WHERE id = 'config' LIMIT 1`;
    if (rows.length === 0) {
      return NextResponse.json({ jobs: [] });
    }
    const data = rows[0].data as { jobs?: Record<string, unknown>[] };
    const jobs = (data.jobs || []).map(normalizeJob);
    return NextResponse.json({ jobs });
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("GET /api/cron error:", err);
    return NextResponse.json({
      error: "Could not fetch cron jobs",
      message: err.message || "Unknown error",
      jobs: [],
    });
  }
}
