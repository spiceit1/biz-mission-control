#!/usr/bin/env node
/**
 * Token Usage Sync Script
 * 
 * Parses OpenClaw session JSONL files from the local Mac mini
 * and writes per-call token/cost records to Neon DB (mc_token_usage).
 * 
 * Skips already-synced sessions. Safe to run repeatedly.
 * 
 * Usage: node scripts/sync-tokens.mjs
 */

import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";

const DB_URL = "postgresql://neondb_owner:npg_l7AsJZCRPr8b@ep-bold-sea-am24aepe-pooler.c-5.us-east-1.aws.neon.tech/neondb";
const SESSIONS_DIR = path.join(process.env.HOME || "/Users/douglasdweck", ".openclaw/agents/main/sessions");

const sql = neon(DB_URL);

function classifySession(firstLine) {
  try {
    const meta = JSON.parse(firstLine);
    const id = meta.id || "";
    if (id.includes("cron")) return { type: "cron", agentId: "paul" };
    if (id.includes("heartbeat")) return { type: "heartbeat", agentId: "paul" };
    if (id.includes("subagent")) return { type: "subagent", agentId: "paul" };
    if (id.includes("discord")) return { type: "discord", agentId: "paul" };
    if (id.includes("telegram")) return { type: "telegram", agentId: "paul" };
    if (id.includes("signal")) return { type: "signal", agentId: "paul" };
  } catch {}
  return { type: "session", agentId: "paul" };
}

async function main() {
  console.log("🔄 Token Usage Sync");
  console.log(`   Sessions dir: ${SESSIONS_DIR}`);

  if (!fs.existsSync(SESSIONS_DIR)) {
    console.error("❌ Sessions directory not found:", SESSIONS_DIR);
    process.exit(1);
  }

  // Get already-synced session IDs
  const existing = await sql`SELECT DISTINCT session_id FROM mc_token_usage`;
  const existingSet = new Set(existing.map(r => r.session_id));
  console.log(`   Already synced: ${existingSet.size} sessions`);

  const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith(".jsonl"));
  console.log(`   Total JSONL files: ${files.length}`);

  let totalRecords = 0;
  let newSessions = 0;
  let skipped = 0;

  for (const file of files) {
    const sessionId = file.replace(".jsonl", "");

    if (existingSet.has(sessionId)) {
      skipped++;
      continue;
    }

    const filePath = path.join(SESSIONS_DIR, file);
    let content;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    const lines = content.split("\n").filter(Boolean);
    if (lines.length === 0) continue;

    const { type: sessionType, agentId } = classifySession(lines[0]);
    let sessionRecords = 0;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type !== "message") continue;

        const msg = entry.message;
        if (!msg || !msg.usage) continue;

        const usage = msg.usage;
        if (!usage.totalTokens || usage.totalTokens === 0) continue;

        const cost = usage.cost || {};
        const timestamp = entry.timestamp || new Date().toISOString();
        const model = msg.model || "unknown";

        await sql`INSERT INTO mc_token_usage (
            session_id, session_type, agent_id, model,
            input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, total_tokens,
            cost_input, cost_output, cost_cache_read, cost_cache_write, cost_total,
            created_at
          ) VALUES (
            ${sessionId}, ${sessionType}, ${agentId}, ${model},
            ${usage.input || 0}, ${usage.output || 0}, ${usage.cacheRead || 0}, ${usage.cacheWrite || 0}, ${usage.totalTokens || 0},
            ${cost.input || 0}, ${cost.output || 0}, ${cost.cacheRead || 0}, ${cost.cacheWrite || 0}, ${cost.total || 0},
            ${timestamp}
          )`;
        sessionRecords++;
      } catch {
        // skip malformed
      }
    }

    if (sessionRecords > 0) {
      newSessions++;
      totalRecords += sessionRecords;
    }
  }

  // Update sync timestamp
  await sql`INSERT INTO mc_settings (key, value, updated_at) VALUES ('token_sync_at', ${new Date().toISOString()}, NOW())
     ON CONFLICT (key) DO UPDATE SET value = ${new Date().toISOString()}, updated_at = NOW()`;

  console.log(`\n✅ Done!`);
  console.log(`   New sessions: ${newSessions}`);
  console.log(`   Records inserted: ${totalRecords}`);
  console.log(`   Skipped (already synced): ${skipped}`);
}

main().catch(e => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
