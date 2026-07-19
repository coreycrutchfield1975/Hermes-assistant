// Hermes Bridge v4 — KITT talks to Telegram, Hermes replies, KITT gets answer
// Sends command to Telegram, polls for Hermes' response, returns it

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = '8973134274';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { command, action, message_id } = req.body || {};

    // ── POLL: check for any NEW message after the one we sent ──
    if (action === 'poll' && message_id) {
      const pollRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowed_updates: ['message'], timeout: 0 })
      });

      if (pollRes.ok) {
        const data = await pollRes.json();
        const updates = data.result || [];

        // Find the newest message from Hermes (bot's own messages via telegram)
        // that was sent AFTER our bridge message
        let latestReply = null;
        let latestDate = 0;
        for (const update of updates) {
          const msg = update.message;
          if (msg &&
              msg.chat.id.toString() === CHAT_ID &&
              msg.date > latestDate &&
              msg.message_id > message_id &&
              msg.text &&
              !msg.text.startsWith('🎤')) {  // skip the KITT voice commands
            latestReply = msg;
            latestDate = msg.date;
          }
        }

        if (latestReply) {
          return res.json({
            response: latestReply.text,
            action: 'speak',
            received: true
          });
        }
      }

      return res.json({ response: null, action: 'wait', received: false });
    }

    // ── SEND: handle a new command ──
    const cmd = (command || '').trim();
    if (!cmd) return res.json({ response: "I'm listening. What do you need?", action: 'speak' });

    const c = cmd.toLowerCase();

    // Quick commands (handled instantly by KITT)
    if (/\b(?:time|what time)\b/.test(c) && !/what can you/.test(c)) {
      return res.json({ response: "It's " + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ".", action: 'speak' });
    }
    if (/\b(?:date|today's date|what day)\b/.test(c)) {
      return res.json({ response: "Today is " + new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + ".", action: 'speak' });
    }
    if (/^(open|go to|launch|start)\b/.test(c)) {
      const target = c.replace(/^(open|go to|launch|start)\s+/, '').trim();
      const apps = {
        'charge rn': 'https://chargenurse-app.vercel.app/charge-rn.html',
        'morning report': 'https://chargenurse-app.vercel.app/morning-report.html',
        'scheduler': 'https://clcscheduler.vercel.app/',
        'landing page': 'https://chargenurse-app.vercel.app/',
        'resource directory': 'https://jjp-resource-directory.vercel.app/',
        'bullion dealer': 'https://bulliondealerpro.com/',
        'google': 'https://google.com',
        'gmail': 'https://mail.google.com',
        'youtube': 'https://youtube.com',
      };
      for (const key in apps) {
        if (target.includes(key)) return res.json({ response: "Opening " + key + "!", action: 'open', url: apps[key] });
      }
      return res.json({ response: "Searching instead.", action: 'open', url: 'https://google.com/search?q=' + encodeURIComponent(target) });
    }
    if (/^(search|search for|look up|find)\b/.test(c)) {
      const q = c.replace(/^(?:search\s+(?:for\s+)?|look\s+up\s+|find\s+)/, '').trim();
      if (q) return res.json({ response: 'Searching for ' + q + '...', action: 'open', url: 'https://google.com/search?q=' + encodeURIComponent(q) });
    }
    if (/\bweather\b/.test(c)) {
      return res.json({ response: "Opening weather...", action: 'open', url: 'https://google.com/search?q=weather' });
    }

    // ── Complex commands → Try Groq AI first (we have the key now) ──
    const gkey = process.env.GROQ_API_KEY;
    if (gkey) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + gkey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: 'You are KITT from Knight Rider. You are concise and clever. If the user asks you to do something you cannot do yourself, say "Let me get Hermes on this." Otherwise just answer naturally.' },
              { role: 'user', content: cmd }
            ],
            max_tokens: 150,
            temperature: 0.7
          })
        });
        if (groqRes.ok) {
          const data = await groqRes.json();
          const reply = data.choices[0].message.content.trim();
          // Check if KITT says it needs Hermes — if so, fall through to bridge
          if (!reply.toLowerCase().includes('let me get hermes') && !reply.toLowerCase().includes('let me check with hermes')) {
            return res.json({ response: reply, action: 'speak' });
          }
        }
      } catch (e) {}
    }

    // ── Telegram bridge (for tasks KITT can't answer) ──
    const teleRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: `🎤 Voice command from KITT:\n\n"${cmd}"`,
        parse_mode: 'HTML'
      })
    });

    if (teleRes.ok) {
      const teleData = await teleRes.json();
      const sentMessageId = teleData.result.message_id;

      return res.json({
        response: 'One moment — tapping Hermes for that.',
        action: 'bridge',
        message_id: sentMessageId
      });
    } else {
      const errText = await teleRes.text();
      console.error('Telegram send failed:', teleRes.status, errText);
    }

    return res.json({ response: 'Try again.', action: 'speak' });

  } catch (err) {
    console.error('Bridge error:', err);
    return res.status(500).json({ response: 'System error.', action: 'speak' });
  }
}
