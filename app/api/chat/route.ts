import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

interface ChatMessage {
  id: number;
  message_id: number | null;
  direction: "inbound" | "outbound";
  sender_name: string | null;
  text: string | null;
  reply_to_message_id: number | null;
  reply_to_text: string | null;
  timestamp: string;
  image_url: string | null;
  source: string | null;
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DOUGLAS_CHAT_ID = 8684069023;

async function ensureTable() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS mc_chat_messages (
      id SERIAL PRIMARY KEY,
      message_id BIGINT UNIQUE,
      direction TEXT NOT NULL,
      text TEXT,
      sender_name TEXT,
      reply_to_message_id BIGINT,
      reply_to_text TEXT,
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      raw JSONB,
      image_url TEXT
    )
  `;
  // Migrate existing tables
  await sql`ALTER TABLE mc_chat_messages ADD COLUMN IF NOT EXISTS image_url TEXT`;
  await sql`ALTER TABLE mc_chat_messages ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'telegram'`;
  await sql`ALTER TABLE mc_chat_messages ADD COLUMN IF NOT EXISTS processed_by_agent BOOLEAN DEFAULT FALSE`;
}

async function syncFromTelegram() {
  if (!BOT_TOKEN || BOT_TOKEN.length < 20) return; // strict check — biz instance has no token
  try {
    // Get recent updates from Telegram
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=100&allowed_updates=["message"]`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return;
    const data = (await res.json()) as {
      ok: boolean;
      result?: Array<{
        update_id: number;
        message?: {
          message_id: number;
          from?: { first_name?: string; last_name?: string; is_bot?: boolean };
          chat?: { id: number };
          text?: string;
          caption?: string;
          date: number;
          photo?: Array<{ file_id: string }>;
          reply_to_message?: { message_id: number; text?: string };
        };
      }>;
    };
    if (!data.ok || !data.result) return;

    const sql = getDb();
    for (const update of data.result) {
      const msg = update.message;
      if (!msg) continue;
      // Only messages from Douglas's chat
      if (msg.chat?.id !== DOUGLAS_CHAT_ID) continue;

      const isBot = msg.from?.is_bot ?? false;
      const direction = isBot ? "outbound" : "inbound";
      const senderName = isBot
        ? "Mr. Shmack"
        : [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || "Douglas";

      const text = msg.text ?? msg.caption ?? null;
      const timestamp = new Date(msg.date * 1000).toISOString();
      const replyToMsgId = msg.reply_to_message?.message_id ?? null;
      const replyToText = msg.reply_to_message?.text ?? null;

      // Resolve photo file_id to URL if present
      let imageUrl: string | null = null;
      if (msg.photo && msg.photo.length > 0) {
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        try {
          const fileRes = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`,
            { signal: AbortSignal.timeout(5000) }
          );
          const fileData = (await fileRes.json()) as {
            ok: boolean;
            result?: { file_path?: string };
          };
          if (fileData.ok && fileData.result?.file_path) {
            imageUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
          }
        } catch { /* skip image URL on error */ }
      }

      await sql`
        INSERT INTO mc_chat_messages
          (message_id, direction, text, sender_name, reply_to_message_id, reply_to_text, timestamp, raw, image_url, source)
        VALUES
          (${msg.message_id}, ${direction}, ${text}, ${senderName},
           ${replyToMsgId}, ${replyToText}, ${timestamp},
           ${JSON.stringify(msg)}, ${imageUrl}, 'telegram')
        ON CONFLICT (message_id) DO UPDATE SET
          text = EXCLUDED.text,
          image_url = COALESCE(EXCLUDED.image_url, mc_chat_messages.image_url),
          sender_name = EXCLUDED.sender_name,
          direction = EXCLUDED.direction
      `;
    }
  } catch (e) {
    console.error("Telegram sync error:", e);
  }
}

export async function GET() {
  try {
    await ensureTable();
    await syncFromTelegram();

    const sql = getDb();
    // Return the LAST 200 messages (most recent), wrapped in a subquery so final order is ASC
    const rows = await sql`
      SELECT * FROM (
        SELECT id, message_id, direction, sender_name, text,
               reply_to_message_id, reply_to_text, timestamp, image_url, source
        FROM mc_chat_messages
        ORDER BY timestamp DESC, id DESC
        LIMIT 200
      ) sub
      ORDER BY timestamp ASC, id ASC
    `;

    const messages: ChatMessage[] = rows.map((r: Record<string, unknown>) => ({
      id: r.id as number,
      message_id: r.message_id as number | null,
      direction: r.direction as "inbound" | "outbound",
      sender_name: r.sender_name as string | null,
      text: r.text as string | null,
      reply_to_message_id: r.reply_to_message_id as number | null,
      reply_to_text: r.reply_to_text as string | null,
      timestamp: r.timestamp as string,
      image_url: r.image_url as string | null,
      source: r.source as string | null,
    }));

    return NextResponse.json({ messages });
  } catch (e) {
    console.error("GET /api/chat error:", e);
    return NextResponse.json({ error: "Failed to load chat" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureTable();

    const body = (await req.json()) as {
      text?: string;
      replyToMessageId?: number;
      imageUrl?: string;
    };
    const text = (body.text ?? "").trim();
    const imageUrl = body.imageUrl ?? null;

    if (!text && !imageUrl) {
      return NextResponse.json({ error: "text or imageUrl is required" }, { status: 400 });
    }

    const replyToMessageId = body.replyToMessageId ?? null;

    // Save to DB as a web-sourced inbound message (Douglas typed it in MC)
    // Do NOT send to Telegram — the email-watcher will pick this up and
    // trigger openclaw agent to generate a reply.
    const sql = getDb();
    const now = new Date().toISOString();

    let replyToText: string | null = null;
    if (replyToMessageId) {
      const rows = await sql`
        SELECT text FROM mc_chat_messages WHERE message_id = ${replyToMessageId} LIMIT 1
      `;
      replyToText = (rows[0] as Record<string, unknown> | undefined)?.text as string | null ?? null;
    }

    const inserted = await sql`
      INSERT INTO mc_chat_messages
        (message_id, direction, text, sender_name, reply_to_message_id, reply_to_text, timestamp, raw, image_url, source, processed_by_agent)
      VALUES
        (${null}, 'inbound', ${text || null}, 'Douglas',
         ${replyToMessageId}, ${replyToText}, ${now},
         ${JSON.stringify({ text, replyToMessageId, imageUrl: imageUrl ? "[image]" : null })},
         ${imageUrl}, 'web', FALSE)
      RETURNING id, message_id, direction, sender_name, text, reply_to_message_id, reply_to_text, timestamp, image_url, source
    `;

    const row = inserted[0] as Record<string, unknown>;
    const message: ChatMessage = {
      id: row.id as number,
      message_id: row.message_id as number | null,
      direction: "inbound",
      sender_name: "Douglas",
      text: text || null,
      reply_to_message_id: replyToMessageId,
      reply_to_text: replyToText,
      timestamp: now,
      image_url: imageUrl,
      source: "web",
    };

    return NextResponse.json({ message });
  } catch (e) {
    console.error("POST /api/chat error:", e);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
