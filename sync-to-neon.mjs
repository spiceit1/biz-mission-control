#!/usr/bin/env node

// sync-to-neon.mjs — Syncs local filesystem data to Neon Postgres
// Run every 2 minutes via cron:
//   openclaw cron add --name "neon-sync" --schedule "*/2 * * * *" --command "node sync-to-neon.mjs"

import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_QW2a7wnADpOs@ep-dry-term-advgll07-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);

const WORKSPACE = "/Users/douglasdweck/.openclaw/workspace";

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

async function syncMemoryFiles() {
  console.log("[sync] Memory files...");
  let count = 0;

  // MEMORY.md
  try {
    const filePath = path.join(WORKSPACE, "MEMORY.md");
    const content = fs.readFileSync(filePath, "utf-8");
    const stats = fs.statSync(filePath);
    await sql`INSERT INTO mc_memory_files (filename, content, size, word_count, last_modified, synced_at)
      VALUES ('MEMORY.md', ${content}, ${stats.size}, ${countWords(content)}, ${stats.mtime.toISOString()}, NOW())
      ON CONFLICT (filename) DO UPDATE SET content=EXCLUDED.content, size=EXCLUDED.size, word_count=EXCLUDED.word_count, last_modified=EXCLUDED.last_modified, synced_at=NOW()`;
    count++;
  } catch {}

  // memory/*.md
  try {
    const memDir = path.join(WORKSPACE, "memory");
    const files = fs.readdirSync(memDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const filePath = path.join(memDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const stats = fs.statSync(filePath);
      await sql`INSERT INTO mc_memory_files (filename, content, size, word_count, last_modified, synced_at)
        VALUES (${file}, ${content}, ${stats.size}, ${countWords(content)}, ${stats.mtime.toISOString()}, NOW())
        ON CONFLICT (filename) DO UPDATE SET content=EXCLUDED.content, size=EXCLUDED.size, word_count=EXCLUDED.word_count, last_modified=EXCLUDED.last_modified, synced_at=NOW()`;
      count++;
    }
  } catch {}

  console.log(`  Synced ${count} memory files.`);
}

async function syncHeartbeat() {
  console.log("[sync] Heartbeat log...");
  const data = readJSON(path.join(WORKSPACE, "heartbeat-log.json"));
  if (!data) return;
  const entries = data.entries || [];
  let count = 0;
  for (const e of entries) {
    const id =
      e.id || `hb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const result = await sql`INSERT INTO mc_heartbeat (id, timestamp, type, summary, details, task_name)
      VALUES (${id}, ${e.timestamp}, ${e.type}, ${e.summary}, ${e.details || null}, ${e.taskName || null})
      ON CONFLICT (id) DO NOTHING`;
    if (result.length !== undefined) count++;
  }
  console.log(`  Synced ${entries.length} heartbeat entries.`);
}

async function syncScanner() {
  console.log("[sync] Scanner status...");
  const scannerLog = path.join(WORKSPACE, "deal-scanner/scanner.log");
  try {
    const content = fs.readFileSync(scannerLog, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    let lastTimestamp = null;
    let lastStatus = "idle";

    for (let i = lines.length - 1; i >= 0; i--) {
      const match = lines[i].match(/\[(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\]/);
      if (match) {
        lastTimestamp = match[1];
        break;
      }
    }

    const recent = lines.slice(-10).join(" ").toLowerCase();
    if (recent.includes("scan complete")) lastStatus = "idle";
    else if (recent.includes("scanning") || recent.includes("running"))
      lastStatus = "running";

    let nextScanMins = null;
    if (lastTimestamp) {
      const msSinceLast = Date.now() - new Date(lastTimestamp).getTime();
      const twoHoursMs = 2 * 60 * 60 * 1000;
      const msUntilNext = twoHoursMs - msSinceLast;
      nextScanMins = msUntilNext > 0 ? Math.ceil(msUntilNext / 60000) : 0;
    }

    await sql`INSERT INTO mc_scanner (id, last_scan, status, next_scan_mins, updated_at)
      VALUES ('config', ${lastTimestamp}, ${lastStatus}, ${nextScanMins}, NOW())
      ON CONFLICT (id) DO UPDATE SET last_scan=EXCLUDED.last_scan, status=EXCLUDED.status, next_scan_mins=EXCLUDED.next_scan_mins, updated_at=NOW()`;
  } catch {
    console.log("  No scanner.log found.");
  }
}

async function syncRequests() {
  console.log("[sync] Requests...");
  try {
    const content = fs.readFileSync(
      path.join(WORKSPACE, "DOUGLAS_REQUESTS.md"),
      "utf-8"
    );
    await sql`INSERT INTO mc_requests (id, content, updated_at) VALUES ('main', ${content}, NOW())
      ON CONFLICT (id) DO UPDATE SET content=EXCLUDED.content, updated_at=NOW()`;
  } catch {}
}

async function syncTeam() {
  console.log("[sync] Team...");
  try {
    const data = readJSON(path.join(WORKSPACE, "team.json"));
    if (data) {
      await sql`INSERT INTO mc_team (id, data, updated_at) VALUES ('config', ${JSON.stringify(data)}, NOW())
        ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data, updated_at=NOW()`;
    }
  } catch {}
}

async function syncTasks() {
  console.log("[sync] Tasks...");
  try {
    const tasks = readJSON(
      path.join(WORKSPACE, "mission-control/tasks.json")
    );
    if (!tasks || !Array.isArray(tasks)) return;
    for (const t of tasks) {
      const id =
        t.id ||
        `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await sql`INSERT INTO mc_tasks (id, title, description, status, priority, assignee, created_at, updated_at)
        VALUES (${id}, ${t.title}, ${t.description || null}, ${t.status || "backlog"}, ${t.priority || "medium"}, ${t.assignee || null}, ${t.createdAt || new Date().toISOString()}, ${t.updatedAt || t.createdAt || new Date().toISOString()})
        ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status, priority=EXCLUDED.priority, assignee=EXCLUDED.assignee, updated_at=EXCLUDED.updated_at`;
    }
    console.log(`  Synced ${tasks.length} tasks.`);
  } catch {}
}

async function syncFlips() {
  console.log("[sync] Flips...");
  try {
    const data = readJSON(path.join(WORKSPACE, "flip-tracker/flips.json"));
    if (!data) return;
    const flips = data.flips || [];
    for (const f of flips) {
      await sql`INSERT INTO mc_flips (id, event_name, event_date, venue, section, row, quantity, buy_platform, buy_price, buyer_fee, delivery_fee, buy_all_in, list_price, seller_fee, status, purchased_at, sold_at, sold_price, profit, roi, notes)
        VALUES (${f.id}, ${f.eventName}, ${f.eventDate}, ${f.venue}, ${f.section}, ${f.row}, ${f.quantity}, ${f.buyPlatform}, ${f.buyPrice}, ${f.buyerFee}, ${f.deliveryFee}, ${f.buyAllIn}, ${f.listPrice}, ${f.sellerFee}, ${f.status}, ${f.purchasedAt}, ${f.soldAt || null}, ${f.soldPrice || null}, ${f.profit || null}, ${f.roi || null}, ${f.notes || ""})
        ON CONFLICT (id) DO UPDATE SET event_name=EXCLUDED.event_name, status=EXCLUDED.status, sold_at=EXCLUDED.sold_at, sold_price=EXCLUDED.sold_price, profit=EXCLUDED.profit, roi=EXCLUDED.roi, notes=EXCLUDED.notes`;
    }
    console.log(`  Synced ${flips.length} flips.`);
  } catch {}
}

async function syncRdMemos() {
  console.log("[sync] R&D memos...");
  const memosDir = path.join(WORKSPACE, "rd-team/memos");
  try {
    const files = fs
      .readdirSync(memosDir)
      .filter((f) => f.match(/^\d{4}-\d{2}-\d{2}\.md$/));
    for (const file of files) {
      const date = file.replace(".md", "");
      const content = fs.readFileSync(path.join(memosDir, file), "utf-8");
      // Check if exists
      const existing = await sql`SELECT id FROM mc_rd_memos WHERE date = ${date} LIMIT 1`;
      if (existing.length === 0) {
        await sql`INSERT INTO mc_rd_memos (date, content, synced_at) VALUES (${date}, ${content}, NOW())`;
      } else {
        await sql`UPDATE mc_rd_memos SET content = ${content}, synced_at = NOW() WHERE date = ${date}`;
      }
    }
    console.log(`  Synced ${files.length} memos.`);
  } catch {}
}

async function syncRdStatus() {
  console.log("[sync] R&D status...");
  try {
    const data = readJSON(path.join(WORKSPACE, "rd-team/last-run.json"));
    if (data) {
      await sql`INSERT INTO mc_rd_status (id, data, updated_at) VALUES ('config', ${JSON.stringify(data)}, NOW())
        ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data, updated_at=NOW()`;
    }
  } catch {}
}

async function syncCron() {
  console.log("[sync] Cron jobs...");
  try {
    const stdout = execSync("openclaw cron list --json 2>/dev/null", {
      timeout: 10000,
    }).toString();
    const data = JSON.parse(stdout);
    await sql`INSERT INTO mc_cron (id, data, synced_at) VALUES ('config', ${JSON.stringify(data)}, NOW())
      ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data, synced_at=NOW()`;
  } catch (e) {
    console.log("  Could not fetch cron jobs:", e.message);
  }
}

async function syncDocs() {
  console.log("[sync] Docs...");
  const SCAN_CONFIGS = [
    { dir: WORKSPACE, pattern: /\.md$/i },
    { dir: path.join(WORKSPACE, "docs"), pattern: /\.(md|txt)$/i },
    {
      dir: path.join(WORKSPACE, "runbooks"),
      pattern: /\.(md|txt)$/i,
      category: "Runbook",
    },
    {
      dir: path.join(WORKSPACE, "rd-team/memos"),
      pattern: /\.md$/i,
      category: "R&D Memo",
    },
    { dir: path.join(WORKSPACE, "memory"), pattern: /\.md$/i, category: "Memory" },
  ];

  const SYSTEM_FILES = new Set([
    "SOUL.md",
    "AGENTS.md",
    "TOOLS.md",
    "USER.md",
    "IDENTITY.md",
    "BOOTSTRAP.md",
  ]);

  const seen = new Set();
  let count = 0;

  function detectCategory(name, filePath) {
    if (filePath.includes("/memory/")) return "Memory";
    if (filePath.includes("/runbooks/")) return "Runbook";
    if (filePath.includes("/rd-team/memos/")) return "R&D Memo";
    if (SYSTEM_FILES.has(name)) return "System";
    return "Other";
  }

  function makeId(filePath) {
    return Buffer.from(filePath).toString("base64url");
  }

  for (const config of SCAN_CONFIGS) {
    try {
      const entries = fs.readdirSync(config.dir);
      for (const entry of entries) {
        if (!config.pattern.test(entry)) continue;
        const fullPath = path.join(config.dir, entry);
        if (seen.has(fullPath)) continue;
        seen.add(fullPath);

        try {
          const stats = fs.statSync(fullPath);
          if (!stats.isFile()) continue;
          const content = fs.readFileSync(fullPath, "utf-8");
          const title = entry.replace(/\.(md|txt)$/i, "");
          const category = config.category || detectCategory(entry, fullPath);
          const preview = content
            .replace(/#+\s*/g, "")
            .replace(/\*\*/g, "")
            .replace(/---/g, "")
            .trim()
            .slice(0, 200);
          const id = makeId(fullPath);

          await sql`INSERT INTO mc_docs (id, title, path, category, content, size, word_count, last_modified, preview, tags, date, synced_at)
            VALUES (${id}, ${title}, ${fullPath}, ${category}, ${content}, ${stats.size}, ${countWords(content)}, ${stats.mtime.toISOString()}, ${preview}, ${[]}, ${null}, NOW())
            ON CONFLICT (id) DO UPDATE SET content=EXCLUDED.content, size=EXCLUDED.size, word_count=EXCLUDED.word_count, last_modified=EXCLUDED.last_modified, preview=EXCLUDED.preview, synced_at=NOW()`;
          count++;
        } catch {}
      }
    } catch {}
  }
  console.log(`  Synced ${count} docs.`);
}

async function syncNotes() {
  console.log("[sync] Notes...");
  try {
    const content = fs.readFileSync(
      path.join(WORKSPACE, "mission-control/notes.md"),
      "utf-8"
    );
    await sql`INSERT INTO mc_notes (id, content, updated_at) VALUES ('main', ${content}, NOW())
      ON CONFLICT (id) DO UPDATE SET content=EXCLUDED.content, updated_at=NOW()`;
  } catch {}
}

async function syncAgentStatus() {
  console.log("[sync] Agent status...");
  try {
    // ── Mr. Shmack (main) ──
    try {
      const stdout = execSync("openclaw sessions --json --active 30 2>/dev/null", {
        timeout: 10000,
      }).toString();
      const parsed = JSON.parse(stdout);
      const sessions = Array.isArray(parsed) ? parsed : (parsed.sessions || []);
      // Find the main telegram session
      const mainSession = sessions.find(
        (s) => s.key && s.key.includes("telegram") && !s.key.includes("subagent")
      );
      if (mainSession) {
        const updatedAt = new Date(mainSession.updatedAt || mainSession.startedAt);
        const minsAgo = (Date.now() - updatedAt.getTime()) / 60000;
        let status, statusText;
        if (minsAgo <= 5) {
          status = "active";
          statusText = "Chatting with Douglas";
        } else if (minsAgo <= 30) {
          status = "idle";
          statusText = `IDLE — last active ${Math.round(minsAgo)}m ago`;
        } else {
          status = "standby";
          statusText = "STANDBY — waiting for orders";
        }
        await sql`UPDATE mc_agent_status SET status=${status}, status_text=${statusText}, last_active_at=${updatedAt.toISOString()}, updated_at=NOW() WHERE agent_id='main'`;
        // Also update model in mc_team
        const currentModel = mainSession.model || mainSession.modelId || null;
        if (currentModel) {
          const modelShort = currentModel.includes("/") ? currentModel.split("/").pop() : currentModel;
          const teamRows = await sql`SELECT data FROM mc_team WHERE id = 'config'`;
          if (teamRows.length > 0) {
            const teamData = teamRows[0].data;
            const agents = teamData.agents || [];
            const main = agents.find(a => a.id === 'main');
            if (main && main.model !== modelShort) {
              main.model = modelShort;
              await sql`UPDATE mc_team SET data = ${JSON.stringify(teamData)}::jsonb WHERE id = 'config'`;
            }
          }
        }
      } else {
        // No active session at all — check wider window
        try {
          const stdout2 = execSync("openclaw sessions --json --active 1440 2>/dev/null", {
            timeout: 10000,
          }).toString();
          const parsed2 = JSON.parse(stdout2);
          const sessions2 = Array.isArray(parsed2) ? parsed2 : (parsed2.sessions || []);
          const mainSession2 = sessions2.find(
            (s) => s.key && s.key.includes("telegram") && !s.key.includes("subagent")
          );
          if (mainSession2) {
            const updatedAt = new Date(mainSession2.updatedAt || mainSession2.startedAt);
            const minsAgo = (Date.now() - updatedAt.getTime()) / 60000;
            await sql`UPDATE mc_agent_status SET status='idle', status_text=${`IDLE — last active ${Math.round(minsAgo)}m ago`}, last_active_at=${updatedAt.toISOString()}, updated_at=NOW() WHERE agent_id='main'`;
          } else {
            await sql`UPDATE mc_agent_status SET status='standby', status_text='STANDBY — waiting for orders', updated_at=NOW() WHERE agent_id='main'`;
          }
        } catch {
          await sql`UPDATE mc_agent_status SET status='standby', status_text='STANDBY — waiting for orders', updated_at=NOW() WHERE agent_id='main'`;
        }
      }
    } catch (e) {
      console.log("  Could not check main session:", e.message);
    }

    // ── Scout (scanner) ──
    try {
      const scannerLog = path.join(WORKSPACE, "deal-scanner/scanner.log");
      const content = fs.readFileSync(scannerLog, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);
      let lastTimestamp = null;
      for (let i = lines.length - 1; i >= 0; i--) {
        const match = lines[i].match(/\[(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\]/);
        if (match) {
          lastTimestamp = match[1];
          break;
        }
      }
      if (lastTimestamp) {
        const msSinceLast = Date.now() - new Date(lastTimestamp).getTime();
        const minsSinceLast = msSinceLast / 60000;
        const scanIntervalMins = 20; // runs every 20 min
        if (minsSinceLast <= 2) {
          await sql`UPDATE mc_agent_status SET status='active', status_text='SCANNING — finding deals...', last_active_at=${lastTimestamp}, updated_at=NOW() WHERE agent_id='scanner'`;
        } else {
          const nextScanMins = Math.max(0, Math.ceil(scanIntervalMins - minsSinceLast));
          const statusText = nextScanMins === 0
            ? "IDLE — scan due now"
            : `IDLE — next scan in ${nextScanMins}m`;
          await sql`UPDATE mc_agent_status SET status='idle', status_text=${statusText}, last_active_at=${lastTimestamp}, updated_at=NOW() WHERE agent_id='scanner'`;
        }
      }
    } catch {
      console.log("  Could not check scanner log for agent status.");
    }

    // ── Analyst & Strategist ──
    try {
      const stdout = execSync("openclaw sessions --json --active 60 2>/dev/null", {
        timeout: 10000,
      }).toString();
      const parsed = JSON.parse(stdout);
      const sessions = Array.isArray(parsed) ? parsed : (parsed.sessions || []);
      const rdSessions = sessions.filter(
        (s) => s.key && (s.key.includes("research") || s.key.includes("analysis") || s.key.includes("rd-team") || s.key.includes("analyst") || s.key.includes("strategist"))
      );
      const hasAnalyst = rdSessions.some((s) => s.key.includes("analyst") || s.key.includes("analysis"));
      const hasStrategist = rdSessions.some((s) => s.key.includes("strategist") || s.key.includes("strategy"));
      const hasRd = rdSessions.length > 0;

      if (hasAnalyst || hasRd) {
        await sql`UPDATE mc_agent_status SET status='active', status_text='Running analysis...', last_active_at=NOW(), updated_at=NOW() WHERE agent_id='rd-analyst'`;
      } else {
        await sql`UPDATE mc_agent_status SET status='standby', status_text='STANDBY', updated_at=NOW() WHERE agent_id='rd-analyst'`;
      }

      if (hasStrategist || hasRd) {
        await sql`UPDATE mc_agent_status SET status='active', status_text='Strategizing...', last_active_at=NOW(), updated_at=NOW() WHERE agent_id='rd-strategist'`;
      } else {
        await sql`UPDATE mc_agent_status SET status='standby', status_text='STANDBY', updated_at=NOW() WHERE agent_id='rd-strategist'`;
      }
    } catch {
      // Leave them as-is on error
    }

    // ── Night Shift (autonomous) ──
    try {
      const stdout = execSync("openclaw sessions --json --active 60 2>/dev/null", {
        timeout: 10000,
      }).toString();
      const parsed = JSON.parse(stdout);
      const sessions = Array.isArray(parsed) ? parsed : (parsed.sessions || []);
      const nightSession = sessions.find(
        (s) => s.key && (s.key.includes("2am") || s.key.includes("night") || s.key.includes("autonomous"))
      );
      if (nightSession) {
        await sql`UPDATE mc_agent_status SET status='active', status_text='Running night tasks...', last_active_at=NOW(), updated_at=NOW() WHERE agent_id='autonomous'`;
      } else {
        // Calculate next 2am run
        const now = new Date();
        const next2am = new Date(now);
        next2am.setHours(2, 0, 0, 0);
        if (next2am <= now) next2am.setDate(next2am.getDate() + 1);
        const hoursUntil = Math.round((next2am - now) / 3600000);
        await sql`UPDATE mc_agent_status SET status='scheduled', status_text=${`SCHEDULED — next run in ${hoursUntil}h`}, updated_at=NOW() WHERE agent_id='autonomous'`;
      }
    } catch {
      // Leave as-is
    }

    console.log("  Agent status synced.");
  } catch (e) {
    console.error("  Agent status sync error:", e.message);
  }
}

async function syncLiveAgents() {
  console.log("[sync] Live agents (auto-discovery)...");
  try {
    // Only auto-discover agents that were manually registered via the API.
    // Don't auto-insert from openclaw sessions — that creates ghost entries
    // with ugly session-key IDs. Instead, just mark manually-registered
    // agents as completed when their session disappears.

    // Get current active live agents from DB
    const existing = await sql`SELECT id, session_key, status FROM mc_live_agents WHERE status = 'active'`;
    
    if (existing.length === 0) {
      console.log("  No active live agents to check.");
      // Cleanup old completed agents
      await sql`DELETE FROM mc_live_agents WHERE status IN ('completed', 'failed') AND completed_at < NOW() - interval '1 hour'`;
      return;
    }

    // Check which sessions are still active
    let activeSessions = new Set();
    try {
      const stdout = execSync("openclaw sessions --json --active 60 2>/dev/null", {
        timeout: 10000,
      }).toString();
      const parsed = JSON.parse(stdout);
      const sessions = Array.isArray(parsed) ? parsed : (parsed.sessions || []);
      for (const s of sessions) {
        activeSessions.add(s.key || s.sessionKey || s.id || '');
      }
    } catch {
      // If we can't check sessions, don't mark anything completed
      console.log("  Could not check sessions, skipping completion check");
      return;
    }

    // Mark completed: agents whose session_key is no longer active
    for (const row of existing) {
      const sessionKey = row.session_key || '';
      if (sessionKey && !activeSessions.has(sessionKey)) {
        await sql`UPDATE mc_live_agents SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = ${row.id} AND status = 'active'`;
        console.log(`  Marked agent completed: ${row.id}`);
      }
    }

    // Cleanup: remove agents completed more than 1 hour ago
    await sql`DELETE FROM mc_live_agents WHERE status IN ('completed', 'failed') AND completed_at < NOW() - interval '1 hour'`;

    console.log(`  Checked ${existing.length} active agents against ${activeSessions.size} sessions`);
  } catch (e) {
    console.log("  Could not sync live agents:", e.message);
  }
}

async function main() {
  const start = Date.now();
  console.log(`[sync] Starting at ${new Date().toISOString()}`);

  try {
    await Promise.all([
      syncMemoryFiles(),
      syncHeartbeat(),
      syncScanner(),
      syncRequests(),
      syncTeam(),
      syncTasks(),
      syncFlips(),
      syncRdMemos(),
      syncRdStatus(),
      syncNotes(),
    ]);

    // These depend on nothing else, but run after for clarity
    await syncCron();
    await syncDocs();
    await syncLiveAgents();
    await syncAgentStatus();

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n✅ Sync complete in ${elapsed}s`);
  } catch (e) {
    console.error("Sync error:", e);
    process.exit(1);
  }
}

main();
