import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

// POST /api/analytics/sync — returns instructions since sync must run locally
// The actual sync is done by scripts/sync-tokens.mjs on the Mac mini
export async function POST() {
  try {
    const db = getDb();
    
    // Return current sync status
    const lastSync = await db`
      SELECT value FROM mc_settings WHERE key = 'token_sync_at'
    `;
    const totalRecords = await db`
      SELECT COUNT(*)::int as count FROM mc_token_usage
    `;
    const sessions = await db`
      SELECT COUNT(DISTINCT session_id)::int as count FROM mc_token_usage
    `;

    return NextResponse.json({
      message: "Token sync runs locally on the Mac mini. Use the button to trigger it via the agent, or run: node scripts/sync-tokens.mjs",
      lastSyncAt: lastSync[0]?.value || null,
      totalRecords: totalRecords[0]?.count || 0,
      totalSessions: sessions[0]?.count || 0,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
