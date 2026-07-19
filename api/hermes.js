// Hermes Bridge v5 — KITT talks to local Hermes server directly
// No Telegram middleman, no polling — instant Jarvis-style response
// Quick commands handled locally, complex ones go to the Hermes bridge

const HERMES_BRIDGE_URL = process.env.HERMES_BRIDGE_URL || '';
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

    // ── POLL: deprecated (no longer needed without Telegram bridge) ──
    if (action === 'poll') {
      return res.json({ response: null, action: 'wait', received: false });
    }

    // ── SEND: handle a new command ──
    const cmd = (command || '').trim();
    if (!cmd) return res.json({ response: "I'm listening. What do you need?", action: 'speak' });

    const c = cmd.toLowerCase();

    // Quick commands (handled instantly for speed)
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

    // ── Try Hermes bridge (local server via Cloudflare tunnel) ──
    if (HERMES_BRIDGE_URL) {
      try {
        const bridgeRes = await fetch(HERMES_BRIDGE_URL + '/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: cmd, history: [] }),
          signal: AbortSignal.timeout(60000) // 60s timeout
        });

        if (bridgeRes.ok) {
          const data = await bridgeRes.json();
          if (data.response) {
            // Clean up Hermes response — remove session_id footer
            const clean = data.response.replace(/\r?\nsession_id:.*/, '').trim();
            return res.json({ response: clean, action: 'speak' });
          }
        }
      } catch (e) {
        console.error('Bridge call failed:', e.message);
      }
    }

    // ── Fallback: Groq AI conversation ──
    if (GROQ_API_KEY) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + GROQ_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: 'You are KITT from Knight Rider. You are concise and clever. Answer naturally.' },
              { role: 'user', content: cmd }
            ],
            max_tokens: 200,
            temperature: 0.7
          })
        });
        if (groqRes.ok) {
          const data = await groqRes.json();
          return res.json({ response: data.choices[0].message.content.trim(), action: 'speak' });
        }
      } catch (e) {}
    }

    return res.json({ response: 'System offline. Try again when connected.', action: 'speak' });

  } catch (err) {
    console.error('Bridge error:', err);
    return res.status(500).json({ response: 'System error.', action: 'speak' });
  }
}
