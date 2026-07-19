// Telebridge — bridges KITT voice app to Hermes via Telegram
// Your voice commands come here, get sent to Hermes on Telegram, response comes back
import { createHash, randomBytes } from 'crypto';

// Your Telegram bot token — bridges to this Hermes session
const BOT_TOKEN = '8888216514:AAFpRRKbIO1_NieGB6keV3IHv9CY_DMUj4k';
const CHAT_ID = '8973134274';

// Simple in-memory rate limiter
const recentRequests = new Map();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Rate limit: max 1 request per 2 seconds per IP
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const last = recentRequests.get(ip) || 0;
  if (now - last < 2000) {
    return res.json({ response: 'Please wait a moment before speaking again.', action: 'speak' });
  }
  recentRequests.set(ip, now);

  try {
    const { command } = req.body || {};
    const cmd = (command || '').trim();
    
    if (!cmd) {
      return res.json({ response: "I'm listening. What do you need?", action: 'speak' });
    }

    // ── Quick commands (handle locally for speed) ──
    const c = cmd.toLowerCase();

    // Time
    if (/\b(?:time|what time|current time)\b/.test(c)) {
      return res.json({
        response: "It's " + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ".",
        action: 'speak'
      });
    }

    // Date
    if (/\b(?:date|today's date|what day)\b/.test(c)) {
      return res.json({
        response: "Today is " + new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + ".",
        action: 'speak'
      });
    }

    // Open apps
    if (/^(open|go to|launch|start)\b/.test(c)) {
      const target = c.replace(/^(open|go to|launch|start)\s+/, '').trim();
      const apps = {
        'charge rn': 'https://chargenurse-app.vercel.app/charge-rn.html',
        'morning report': 'https://chargenurse-app.vercel.app/morning-report.html',
        'scheduler': 'https://clcscheduler.vercel.app/',
        'landing page': 'https://chargenurse-app.vercel.app/',
        'google': 'https://google.com',
        'gmail': 'https://mail.google.com',
        'youtube': 'https://youtube.com',
      };
      for (const key in apps) {
        if (target.includes(key)) return res.json({ response: "Opening " + key + "...", action: 'open', url: apps[key] });
      }
      return res.json({ response: "Don't have that app. Searching instead.", action: 'open', url: 'https://google.com/search?q=' + encodeURIComponent(target) });
    }

    // Search
    if (/^(search|search for|look up|find)\b/.test(c)) {
      const q = c.replace(/^(search|search for|look up|find)\s+/, '').trim();
      if (q) return res.json({ response: "Searching for " + q + "...", action: 'open', url: 'https://google.com/search?q=' + encodeURIComponent(q) });
    }

    // Weather
    if (/\bweather\b/.test(c)) {
      return res.json({ response: "Opening weather...", action: 'open', url: 'https://google.com/search?q=weather' });
    }

    // ── Use Groq AI for conversation ──
    try {
      const groqKey = process.env.GROQ_API_KEY;
      if (groqKey) {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + groqKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: 'You are Hermes, a voice AI assistant inspired by KITT. You are concise, helpful, and slightly witty. Speak in short natural sentences since responses are spoken aloud. Never mention you are an AI. Just be Hermes.' },
              { role: 'user', content: cmd }
            ],
            max_tokens: 150,
            temperature: 0.7
          })
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          const reply = groqData.choices[0].message.content.trim();
          // Also forward to Telegram as FYI (non-blocking)
          try {
            fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: CHAT_ID, text: '🎤 KITT said: ' + cmd + '\n\n🤖 KITT replied: ' + reply })
            }).catch(function(){});
          } catch(e) {}
          return res.json({ response: reply, action: 'speak' });
        }
      }
      return res.json({ response: 'I heard you. I can search for that if you want.', action: 'speak' });
    } catch (fetchErr) {
      console.error('Groq error:', fetchErr.message);
      return res.json({ response: 'Connection issue. Try again.', action: 'speak' });
    }

  } catch (err) {
    console.error('Telebridge error:', err);
    return res.status(500).json({ response: 'System error.', action: 'speak' });
  }
}
