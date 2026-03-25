import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

const DATABASE_URL = "postgresql://neondb_owner:npg_QW2a7wnADpOs@ep-dry-term-advgll07-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);

const WORKSPACE = "/Users/douglasdweck/.openclaw/workspace";

async function createTables() {
  console.log("Creating tables...");

  await sql`CREATE TABLE IF NOT EXISTS mc_tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'backlog',
    priority TEXT DEFAULT 'medium',
    assignee TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS mc_flips (
    id TEXT PRIMARY KEY,
    event_name TEXT,
    event_date TEXT,
    venue TEXT,
    section TEXT,
    row TEXT,
    quantity INTEGER DEFAULT 1,
    buy_platform TEXT DEFAULT 'StubHub',
    buy_price NUMERIC,
    buyer_fee NUMERIC,
    delivery_fee NUMERIC,
    buy_all_in NUMERIC,
    list_price NUMERIC,
    seller_fee NUMERIC,
    status TEXT DEFAULT 'active',
    purchased_at TIMESTAMPTZ,
    sold_at TIMESTAMPTZ,
    sold_price NUMERIC,
    profit NUMERIC,
    roi NUMERIC,
    notes TEXT
  )`;

  await sql`CREATE TABLE IF NOT EXISTS mc_activity (
    id SERIAL PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS mc_projects (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS mc_team (
    id TEXT PRIMARY KEY DEFAULT 'config',
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS mc_heartbeat (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ,
    type TEXT,
    summary TEXT,
    details TEXT,
    task_name TEXT
  )`;

  await sql`CREATE TABLE IF NOT EXISTS mc_notes (
    id TEXT PRIMARY KEY DEFAULT 'main',
    content TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS mc_memory_files (
    id SERIAL PRIMARY KEY,
    filename TEXT UNIQUE NOT NULL,
    content TEXT,
    size INTEGER,
    word_count INTEGER,
    last_modified TIMESTAMPTZ,
    synced_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS mc_docs (
    id TEXT PRIMARY KEY,
    title TEXT,
    path TEXT,
    category TEXT,
    content TEXT,
    size INTEGER,
    word_count INTEGER,
    last_modified TIMESTAMPTZ,
    preview TEXT,
    tags TEXT[],
    date TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS mc_requests (
    id TEXT PRIMARY KEY DEFAULT 'main',
    content TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS mc_rd_memos (
    id SERIAL PRIMARY KEY,
    date TEXT,
    content TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS mc_rd_status (
    id TEXT PRIMARY KEY DEFAULT 'config',
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS mc_cron (
    id TEXT PRIMARY KEY DEFAULT 'config',
    data JSONB NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS mc_scanner (
    id TEXT PRIMARY KEY DEFAULT 'config',
    last_scan TIMESTAMPTZ,
    status TEXT DEFAULT 'unknown',
    next_scan_mins INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  console.log("All tables created.");
}

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    console.log(`  Could not read ${filePath}`);
    return null;
  }
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function seedTasks() {
  const tasks = readJSON(path.join(WORKSPACE, "mission-control/tasks.json"));
  if (!tasks || !Array.isArray(tasks)) return;
  console.log(`Seeding ${tasks.length} tasks...`);
  for (const t of tasks) {
    const id = t.id || `task-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    await sql`INSERT INTO mc_tasks (id, title, description, status, priority, assignee, created_at, updated_at)
      VALUES (${id}, ${t.title}, ${t.description || null}, ${t.status || 'backlog'}, ${t.priority || 'medium'}, ${t.assignee || null}, ${t.createdAt || new Date().toISOString()}, ${t.updatedAt || t.createdAt || new Date().toISOString()})
      ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status, priority=EXCLUDED.priority, assignee=EXCLUDED.assignee, updated_at=EXCLUDED.updated_at`;
  }
}

async function seedFlips() {
  const data = readJSON(path.join(WORKSPACE, "flip-tracker/flips.json"));
  if (!data) return;
  const flips = data.flips || [];
  console.log(`Seeding ${flips.length} flips...`);
  for (const f of flips) {
    await sql`INSERT INTO mc_flips (id, event_name, event_date, venue, section, row, quantity, buy_platform, buy_price, buyer_fee, delivery_fee, buy_all_in, list_price, seller_fee, status, purchased_at, sold_at, sold_price, profit, roi, notes)
      VALUES (${f.id}, ${f.eventName}, ${f.eventDate}, ${f.venue}, ${f.section}, ${f.row}, ${f.quantity}, ${f.buyPlatform}, ${f.buyPrice}, ${f.buyerFee}, ${f.deliveryFee}, ${f.buyAllIn}, ${f.listPrice}, ${f.sellerFee}, ${f.status}, ${f.purchasedAt}, ${f.soldAt || null}, ${f.soldPrice || null}, ${f.profit || null}, ${f.roi || null}, ${f.notes || ''})
      ON CONFLICT (id) DO UPDATE SET event_name=EXCLUDED.event_name, status=EXCLUDED.status, sold_at=EXCLUDED.sold_at, sold_price=EXCLUDED.sold_price, profit=EXCLUDED.profit, roi=EXCLUDED.roi, notes=EXCLUDED.notes`;
  }
}

async function seedActivity() {
  const data = readJSON(path.join(WORKSPACE, "mission-control/activity.json"));
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.log("No activity data to seed.");
    return;
  }
  console.log(`Seeding ${data.length} activity entries...`);
  for (const item of data) {
    await sql`INSERT INTO mc_activity (data) VALUES (${JSON.stringify(item)})`;
  }
}

async function seedProjects() {
  const data = readJSON(path.join(WORKSPACE, "mission-control/projects.json"));
  if (!data || !Array.isArray(data)) return;
  console.log(`Seeding ${data.length} projects...`);
  for (const p of data) {
    await sql`INSERT INTO mc_projects (id, data, updated_at) VALUES (${p.id}, ${JSON.stringify(p)}, ${p.lastUpdated || new Date().toISOString()})
      ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data, updated_at=EXCLUDED.updated_at`;
  }
}

async function seedTeam() {
  const data = readJSON(path.join(WORKSPACE, "team.json"));
  if (!data) return;
  console.log("Seeding team config...");
  await sql`INSERT INTO mc_team (id, data, updated_at) VALUES ('config', ${JSON.stringify(data)}, NOW())
    ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data, updated_at=NOW()`;
}

async function seedHeartbeat() {
  const data = readJSON(path.join(WORKSPACE, "heartbeat-log.json"));
  if (!data) return;
  const entries = data.entries || [];
  console.log(`Seeding ${entries.length} heartbeat entries...`);
  for (const e of entries) {
    const id = e.id || `hb-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    await sql`INSERT INTO mc_heartbeat (id, timestamp, type, summary, details, task_name)
      VALUES (${id}, ${e.timestamp}, ${e.type}, ${e.summary}, ${e.details || null}, ${e.taskName || null})
      ON CONFLICT (id) DO NOTHING`;
  }
}

async function seedNotes() {
  const filePath = path.join(WORKSPACE, "mission-control/notes.md");
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    console.log("Seeding notes...");
    await sql`INSERT INTO mc_notes (id, content, updated_at) VALUES ('main', ${content}, NOW())
      ON CONFLICT (id) DO UPDATE SET content=EXCLUDED.content, updated_at=NOW()`;
  } catch {
    console.log("No notes.md found.");
  }
}

async function seedMemoryFiles() {
  console.log("Seeding memory files...");

  // MEMORY.md
  try {
    const content = fs.readFileSync(path.join(WORKSPACE, "MEMORY.md"), "utf-8");
    const stats = fs.statSync(path.join(WORKSPACE, "MEMORY.md"));
    await sql`INSERT INTO mc_memory_files (filename, content, size, word_count, last_modified, synced_at)
      VALUES ('MEMORY.md', ${content}, ${stats.size}, ${countWords(content)}, ${stats.mtime.toISOString()}, NOW())
      ON CONFLICT (filename) DO UPDATE SET content=EXCLUDED.content, size=EXCLUDED.size, word_count=EXCLUDED.word_count, last_modified=EXCLUDED.last_modified, synced_at=NOW()`;
  } catch {}

  // memory/*.md
  const memDir = path.join(WORKSPACE, "memory");
  try {
    const files = fs.readdirSync(memDir).filter(f => f.endsWith(".md"));
    for (const file of files) {
      const filePath = path.join(memDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const stats = fs.statSync(filePath);
      await sql`INSERT INTO mc_memory_files (filename, content, size, word_count, last_modified, synced_at)
        VALUES (${file}, ${content}, ${stats.size}, ${countWords(content)}, ${stats.mtime.toISOString()}, NOW())
        ON CONFLICT (filename) DO UPDATE SET content=EXCLUDED.content, size=EXCLUDED.size, word_count=EXCLUDED.word_count, last_modified=EXCLUDED.last_modified, synced_at=NOW()`;
    }
    console.log(`  Seeded ${files.length} memory files + MEMORY.md`);
  } catch (e) {
    console.log("  Error reading memory dir:", e.message);
  }
}

async function seedRequests() {
  const filePath = path.join(WORKSPACE, "DOUGLAS_REQUESTS.md");
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    console.log("Seeding requests...");
    await sql`INSERT INTO mc_requests (id, content, updated_at) VALUES ('main', ${content}, NOW())
      ON CONFLICT (id) DO UPDATE SET content=EXCLUDED.content, updated_at=NOW()`;
  } catch {
    console.log("No DOUGLAS_REQUESTS.md found.");
  }
}

async function seedRdMemos() {
  const memosDir = path.join(WORKSPACE, "rd-team/memos");
  try {
    const files = fs.readdirSync(memosDir).filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/));
    console.log(`Seeding ${files.length} R&D memos...`);
    for (const file of files) {
      const date = file.replace(".md", "");
      const content = fs.readFileSync(path.join(memosDir, file), "utf-8");
      await sql`INSERT INTO mc_rd_memos (date, content, synced_at) VALUES (${date}, ${content}, NOW())`;
    }
  } catch {
    console.log("No R&D memos found.");
  }
}

async function seedRdStatus() {
  const statusFile = path.join(WORKSPACE, "rd-team/last-run.json");
  try {
    const data = readJSON(statusFile);
    if (data) {
      console.log("Seeding R&D status...");
      await sql`INSERT INTO mc_rd_status (id, data, updated_at) VALUES ('config', ${JSON.stringify(data)}, NOW())
        ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data, updated_at=NOW()`;
    }
  } catch {}
}

async function seedScanner() {
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

    console.log("Seeding scanner status...");
    await sql`INSERT INTO mc_scanner (id, last_scan, status, next_scan_mins, updated_at)
      VALUES ('config', ${lastTimestamp}, ${lastStatus}, ${null}, NOW())
      ON CONFLICT (id) DO UPDATE SET last_scan=EXCLUDED.last_scan, status=EXCLUDED.status, updated_at=NOW()`;
  } catch {
    console.log("No scanner.log found — inserting defaults.");
    await sql`INSERT INTO mc_scanner (id, status, updated_at)
      VALUES ('config', 'unknown', NOW())
      ON CONFLICT (id) DO NOTHING`;
  }
}

async function seedDocs() {
  console.log("Seeding docs...");
  const SCAN_CONFIGS = [
    { dir: WORKSPACE, pattern: /\.md$/i, recursive: false },
    { dir: path.join(WORKSPACE, "docs"), pattern: /\.(md|txt)$/i, recursive: false },
    { dir: path.join(WORKSPACE, "runbooks"), pattern: /\.(md|txt)$/i, recursive: false, category: "Runbook" },
    { dir: path.join(WORKSPACE, "rd-team/memos"), pattern: /\.md$/i, recursive: false, category: "R&D Memo" },
    { dir: path.join(WORKSPACE, "memory"), pattern: /\.md$/i, recursive: false, category: "Memory" },
  ];

  const SYSTEM_FILES = new Set(["SOUL.md", "AGENTS.md", "TOOLS.md", "USER.md", "IDENTITY.md", "BOOTSTRAP.md"]);
  const seen = new Set();
  let count = 0;

  function detectCategory(name, filePath, content) {
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
          const category = config.category || detectCategory(entry, fullPath, content);
          const preview = content.replace(/#+\s*/g, "").replace(/\*\*/g, "").replace(/---/g, "").trim().slice(0, 200);
          const id = makeId(fullPath);

          await sql`INSERT INTO mc_docs (id, title, path, category, content, size, word_count, last_modified, preview, tags, date, synced_at)
            VALUES (${id}, ${title}, ${fullPath}, ${category}, ${content}, ${stats.size}, ${countWords(content)}, ${stats.mtime.toISOString()}, ${preview}, ${[]}, ${null}, NOW())
            ON CONFLICT (id) DO UPDATE SET content=EXCLUDED.content, size=EXCLUDED.size, word_count=EXCLUDED.word_count, last_modified=EXCLUDED.last_modified, preview=EXCLUDED.preview, synced_at=NOW()`;
          count++;
        } catch {}
      }
    } catch {}
  }
  console.log(`  Seeded ${count} docs.`);
}

async function seedCron() {
  console.log("Seeding cron (empty placeholder)...");
  await sql`INSERT INTO mc_cron (id, data, synced_at) VALUES ('config', '{"jobs": []}', NOW())
    ON CONFLICT (id) DO UPDATE SET synced_at=NOW()`;
}

async function main() {
  try {
    await createTables();
    await seedTasks();
    await seedFlips();
    await seedActivity();
    await seedProjects();
    await seedTeam();
    await seedHeartbeat();
    await seedNotes();
    await seedMemoryFiles();
    await seedRequests();
    await seedRdMemos();
    await seedRdStatus();
    await seedScanner();
    await seedDocs();
    await seedCron();
    console.log("\n✅ All tables created and seeded successfully!");
  } catch (e) {
    console.error("Error:", e);
    process.exit(1);
  }
}

main();
