// Telegram webhook receiver — handles replies to KITT bot messages
// When someone replies to the bot's message in DM, this catches it
// KITT polls for the response via /api/hermes (action: 'poll')

const BOT_TOKEN=proces...OKEN || '';
const CHAT_ID = '8973134274';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const update = req.body;
    const msg = update && (update.message || update.edited_message);

    // Only process replies to the bot in the authorized chat
    if (!msg || !msg.text || !msg.chat || msg.chat.id.toString() !== CHAT_ID || !msg.reply_to_message) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    // KITT will pick up the reply via polling — we just acknowledge
    return res.status(200).json({
      ok: true,
      reply_to: msg.reply_to_message.message_id,
      text: msg.text
    });

  } catch (err) {
    console.error('Telegram webhook error:', err);
    return res.status(200).json({ ok: true });
  }
}
