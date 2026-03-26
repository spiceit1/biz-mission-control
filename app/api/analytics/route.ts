import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    // Build date filter
    const fromDate = from || "2020-01-01";
    const toDate = to || "2099-12-31";

    // Total summary
    const summary = await db`
      SELECT 
        COUNT(*)::int as total_calls,
        COALESCE(SUM(total_tokens), 0)::bigint as total_tokens,
        COALESCE(SUM(input_tokens), 0)::bigint as total_input,
        COALESCE(SUM(output_tokens), 0)::bigint as total_output,
        COALESCE(SUM(cache_read_tokens), 0)::bigint as total_cache_read,
        COALESCE(SUM(cache_write_tokens), 0)::bigint as total_cache_write,
        COALESCE(SUM(cost_total), 0)::numeric as total_cost,
        COUNT(DISTINCT session_id)::int as total_sessions
      FROM mc_token_usage
      WHERE created_at >= ${fromDate} AND created_at <= ${toDate + "T23:59:59Z"}
    `;

    // By model
    const byModel = await db`
      SELECT 
        model,
        COUNT(*)::int as calls,
        COALESCE(SUM(total_tokens), 0)::bigint as tokens,
        COALESCE(SUM(cost_total), 0)::numeric as cost,
        COALESCE(AVG(cost_total), 0)::numeric as avg_cost_per_call,
        COUNT(DISTINCT session_id)::int as sessions
      FROM mc_token_usage
      WHERE created_at >= ${fromDate} AND created_at <= ${toDate + "T23:59:59Z"}
      GROUP BY model
      ORDER BY cost DESC
    `;

    // By session type
    const bySessionType = await db`
      SELECT 
        session_type,
        COUNT(*)::int as calls,
        COALESCE(SUM(total_tokens), 0)::bigint as tokens,
        COALESCE(SUM(cost_total), 0)::numeric as cost,
        COUNT(DISTINCT session_id)::int as sessions
      FROM mc_token_usage
      WHERE created_at >= ${fromDate} AND created_at <= ${toDate + "T23:59:59Z"}
      GROUP BY session_type
      ORDER BY cost DESC
    `;

    // Daily cost trend
    const dailyCost = await db`
      SELECT 
        DATE(created_at AT TIME ZONE 'America/New_York') as day,
        COUNT(*)::int as calls,
        COALESCE(SUM(total_tokens), 0)::bigint as tokens,
        COALESCE(SUM(cost_total), 0)::numeric as cost
      FROM mc_token_usage
      WHERE created_at >= ${fromDate} AND created_at <= ${toDate + "T23:59:59Z"}
      GROUP BY DATE(created_at AT TIME ZONE 'America/New_York')
      ORDER BY day DESC
      LIMIT 30
    `;

    // Hourly distribution (for today or selected range)
    const hourly = await db`
      SELECT 
        EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/New_York')::int as hour,
        COUNT(*)::int as calls,
        COALESCE(SUM(cost_total), 0)::numeric as cost
      FROM mc_token_usage
      WHERE created_at >= ${fromDate} AND created_at <= ${toDate + "T23:59:59Z"}
      GROUP BY EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/New_York')
      ORDER BY hour
    `;

    // Top sessions by cost
    const topSessions = await db`
      SELECT 
        session_id,
        session_type,
        model,
        COUNT(*)::int as calls,
        COALESCE(SUM(total_tokens), 0)::bigint as tokens,
        COALESCE(SUM(cost_total), 0)::numeric as cost,
        MIN(created_at) as started_at,
        MAX(created_at) as ended_at
      FROM mc_token_usage
      WHERE created_at >= ${fromDate} AND created_at <= ${toDate + "T23:59:59Z"}
      GROUP BY session_id, session_type, model
      ORDER BY cost DESC
      LIMIT 20
    `;

    // Model cost breakdown over time (daily by model)
    const modelDaily = await db`
      SELECT 
        DATE(created_at AT TIME ZONE 'America/New_York') as day,
        model,
        COALESCE(SUM(cost_total), 0)::numeric as cost,
        COALESCE(SUM(total_tokens), 0)::bigint as tokens
      FROM mc_token_usage
      WHERE created_at >= ${fromDate} AND created_at <= ${toDate + "T23:59:59Z"}
      GROUP BY DATE(created_at AT TIME ZONE 'America/New_York'), model
      ORDER BY day DESC, cost DESC
      LIMIT 90
    `;

    // Last sync info
    const lastSync = await db`
      SELECT MAX(created_at) as last_record, COUNT(*)::int as total_records
      FROM mc_token_usage
    `;

    return NextResponse.json({
      summary: summary[0],
      byModel,
      bySessionType,
      dailyCost,
      hourly,
      topSessions,
      modelDaily,
      lastSync: lastSync[0],
      dateRange: { from: fromDate, to: toDate },
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
