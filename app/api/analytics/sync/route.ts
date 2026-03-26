import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

interface UsageRecord {
  session_id: string;
  session_type: string;
  agent_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  total_tokens: number;
  cost_input: number;
  cost_output: number;
  cost_cache_read: number;
  cost_cache_write: number;
  cost_total: number;
  timestamp: string;
}

function classifySession(sessionId: string, firstLine: string): { type: string; agentId: string } {
  // Try to extract session key from the JSONL metadata
  try {
    const meta = JSON.parse(firstLine);
    const id = meta.id || sessionId;
    // Session key patterns in OpenClaw:
    // agent:main:discord:channel:xxx = discord chat
    // agent:main:telegram:xxx = telegram chat  
    // agent:main:cron:xxx = cron job
    // agent:main:heartbeat = heartbeat
    // agent:main:subagent:xxx = sub-agent
    if (id.includes("cron")) return { type: "cron", agentId: "paul" };
    if (id.includes("heartbeat")) return { type: "heartbeat", agentId: "paul" };
    if (id.includes("subagent")) return { type: "subagent", agentId: "paul" };
    if (id.includes("discord")) return { type: "discord", agentId: "paul" };
    if (id.includes("telegram")) return { type: "telegram", agentId: "paul" };
    if (id.includes("signal")) return { type: "signal", agentId: "paul" };
  } catch {
    // ignore
  }
  return { type: "session", agentId: "paul" };
}

export async function POST() {
  try {
    const sessionsDir = path.join(
      process.env.HOME || "/Users/douglasdweck",
      ".openclaw/agents/main/sessions"
    );

    if (!fs.existsSync(sessionsDir)) {
      return NextResponse.json({ error: "Sessions directory not found" }, { status: 404 });
    }

    const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".jsonl"));
    const db = getDb();

    // Get existing synced session IDs to avoid re-processing
    const existingRows = await db`SELECT DISTINCT session_id FROM mc_token_usage`;
    const existingSessionIds = new Set(existingRows.map((r: { session_id: string }) => r.session_id));

    let totalRecords = 0;
    let newSessions = 0;
    let skippedSessions = 0;
    const allRecords: UsageRecord[] = [];

    for (const file of files) {
      const sessionId = file.replace(".jsonl", "");
      
      // Skip already synced sessions
      if (existingSessionIds.has(sessionId)) {
        skippedSessions++;
        continue;
      }

      const filePath = path.join(sessionsDir, file);
      let content: string;
      try {
        content = fs.readFileSync(filePath, "utf-8");
      } catch {
        continue;
      }

      const lines = content.split("\n").filter(Boolean);
      if (lines.length === 0) continue;

      const { type: sessionType, agentId } = classifySession(sessionId, lines[0]);
      newSessions++;

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

          allRecords.push({
            session_id: sessionId,
            session_type: sessionType,
            agent_id: agentId,
            model,
            input_tokens: usage.input || 0,
            output_tokens: usage.output || 0,
            cache_read_tokens: usage.cacheRead || 0,
            cache_write_tokens: usage.cacheWrite || 0,
            total_tokens: usage.totalTokens || 0,
            cost_input: cost.input || 0,
            cost_output: cost.output || 0,
            cost_cache_read: cost.cacheRead || 0,
            cost_cache_write: cost.cacheWrite || 0,
            cost_total: cost.total || 0,
            timestamp,
          });
        } catch {
          // skip malformed lines
        }
      }
    }

    // Batch insert in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < allRecords.length; i += chunkSize) {
      const chunk = allRecords.slice(i, i + chunkSize);
      for (const r of chunk) {
        await db`
          INSERT INTO mc_token_usage (
            session_id, session_type, agent_id, model,
            input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, total_tokens,
            cost_input, cost_output, cost_cache_read, cost_cache_write, cost_total,
            created_at
          ) VALUES (
            ${r.session_id}, ${r.session_type}, ${r.agent_id}, ${r.model},
            ${r.input_tokens}, ${r.output_tokens}, ${r.cache_read_tokens}, ${r.cache_write_tokens}, ${r.total_tokens},
            ${r.cost_input}, ${r.cost_output}, ${r.cost_cache_read}, ${r.cost_cache_write}, ${r.cost_total},
            ${r.timestamp}
          )
        `;
      }
      totalRecords += chunk.length;
    }

    return NextResponse.json({
      success: true,
      totalRecords,
      newSessions,
      skippedSessions,
      totalFiles: files.length,
    });
  } catch (error) {
    console.error("Token sync error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
