#!/usr/bin/env node
/**
 * Token Usage Watcher Daemon
 * 
 * Watches OpenClaw session JSONL files for changes and pushes
 * token/cost records to Neon DB in near-real-time.
 * 
 * Architecture:
 * - Uses chokidar for reliable file watching
 * - Tracks byte offsets per file for incremental parsing
 * - Debounces writes to Neon (1.5s batch window)
 * - Persists state locally for restart resilience
 * - Runs periodic reconciliation every 5 minutes
 * - Maintains both per-call records and aggregated rollups
 * 
 * Run: node services/token-watcher.mjs
 * PM2: pm2 start services/token-watcher.mjs --name token-watcher
 */

import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import chokidar from "chokidar";
import { neon } from "@neondatabase/serverless";

// ─── Config ──────────────────────────────────────────────────────────
const DB_URL = "postgresql://neondb_owner:npg_l7AsJZCRPr8b@ep-bold-sea-am24aepe-pooler.c-5.us-east-1.aws.neon.tech/neondb";
const SESSIONS_DIR = path.join(process.env.HOME || "/Users/douglasdweck", ".openclaw/agents/main/sessions");
const STATE_FILE = path.join(process.env.HOME || "/Users/douglasdweck", ".openclaw/workspace/biz-mission-control/services/.token-watcher-state.json");
const DEBOUNCE_MS = 1500;
const RECONCILE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const sql = neon(DB_URL);

// ─── State Management ────────────────────────────────────────────────
/** 
 * State shape: {
 *   files: {
 *     [filePath]: {
 *       offset: number,        // byte offset we've read up to
 *       size: number,          // last known file size
 *       mtime: number,         // last modified timestamp (ms)
 *       inode: number,         // inode for detecting replacement
 *       recordCount: number,   // records extracted from this file
 *     }
 *   },
 *   lastReconcile: number,     // timestamp of last reconciliation
 * }
 */
let state = { files: {}, lastReconcile: 0 };

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
      console.log(`📂 Loaded state: tracking ${Object.keys(state.files).length} files`);
    }
  } catch (e) {
    console.warn("⚠️  Could not load state, starting fresh:", e.message);
    state = { files: {}, lastReconcile: 0 };
  }
}

function saveState() {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error("❌ Failed to save state:", e.message);
  }
}

// ─── Session Classification ──────────────────────────────────────────
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

function extractSessionId(filePath) {
  const basename = path.basename(filePath);
  // Handle: uuid.jsonl, uuid.jsonl.deleted.timestamp, uuid.jsonl.reset.timestamp
  const match = basename.match(/^([0-9a-f-]{36})/);
  return match ? match[1] : basename.replace(/\.jsonl.*$/, "");
}

function isSessionFile(filePath) {
  const basename = path.basename(filePath);
  return basename.includes(".jsonl");
}

// ─── Parsing ─────────────────────────────────────────────────────────
function parseUsageRecords(newContent, sessionId, filePath) {
  const records = [];
  const lines = newContent.split("\n").filter(Boolean);

  // Get session classification from first line if we haven't seen this file
  let sessionType = "session";
  let agentId = "paul";

  // Try to read first line of file for classification
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(2048);
    const bytesRead = fs.readSync(fd, buf, 0, 2048, 0);
    fs.closeSync(fd);
    const firstLine = buf.toString("utf-8", 0, bytesRead).split("\n")[0];
    const cls = classifySession(firstLine);
    sessionType = cls.type;
    agentId = cls.agentId;
  } catch {}

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== "message") continue;

      const msg = entry.message;
      if (!msg?.usage?.totalTokens) continue;

      const usage = msg.usage;
      const cost = usage.cost || {};
      
      // Create a deterministic hash for upsert dedup
      const hash = createHash("md5")
        .update(`${sessionId}:${entry.timestamp}:${usage.totalTokens}:${msg.model || ""}`)
        .digest("hex")
        .substring(0, 16);

      records.push({
        hash,
        session_id: sessionId,
        session_type: sessionType,
        agent_id: agentId,
        model: msg.model || "unknown",
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
        timestamp: entry.timestamp || new Date().toISOString(),
      });
    } catch {
      // skip malformed lines
    }
  }

  return records;
}

// ─── Batched Write to Neon ──────────────────────────────────────────
let pendingRecords = [];
let writeTimer = null;

function queueRecords(records) {
  pendingRecords.push(...records);
  
  // Debounce: flush after DEBOUNCE_MS of no new records
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(flushRecords, DEBOUNCE_MS);
}

async function flushRecords() {
  if (pendingRecords.length === 0) return;

  const batch = pendingRecords.splice(0);
  const startTime = Date.now();

  try {
    // Insert records with hash-based dedup
    for (const r of batch) {
      await sql`
        INSERT INTO mc_token_usage (
          record_hash, session_id, session_type, agent_id, model,
          input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, total_tokens,
          cost_input, cost_output, cost_cache_read, cost_cache_write, cost_total,
          created_at
        ) VALUES (
          ${r.hash}, ${r.session_id}, ${r.session_type}, ${r.agent_id}, ${r.model},
          ${r.input_tokens}, ${r.output_tokens}, ${r.cache_read_tokens}, ${r.cache_write_tokens}, ${r.total_tokens},
          ${r.cost_input}, ${r.cost_output}, ${r.cost_cache_read}, ${r.cost_cache_write}, ${r.cost_total},
          ${r.timestamp}
        )
        ON CONFLICT (record_hash) DO NOTHING
      `;
    }

    // Update aggregated rollups incrementally
    await updateAggregates(batch);

    // Update sync timestamp
    await sql`
      INSERT INTO mc_settings (key, value, updated_at) 
      VALUES ('token_sync_at', ${new Date().toISOString()}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${new Date().toISOString()}, updated_at = NOW()
    `;

    const elapsed = Date.now() - startTime;
    console.log(`💾 Flushed ${batch.length} records to Neon (${elapsed}ms)`);
  } catch (e) {
    console.error(`❌ Failed to flush ${batch.length} records:`, e.message);
    // Re-queue failed records for retry
    pendingRecords.unshift(...batch);
  }

  saveState();
}

async function updateAggregates(records) {
  // Group by session_id + model for efficient upserts
  const groups = {};
  for (const r of records) {
    const key = `${r.session_id}:${r.model}`;
    if (!groups[key]) {
      groups[key] = {
        session_id: r.session_id,
        session_type: r.session_type,
        agent_id: r.agent_id,
        model: r.model,
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        total_tokens: 0,
        cost_total: 0,
        calls: 0,
        latest_at: r.timestamp,
      };
    }
    const g = groups[key];
    g.input_tokens += r.input_tokens;
    g.output_tokens += r.output_tokens;
    g.cache_read_tokens += r.cache_read_tokens;
    g.cache_write_tokens += r.cache_write_tokens;
    g.total_tokens += r.total_tokens;
    g.cost_total += r.cost_total;
    g.calls += 1;
    if (r.timestamp > g.latest_at) g.latest_at = r.timestamp;
  }

  for (const g of Object.values(groups)) {
    await sql`
      INSERT INTO mc_token_aggregates (
        session_id, session_type, agent_id, model,
        input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, total_tokens,
        cost_total, call_count, latest_at, updated_at
      ) VALUES (
        ${g.session_id}, ${g.session_type}, ${g.agent_id}, ${g.model},
        ${g.input_tokens}, ${g.output_tokens}, ${g.cache_read_tokens}, ${g.cache_write_tokens}, ${g.total_tokens},
        ${g.cost_total}, ${g.calls}, ${g.latest_at}, NOW()
      )
      ON CONFLICT (session_id, model) DO UPDATE SET
        input_tokens = mc_token_aggregates.input_tokens + ${g.input_tokens},
        output_tokens = mc_token_aggregates.output_tokens + ${g.output_tokens},
        cache_read_tokens = mc_token_aggregates.cache_read_tokens + ${g.cache_read_tokens},
        cache_write_tokens = mc_token_aggregates.cache_write_tokens + ${g.cache_write_tokens},
        total_tokens = mc_token_aggregates.total_tokens + ${g.total_tokens},
        cost_total = mc_token_aggregates.cost_total + ${g.cost_total},
        call_count = mc_token_aggregates.call_count + ${g.calls},
        latest_at = GREATEST(mc_token_aggregates.latest_at, ${g.latest_at}),
        updated_at = NOW()
    `;
  }
}

// ─── File Processing ─────────────────────────────────────────────────
function processFile(filePath) {
  if (!isSessionFile(filePath)) return;

  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return; // file may have been deleted
  }

  const sessionId = extractSessionId(filePath);
  const fileState = state.files[filePath] || { offset: 0, size: 0, mtime: 0, inode: 0, recordCount: 0 };

  // Detect file replacement (different inode) or truncation (smaller size)
  if (stat.ino !== fileState.inode && fileState.inode !== 0) {
    console.log(`🔄 File replaced (inode changed): ${path.basename(filePath)}`);
    fileState.offset = 0;
    fileState.recordCount = 0;
  } else if (stat.size < fileState.offset) {
    console.log(`🔄 File truncated: ${path.basename(filePath)}`);
    fileState.offset = 0;
    fileState.recordCount = 0;
  }

  // Nothing new to read
  if (stat.size <= fileState.offset) {
    state.files[filePath] = { ...fileState, size: stat.size, mtime: stat.mtimeMs, inode: stat.ino };
    return;
  }

  // Read only new bytes
  const fd = fs.openSync(filePath, "r");
  const newBytes = stat.size - fileState.offset;
  const buf = Buffer.alloc(newBytes);
  fs.readSync(fd, buf, 0, newBytes, fileState.offset);
  fs.closeSync(fd);

  const newContent = buf.toString("utf-8");
  const records = parseUsageRecords(newContent, sessionId, filePath);

  if (records.length > 0) {
    queueRecords(records);
    console.log(`📊 ${path.basename(filePath)}: ${records.length} new usage records`);
  }

  // Update state
  state.files[filePath] = {
    offset: stat.size,
    size: stat.size,
    mtime: stat.mtimeMs,
    inode: stat.ino,
    recordCount: (fileState.recordCount || 0) + records.length,
  };
}

// ─── Reconciliation ──────────────────────────────────────────────────
async function reconcile() {
  console.log("🔍 Running reconciliation scan...");
  
  let processed = 0;
  let newRecords = 0;

  try {
    const allFiles = fs.readdirSync(SESSIONS_DIR)
      .filter(f => f.includes(".jsonl"))
      .map(f => path.join(SESSIONS_DIR, f));

    for (const filePath of allFiles) {
      const before = pendingRecords.length;
      processFile(filePath);
      const added = pendingRecords.length - before;
      if (added > 0) newRecords += added;
      processed++;
    }

    // Clean up state entries for files that no longer exist
    for (const trackedPath of Object.keys(state.files)) {
      if (!fs.existsSync(trackedPath)) {
        delete state.files[trackedPath];
      }
    }

    state.lastReconcile = Date.now();
    saveState();
    
    console.log(`🔍 Reconciliation done: ${processed} files checked, ${newRecords} new records`);
  } catch (e) {
    console.error("❌ Reconciliation error:", e.message);
  }
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 Token Watcher starting...");
  console.log(`   Sessions dir: ${SESSIONS_DIR}`);
  console.log(`   State file: ${STATE_FILE}`);
  console.log(`   Debounce: ${DEBOUNCE_MS}ms`);
  console.log(`   Reconcile interval: ${RECONCILE_INTERVAL_MS / 1000}s`);

  if (!fs.existsSync(SESSIONS_DIR)) {
    console.error(`❌ Sessions directory not found: ${SESSIONS_DIR}`);
    process.exit(1);
  }

  // Ensure DB tables exist
  await ensureSchema();

  // Load persisted state
  loadState();

  // Initial reconciliation to catch up on anything missed
  await reconcile();
  // Flush any records found during initial reconciliation
  await flushRecords();

  // Start file watcher
  const watcher = chokidar.watch(SESSIONS_DIR, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100,
    },
    // Watch for .jsonl files including .deleted and .reset variants
    ignored: (p) => {
      const basename = path.basename(p);
      if (p === SESSIONS_DIR) return false;
      return !basename.includes(".jsonl");
    },
  });

  watcher
    .on("add", (filePath) => {
      console.log(`➕ New file: ${path.basename(filePath)}`);
      processFile(filePath);
    })
    .on("change", (filePath) => {
      processFile(filePath);
    })
    .on("error", (error) => {
      console.error("⚠️  Watcher error:", error.message);
    });

  console.log("👀 Watching for session file changes...\n");

  // Periodic reconciliation
  setInterval(reconcile, RECONCILE_INTERVAL_MS);

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down...");
    await flushRecords();
    saveState();
    await watcher.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\n🛑 Shutting down...");
    await flushRecords();
    saveState();
    await watcher.close();
    process.exit(0);
  });
}

async function ensureSchema() {
  console.log("🔧 Ensuring DB schema...");
  
  // Add record_hash column and unique index if not exists
  try {
    await sql`ALTER TABLE mc_token_usage ADD COLUMN IF NOT EXISTS record_hash TEXT`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_token_usage_hash ON mc_token_usage(record_hash)`;
  } catch (e) {
    console.log("   record_hash column:", e.message.includes("already exists") ? "exists" : e.message);
  }

  // Create aggregates table
  await sql`
    CREATE TABLE IF NOT EXISTS mc_token_aggregates (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      session_type TEXT DEFAULT 'session',
      agent_id TEXT DEFAULT 'paul',
      model TEXT NOT NULL,
      input_tokens BIGINT DEFAULT 0,
      output_tokens BIGINT DEFAULT 0,
      cache_read_tokens BIGINT DEFAULT 0,
      cache_write_tokens BIGINT DEFAULT 0,
      total_tokens BIGINT DEFAULT 0,
      cost_total NUMERIC DEFAULT 0,
      call_count INTEGER DEFAULT 0,
      latest_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(session_id, model)
    )
  `;

  // Indexes for aggregates
  await sql`CREATE INDEX IF NOT EXISTS idx_agg_session ON mc_token_aggregates(session_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_agg_model ON mc_token_aggregates(model)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_agg_agent ON mc_token_aggregates(agent_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_agg_type ON mc_token_aggregates(session_type)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_agg_latest ON mc_token_aggregates(latest_at)`;

  console.log("🔧 Schema ready\n");
}

main().catch((e) => {
  console.error("💀 Fatal error:", e);
  process.exit(1);
});
