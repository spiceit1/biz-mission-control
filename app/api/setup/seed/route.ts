import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const sql = getDb();

    const results: { table: string; action: string; detail?: string }[] = [];
    const seededTables: string[] = [];

    // mc_team
    const teamResult = await sql`
      INSERT INTO mc_team (id, data)
      VALUES ('config', '{"agents":[]}'::jsonb)
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    if (teamResult.length > 0) {
      results.push({ table: "mc_team", action: "seeded", detail: "agents: []" });
      seededTables.push("mc_team");
    } else {
      results.push({ table: "mc_team", action: "skipped", detail: "already has data" });
    }

    // mc_scanner_rules
    const rulesResult = await sql`
      INSERT INTO mc_scanner_rules (id)
      VALUES ('default')
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    if (rulesResult.length > 0) {
      results.push({ table: "mc_scanner_rules", action: "seeded", detail: "all defaults applied" });
      seededTables.push("mc_scanner_rules");
    } else {
      results.push({ table: "mc_scanner_rules", action: "skipped", detail: "already has data" });
    }

    // mc_rd_status
    const rdResult = await sql`
      INSERT INTO mc_rd_status (id, data)
      VALUES ('config', '{}'::jsonb)
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    if (rdResult.length > 0) {
      results.push({ table: "mc_rd_status", action: "seeded", detail: "empty config" });
      seededTables.push("mc_rd_status");
    } else {
      results.push({ table: "mc_rd_status", action: "skipped", detail: "already has data" });
    }

    // mc_cron
    const cronResult = await sql`
      INSERT INTO mc_cron (id, data)
      VALUES ('config', '{"jobs":[]}'::jsonb)
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    if (cronResult.length > 0) {
      results.push({ table: "mc_cron", action: "seeded", detail: "jobs: []" });
      seededTables.push("mc_cron");
    } else {
      results.push({ table: "mc_cron", action: "skipped", detail: "already has data" });
    }

    const seededCount = seededTables.length;
    const skippedCount = results.length - seededCount;

    return NextResponse.json({
      ok: true,
      success: true,
      instance: process.env.NEXT_PUBLIC_INSTANCE || "personal",
      summary: `${seededCount} table${seededCount !== 1 ? "s" : ""} seeded, ${skippedCount} skipped`,
      seeded: seededCount,
      seededTables,
      skipped: skippedCount,
      results,
    });
  } catch (e) {
    console.error("POST /api/setup/seed error:", e);
    return NextResponse.json(
      {
        ok: false,
        success: false,
        error: String(e),
        results: [],
        seeded: 0,
        skipped: 0,
      },
      { status: 500 }
    );
  }
}
