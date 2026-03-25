// Called by Google Pub/Sub when new email arrives
// Body: { message: { data: base64encoded, messageId, publishTime }, subscription }

const { google } = require('googleapis');
const { neon } = require('@neondatabase/serverless');

const DOUGLAS_CHAT_ID = 8684069023;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

async function getGmailClient() {
  const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  auth.setCredentials({ refresh_token: REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth });
}

// Categorize email and build alert message
function categorize(from, subject, snippet) {
  from = (from || '').toLowerCase();
  subject = (subject || '').toLowerCase();

  if (from.includes('stubhub') && (subject.includes('sold') || subject.includes('your listing sold'))) {
    return { type: 'SOLD', emoji: '💰', urgent: true };
  }
  if (from.includes('stubhub') && subject.includes('thanks for your order')) {
    return { type: 'PURCHASE', emoji: '🎟️', urgent: true };
  }
  if (from.includes('vividseats') && subject.includes('sold')) {
    return { type: 'SOLD', emoji: '💰', urgent: true };
  }
  if (from.includes('seatdeals')) {
    return { type: 'DEAL_ALERT', emoji: '🔔', urgent: false };
  }
  if (from.includes('ronnie') && subject.includes('attach')) {
    return { type: 'CLASS_IMAGES', emoji: '📸', urgent: false };
  }
  if (from.includes('ebay') && subject.includes('sold')) {
    return { type: 'EBAY_SOLD', emoji: '💰', urgent: true };
  }
  if (from.includes('ddweck')) {
    return { type: 'FROM_DOUGLAS', emoji: '📧', urgent: false };
  }
  return null; // not interesting
}

exports.handler = async (event) => {
  try {
    // Parse Pub/Sub message
    const body = JSON.parse(event.body || '{}');
    const data = body.message?.data;
    if (!data) return { statusCode: 200, body: 'no data' };

    const decoded = JSON.parse(Buffer.from(data, 'base64').toString());
    const { emailAddress, historyId } = decoded;

    console.log(`gmail-push: notification for ${emailAddress}, historyId=${historyId}`);

    const gmail = await getGmailClient();

    // Use history API to get messages added since the notified historyId
    // Fall back to recent unread if history lookup fails
    let messages = [];
    try {
      const histRes = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: historyId,
        historyTypes: ['messageAdded'],
        maxResults: 10
      });
      const histList = histRes.data.history || [];
      for (const h of histList) {
        for (const ma of (h.messagesAdded || [])) {
          if (ma.message?.id) messages.push({ id: ma.message.id });
        }
      }
    } catch (e) {
      console.log('gmail-push: history lookup failed, falling back to recent unread:', e.message);
    }

    // Fallback: fetch recent unread from last 2 hours
    if (messages.length === 0) {
      const listRes = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 5,
        q: 'is:unread newer_than:2h'
      });
      messages = listRes.data.messages || [];
    }

    console.log(`gmail-push: found ${messages.length} messages to check`);

    for (const msg of messages) {
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject']
      });

      const headers = full.data.payload?.headers || [];
      const from = headers.find(h => h.name === 'From')?.value || '';
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const snippet = full.data.snippet || '';

      const cat = categorize(from, subject, snippet);
      if (!cat) {
        console.log(`gmail-push: skipping (no category) — from=${from} subject=${subject}`);
        continue;
      }

      console.log(`gmail-push: matched ${cat.type} — from=${from} subject=${subject}`);

      // Write to Neon so local email-watcher picks it up and triggers openclaw agent
      try {
        const db = neon(process.env.DATABASE_URL);
        await db`
          INSERT INTO mc_email_events (type, emoji, from_addr, subject, snippet, message_id)
          VALUES (${cat.type}, ${cat.emoji}, ${from}, ${subject}, ${snippet.slice(0, 500)}, ${msg.id})
          ON CONFLICT (message_id) DO NOTHING
        `;
        console.log(`gmail-push: wrote event to Neon for ${cat.type}`);
      } catch (e) {
        console.error('gmail-push: neon write error:', e.message);
      }
    }

    return { statusCode: 200, body: 'ok' };
  } catch (e) {
    console.error('gmail-push error:', e);
    return { statusCode: 200, body: 'error' }; // always 200 to avoid Pub/Sub retries
  }
};
