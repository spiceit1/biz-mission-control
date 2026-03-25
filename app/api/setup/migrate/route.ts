import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const TABLE_NAMES = [
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
  "mc_ticket_watch",
];

const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS mc_tasks (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'backlog',
    priority TEXT DEFAULT 'medium',
    assignee TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS mc_team (
    id TEXT PRIMARY KEY DEFAULT 'config' NOT NULL,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS mc_factory_agents (
    id TEXT PRIMARY KEY NOT NULL,
    session_key TEXT,
    name TEXT,
    emoji TEXT DEFAULT '🤖',
    role TEXT DEFAULT 'Sub-Agent',
    model TEXT DEFAULT 'sonnet',
    task_summary TEXT,
    status TEXT DEFAULT 'running',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS mc_agent_inbox (
    id SERIAL PRIMARY KEY,
    from_agent TEXT NOT NULL,
    to_agent TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'unread',
    priority TEXT DEFAULT 'normal',
    created_at TIMESTAMPTZ DEFAULT now(),
    read_at TIMESTAMPTZ,
    reply_to_id INTEGER,
    metadata JSONB
  )`,
  `CREATE TABLE IF NOT EXISTS mc_flips (
    id TEXT PRIMARY KEY NOT NULL,
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
    notes TEXT,
    listings JSONB DEFAULT '[]'
  )`,
  `CREATE TABLE IF NOT EXISTS mc_activity (
    id SERIAL PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS mc_chat_messages (
    id SERIAL PRIMARY KEY,
    message_id BIGINT,
    direction TEXT NOT NULL,
    text TEXT,
    sender_name TEXT,
    reply_to_message_id BIGINT,
    reply_to_text TEXT,
    timestamp TIMESTAMPTZ DEFAULT now(),
    raw JSONB,
    image_url TEXT,
    source TEXT DEFAULT 'telegram',
    processed_by_agent BOOLEAN DEFAULT false
  )`,
  `CREATE TABLE IF NOT EXISTS mc_cron (
    id TEXT PRIMARY KEY DEFAULT 'config' NOT NULL,
    data JSONB NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS mc_docs (
    id TEXT PRIMARY KEY NOT NULL,
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
    synced_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS mc_heartbeat (
    id TEXT PRIMARY KEY NOT NULL,
    timestamp TIMESTAMPTZ,
    type TEXT,
    summary TEXT,
    details TEXT,
    task_name TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS mc_memory_files (
    id SERIAL PRIMARY KEY,
    filename TEXT NOT NULL,
    content TEXT,
    size INTEGER,
    word_count INTEGER,
    last_modified TIMESTAMPTZ,
    synced_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS mc_notes (
    id TEXT PRIMARY KEY DEFAULT 'main' NOT NULL,
    content TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS mc_projects (
    id TEXT PRIMARY KEY NOT NULL,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS mc_requests (
    id TEXT PRIMARY KEY DEFAULT 'main' NOT NULL,
    content TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS mc_scanner (
    id TEXT PRIMARY KEY DEFAULT 'config' NOT NULL,
    last_scan TIMESTAMPTZ,
    status TEXT DEFAULT 'unknown',
    next_scan_mins INTEGER,
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS mc_scanner_rules (
    id TEXT PRIMARY KEY DEFAULT 'default' NOT NULL,
    min_roi NUMERIC DEFAULT 20,
    min_completed_sales INTEGER DEFAULT 3,
    sales_window_days INTEGER DEFAULT 7,
    max_sales_used INTEGER DEFAULT 15,
    min_hours_out NUMERIC DEFAULT 48,
    max_days_out INTEGER DEFAULT 9999,
    floor_divergence_flag NUMERIC DEFAULT 0.50,
    seller_fee NUMERIC DEFAULT 0.15,
    stubhub_buyer_fee NUMERIC DEFAULT 0.30,
    tickpick_buyer_fee NUMERIC DEFAULT 0,
    seatgeek_buyer_fee NUMERIC DEFAULT 0.20,
    vivid_buyer_fee NUMERIC DEFAULT 0.25,
    gametime_buyer_fee NUMERIC DEFAULT 0.15,
    scan_frequency_min INTEGER DEFAULT 20,
    auto_buy_enabled BOOLEAN DEFAULT false,
    auto_buy_min_roi NUMERIC DEFAULT 40,
    auto_buy_min_sales INTEGER DEFAULT 5,
    auto_buy_max_cost NUMERIC DEFAULT 200,
    auto_buy_min_days_out INTEGER DEFAULT 7,
    auto_buy_max_days_out INTEGER DEFAULT 60,
    updated_at TIMESTAMPTZ DEFAULT now(),
    auto_list_enabled BOOLEAN DEFAULT false,
    auto_list_platforms TEXT DEFAULT 'stubhub',
    auto_list_undercut_pct NUMERIC DEFAULT 2,
    auto_buy_cost_type TEXT DEFAULT 'total',
    auto_buy_cost_includes_fees BOOLEAN DEFAULT true,
    auto_list_undercut_mode TEXT DEFAULT 'dollars',
    auto_list_undercut_dollars NUMERIC DEFAULT 2,
    stubhub_seller_fee NUMERIC DEFAULT 0.15,
    vivid_seller_fee NUMERIC DEFAULT 0.10,
    seatgeek_seller_fee NUMERIC DEFAULT 0.10,
    scanner_enabled BOOLEAN DEFAULT true,
    top_events_enabled BOOLEAN DEFAULT false
  )`,
  `CREATE TABLE IF NOT EXISTS mc_deal_log (
    id SERIAL PRIMARY KEY,
    deal_id TEXT,
    event_name TEXT NOT NULL,
    event_date TEXT,
    event_time TEXT,
    venue TEXT,
    zone TEXT,
    section TEXT,
    row TEXT,
    quantity INTEGER,
    buy_price NUMERIC,
    buy_platform TEXT,
    buy_all_in NUMERIC,
    sell_benchmark NUMERIC,
    sell_benchmark_source TEXT,
    roi_pct NUMERIC,
    profit_est NUMERIC,
    source TEXT DEFAULT 'scanner',
    status TEXT DEFAULT 'presented',
    action_taken TEXT,
    buy_actual NUMERIC,
    sell_price NUMERIC,
    sell_platform TEXT,
    sell_date TIMESTAMPTZ,
    profit_actual NUMERIC,
    notes TEXT,
    scanner_data JSONB,
    found_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    buy_method TEXT DEFAULT 'manual',
    buy_url TEXT,
    event_url TEXT,
    stubhub_event_id TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS mc_rd_memos (
    id SERIAL PRIMARY KEY,
    date TEXT,
    content TEXT,
    synced_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS mc_rd_status (
    id TEXT PRIMARY KEY DEFAULT 'config' NOT NULL,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS mc_email_events (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL,
    emoji TEXT,
    from_addr TEXT,
    subject TEXT,
    snippet TEXT,
    message_id TEXT,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS mc_live_agents (
    id TEXT PRIMARY KEY NOT NULL,
    session_key TEXT,
    name TEXT NOT NULL,
    emoji TEXT DEFAULT '🤖',
    role TEXT DEFAULT 'Sub-Agent',
    model TEXT,
    status TEXT DEFAULT 'active',
    task_summary TEXT,
    task_id TEXT,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS mc_agent_status (
    agent_id TEXT PRIMARY KEY NOT NULL,
    status TEXT DEFAULT 'standby' NOT NULL,
    status_text TEXT,
    last_active_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS mc_ticket_watch (
    id SERIAL PRIMARY KEY,
    event_name TEXT NOT NULL,
    venue TEXT,
    event_date TEXT,
    section_filter TEXT DEFAULT 'Floor GA',
    quantity INTEGER DEFAULT 2,
    max_price_per_ticket NUMERIC,
    alert_email TEXT,
    alert_telegram BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'watching',
    notes TEXT,
    last_checked_at TIMESTAMPTZ,
    last_cheapest_price NUMERIC,
    last_cheapest_platform TEXT,
    price_history JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
];

export async function POST() {
  try {
    const sql = getDb();

    // Snapshot which tables existed before
    const beforeRows = await sql`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename LIKE 'mc_%'
    `;
    const beforeSet = new Set(beforeRows.map((r: Record<string, unknown>) => r.tablename as string));

    // Run all CREATE TABLE IF NOT EXISTS statements
    for (const ddl of MIGRATIONS) {
      await sql.query(ddl);
    }

    // Snapshot which tables exist after
    const afterRows = await sql`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename LIKE 'mc_%'
    `;
    const afterSet = new Set(afterRows.map((r: Record<string, unknown>) => r.tablename as string));

    // Build results
    const tableResults: { table: string; action: string }[] = [];
    const tablesMap: Record<string, string> = {};
    let createdCount = 0;
    let existedCount = 0;

    for (const table of TABLE_NAMES) {
      if (!beforeSet.has(table) && afterSet.has(table)) {
        tableResults.push({ table, action: "created" });
        tablesMap[table] = "created";
        createdCount++;
      } else if (beforeSet.has(table)) {
        tableResults.push({ table, action: "existed" });
        tablesMap[table] = "existed";
        existedCount++;
      } else {
        tableResults.push({ table, action: "failed" });
        tablesMap[table] = "failed";
      }
    }

    return NextResponse.json({
      ok: true,
      success: true,
      summary: `${createdCount} table${createdCount !== 1 ? "s" : ""} created, ${existedCount} already existed`,
      total: TABLE_NAMES.length,
      created: createdCount,
      already_existed: existedCount,
      tables: tableResults,
      tablesMap,
    });
  } catch (e) {
    console.error("POST /api/setup/migrate error:", e);
    return NextResponse.json(
      { ok: false, success: false, error: String(e), tables: [], tablesMap: {} },
      { status: 500 }
    );
  }
}
