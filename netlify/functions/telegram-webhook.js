// Telegram Webhook — receives messages from Douglas, saves to mc_chat_messages
// Registered at: https://shmack-hq.netlify.app/.netlify/functions/telegram-webhook

const { neon } = require("@neondatabase/serverless");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

async function ensureTable(sql) {
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
      raw JSONB
    )
  `;
}

exports.handler = async (event) => {
  // Only process if this instance has a Telegram bot token configured
  if (!BOT_TOKEN) {
    return { statusCode: 200, body: "not configured" };
  }
  // Only accept POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Bad JSON" };
  }

  const message = body.message || body.edited_message;
  if (!message) {
    // Not a message update (could be other types), just acknowledge
    return { statusCode: 200, body: "ok" };
  }

  const chatId = message.chat?.id;
  const messageId = message.message_id;
  const text = message.text || message.caption || null;
  // Always use actual Telegram sender name — this lets Morris and others be identified automatically
  const senderName =
    message.from?.first_name
      ? [message.from.first_name, message.from.last_name].filter(Boolean).join(" ")
      : null;

  console.log(`Inbound message from chat_id: ${chatId}, sender: ${senderName}`);

  const replyToMessageId = message.reply_to_message?.message_id ?? null;
  const replyToText = message.reply_to_message?.text ?? message.reply_to_message?.caption ?? null;

  const timestamp = message.date
    ? new Date(message.date * 1000).toISOString()
    : new Date().toISOString();

  try {
    const sql = getDb();
    await ensureTable(sql);

    await sql`
      INSERT INTO mc_chat_messages
        (message_id, direction, text, sender_name, reply_to_message_id, reply_to_text, timestamp, raw)
      VALUES
        (${messageId}, 'inbound', ${text}, ${senderName},
         ${replyToMessageId}, ${replyToText}, ${timestamp}, ${JSON.stringify(message)})
      ON CONFLICT (message_id) DO UPDATE SET
        text                = EXCLUDED.text,
        sender_name         = EXCLUDED.sender_name,
        reply_to_message_id = EXCLUDED.reply_to_message_id,
        reply_to_text       = EXCLUDED.reply_to_text,
        raw                 = EXCLUDED.raw
    `;

    console.log(`Saved inbound message ${messageId} from ${senderName}`);
    return { statusCode: 200, body: "ok" };
  } catch (err) {
    console.error("telegram-webhook error:", err);
    // Return 200 to Telegram anyway so it doesn't retry forever
    return { statusCode: 200, body: "error saved" };
  }
};
