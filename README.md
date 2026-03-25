# 🎛 Mission Control

A personal operations dashboard built on Next.js + Neon Postgres, deployed on Netlify. Tracks tasks, ticket flips, agent activity, deal scanning, chat, docs, and more — in one centralized interface.

---

## Prerequisites

- **Node.js** 18+ (Next.js 14 app router)
- **Neon DB** — a serverless Postgres database ([neon.tech](https://neon.tech))
- **Netlify** — hosting + serverless functions

---

## Environment Variables

Create a `.env.local` for local dev, or set these in Netlify's environment settings:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon connection string (`postgresql://user:pass@...neon.tech/neondb`) |
| `NEXT_PUBLIC_INSTANCE` | ✅ | Instance label — `personal` or `biz`. Controls feature visibility. |
| `TELEGRAM_BOT_TOKEN` | Optional | Enables Telegram chat integration |

**Example `.env.local`:**
```env
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
NEXT_PUBLIC_INSTANCE=personal
```

---

## First-Time Setup

> **For the AI agent:** You cannot create the Neon database or Netlify site yourself — the human owner needs to do two quick things first. Ask them clearly, then you handle the rest.

### Step 0: Ask your human what type of instance this is

Before anything else, ask:

> "What is this Mission Control instance for? Give me a short description (e.g., 'personal projects', 'business with my partner Morris', 'client dashboard'). I'll configure it accordingly."

Their answer determines the `NEXT_PUBLIC_INSTANCE` value you'll set later: `personal` or `biz`.

### Step 1: Ask your human to create a Neon database

Send them this message:

> "I need you to create a database for Mission Control. It takes 2 minutes:
> 1. Go to **neon.tech** and sign in (or create a free account)
> 2. Click **New Project**
> 3. Name it anything (e.g. 'mission-control')
> 4. Pick the region closest to you
> 5. Click **Create Project**
> 6. You'll see a **connection string** that starts with `postgresql://` — copy the whole thing and send it to me
>
> That's all I need. I'll handle everything else."

Save the connection string they give you — this is your `DATABASE_URL`.

### Step 2: Ask your human to create a Netlify site

Send them this message:

> "I also need a Netlify account to host the dashboard:
> 1. Go to **app.netlify.com** and sign in (or create a free account)
> 2. Go to **User Settings → Applications → Personal access tokens**
> 3. Click **New access token**, name it 'openclaw', and click **Generate**
> 4. Copy the token (starts with `nfp_`) and send it to me
>
> I'll create the site and deploy everything automatically."

Once you have the Netlify token, create the site yourself:
```bash
NETLIFY_AUTH_TOKEN=<token> npx netlify-cli sites:create --name <pick-a-name>
```

### Step 3: Clone and deploy

```bash
git clone https://github.com/spiceit1/openclaw-mission-control.git
cd mission-control
npm install
```

Deploy to Netlify with the DATABASE_URL set:
```bash
# Set env vars on the Netlify site
NETLIFY_AUTH_TOKEN=<token> npx netlify-cli env:set DATABASE_URL "<connection-string>" --site <site-id>
NETLIFY_AUTH_TOKEN=<token> npx netlify-cli env:set NEXT_PUBLIC_INSTANCE "personal" --site <site-id>

# Deploy
NETLIFY_AUTH_TOKEN=<token> npx netlify-cli deploy --prod --site <site-id>
```

### Step 4: Bootstrap the database

Visit `/setup` on your deployed site:

1. **Verify DB connection** — the status card should show "Connected"
2. **Click "Run Migration"** — creates all 22 `mc_` tables in your Neon DB
3. **Click "Seed Defaults"** — inserts base config rows (team roster, scanner rules, etc.)
4. All pages will now work correctly

### Step 5: Verify everything works

Click **Verify All Routes** on the `/setup` page. All checks should show green (✅). If any fail, check the error message and ensure migration and seeding completed successfully.

> **That's it.** The human did 2 things (Neon + Netlify tokens). The agent did everything else.

---

## Pages

| Page | Route | Description |
|---|---|---|
| Dashboard | `/` | Overview cards — tasks, flips, agents, scanner status |
| Tasks | `/tasks` | Kanban-style task board with priorities |
| *(extensible)* | | *Add custom pages as needed for your use case* |
| Factory | `/factory` | Sub-agent registry — spawned agents, status, task summaries |
| Inbox | `/inbox` | Agent-to-agent message inbox |
| Chat | `/chat` | Telegram chat history viewer |
| Projects | `/projects` | Project tracking |
| Docs | `/docs` | Document library (synced from workspace) |
| Memory | `/memory` | Workspace memory file viewer |
| Notes | `/notes` | Persistent scratchpad |
| Requests | `/requests` | Incoming request queue |
| R&D | `/rd` | Research memos and status |
| Team | `/team` | Agent team roster configuration |
| Setup | `/setup` | DB health check, migration, seeding |

---

## Setting Up the Agent Factory

The Factory page (`/factory`) shows your agents, their status, and the task board. After migration and seeding, it will be empty until you register your agents.

### 1. Register yourself as the primary agent

```sql
INSERT INTO mc_factory_agents (id, name, emoji, role, model, task_summary, status)
VALUES ('your-agent-id', 'Your Name', '🤖', 'Primary Agent', 'sonnet', 'What you do', 'active');
```

Example:
```sql
INSERT INTO mc_factory_agents (id, name, emoji, role, model, task_summary, status)
VALUES ('paul', 'Paul', '🎸', 'Primary Agent (Mac mini)', 'sonnet', 'Business operations and task management', 'active');
```

### 2. Register sub-agents when you spawn them

Every time you spawn a sub-agent, insert it into `mc_factory_agents`:

```sql
INSERT INTO mc_factory_agents (id, session_key, name, emoji, role, model, task_summary, status)
VALUES ('unique-id', 'agent:main:subagent:xxx', 'Agent Name', '🤖', 'Sub-Agent', 'opus', 'What it is doing', 'active');
```

When a sub-agent finishes:
```sql
UPDATE mc_factory_agents SET status = 'completed' WHERE id = 'unique-id';
```

### 3. Add standby agents (optional)

Standby agents show in the gray row at the top of the Factory page — available but not currently working:

```sql
INSERT INTO mc_factory_agents (id, name, emoji, role, model, task_summary, status)
VALUES ('analyst', 'Analyst', '📊', 'Standby', 'haiku', 'Data analysis and reporting', 'standby');
```

### Agent Status Values

| Status | Where it appears |
|---|---|
| `active` | Live agents section + avatars on in-progress tasks |
| `standby` | Gray standby row at top of Factory |
| `completed` | Done section |
| `idle` | Available but not assigned |

### Factory Columns

| Column | Type | Description |
|---|---|---|
| `id` | text (PK) | Unique agent identifier |
| `session_key` | text | OpenClaw session key (for live agents) |
| `name` | text | Display name |
| `emoji` | text | Agent emoji/avatar |
| `role` | text | Role description |
| `model` | text | AI model (opus, sonnet, haiku) |
| `task_summary` | text | Current task description |
| `status` | text | active, standby, completed, idle |

---

## Creating a New Instance

To spin up a second instance (e.g. for a business partner):

1. **Ask the human** for a new Neon connection string and Netlify token (same steps as first-time setup above)
2. **Create a new Netlify site** using the token
3. **Set env vars** — use `NEXT_PUBLIC_INSTANCE=biz` for business instances
4. **Deploy** the same codebase
5. **Visit `/setup`** → Run Migration → Seed Defaults
6. Done — fully independent instance with its own database

> **Instance types:** Set `NEXT_PUBLIC_INSTANCE` to any label that makes sense (e.g., `personal`, `biz`, `client`). This value is used for display and can control feature flags if custom pages are added later.

---

## Architecture

```
mission-control/
├── app/
│   ├── (dashboard)/          # All UI pages (layout with sidebar)
│   │   ├── setup/page.tsx    # DB health & migration UI
│   │   ├── flips/            # Flip Tracker
│   │   ├── scanner/          # Deal Scanner
│   │   └── ...
│   └── api/
│       ├── setup/
│       │   ├── route.ts          # GET /api/setup — legacy status
│       │   ├── status/route.ts   # GET /api/setup/status — table health
│       │   ├── migrate/route.ts  # POST /api/setup/migrate — create tables
│       │   ├── seed/route.ts     # POST /api/setup/seed — insert defaults
│       │   └── health/route.ts   # GET /api/setup/health — route verification
│       ├── tasks/route.ts
│       ├── flips/route.ts
│       └── ...
├── lib/
│   └── db.ts                 # Neon connection helper
└── README.md
```

**Database:** All tables are prefixed `mc_` and live in a single Neon Postgres database. The 22 core tables cover tasks, flips, agents, scanner, chat, docs, memory, and more.

**API pattern:** All routes follow the same pattern — `getDb()` from `lib/db.ts`, tagged template literal queries, `NextResponse.json()`.

**Instances:** The same codebase runs multiple isolated instances. Each points to its own Neon DB via `DATABASE_URL`. `NEXT_PUBLIC_INSTANCE` controls UI feature flags.

---

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # Production build
npm run lint       # ESLint check
```

---

## Database Tables

All 22 `mc_` tables are created by the migration endpoint:

| Table | Purpose |
|---|---|
| `mc_tasks` | Task board items |
| `mc_team` | Agent team config |
| `mc_factory_agents` | Spawned sub-agent registry |
| `mc_live_agents` | Currently active agents |
| `mc_agent_status` | Agent heartbeat status |
| `mc_agent_inbox` | Inter-agent message inbox |
| `mc_flips` | Ticket flip inventory |
| `mc_deal_log` | Scanner deal history |
| `mc_scanner` | Scanner runtime state |
| `mc_scanner_rules` | Scanner ROI/buy rules config |
| `mc_activity` | Activity feed events |
| `mc_chat_messages` | Telegram chat history |
| `mc_cron` | Cron job config |
| `mc_docs` | Document library |
| `mc_heartbeat` | System heartbeat records |
| `mc_memory_files` | Workspace memory files |
| `mc_notes` | Persistent notes |
| `mc_projects` | Project tracking |
| `mc_requests` | Request queue |
| `mc_rd_memos` | R&D memos |
| `mc_rd_status` | R&D status config |
| `mc_email_events` | Email event log |
