import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const ALL_TABLES = [
  "mc_tasks",
  "mc_team",
  "mc_factory_agents",
  "mc_agent_inbox",
  "mc_flips",
  "mc_activity",
  "mc_chat_messages",
  "mc_cron",
  "mc_docs",
  "mc_heartbeat",
  "mc_memory_files",
  "mc_notes",
  "mc_projects",
  "mc_requests",
  "mc_scanner",
  "mc_scanner_rules",
  "mc_deal_log",
  "mc_rd_memos",
  "mc_rd_status",
  "mc_email_events",
  "mc_live_agents",
  "mc_agent_status",
];

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    return NextResponse.json({
      connected: false,
      db_connected: false,
      error: "DATABASE_URL is not set",
      tables: ALL_TABLES.map((t) => ({ table: t, exists: false, rows: 0 })),
      instance: process.env.NEXT_PUBLIC_INSTANCE || "personal",
    });
  }

  try {
    const sql = getDb();

    // Get existing mc_ tables
    const existingRows = await sql`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename LIKE 'mc_%'
    `;
    const existingSet = new Set(existingRows.map((r: Record<string, unknown>) => r.tablename as string));

    // Build table list with existence and row counts
    const tableList: { table: string; exists: boolean; rows: number }[] = [];
    const tablesMap: Record<string, { exists: boolean; rows: number }> = {};

    for (const table of ALL_TABLES) {
      if (existingSet.has(table)) {
        let rows = 0;
        try {
          const countResult = await sql.query(`SELECT COUNT(*)::int AS cnt FROM "${table}"`);
          rows = countResult.rows?.[0]?.cnt ?? countResult[0]?.cnt ?? 0;
          rows = Number(rows);
        } catch {
          rows = 0;
        }
        tableList.push({ table, exists: true, rows });
        tablesMap[table] = { exists: true, rows };
      } else {
        tableList.push({ table, exists: false, rows: 0 });
        tablesMap[table] = { exists: false, rows: 0 };
      }
    }

    return NextResponse.json({
      connected: true,
      db_connected: true,
      tables: tableList,
      tablesMap,
      instance: process.env.NEXT_PUBLIC_INSTANCE || "personal",
    });
  } catch (e) {
    console.error("GET /api/setup/status error:", e);
    return NextResponse.json({
      connected: false,
      db_connected: false,
      error: String(e),
      tables: ALL_TABLES.map((t) => ({ table: t, exists: false, rows: 0 })),
      instance: process.env.NEXT_PUBLIC_INSTANCE || "personal",
    });
  }
}
