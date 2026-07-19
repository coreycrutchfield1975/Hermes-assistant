// Hermes Conversation API v2
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { command } = req.body || {};
    const cmd = (command || '').trim();
    if (!cmd) return res.json({ response: "I'm listening. What do you need?", action: 'speak', visualization: 'idle' });
    const c = cmd.toLowerCase();
    if (/^(hello|hey|hi|yo)\b/.test(c)) {
      const g = ["I'm Hermes. What can I do?", "Hello! Ready when you are.", "Systems online. What do you need?"];
      return res.json({ response: g[Math.floor(Math.random() * g.length)], action: 'speak', visualization: 'idle' });
    }
    if (/how are you/.test(c)) {
      return res.json({ response: "All systems nominal.", action: 'speak', visualization: 'idle' });
    }
    if (/\b(?:time|what time)\b/.test(c) && !/what can you/.test(c)) {
      const now = new Date();
      return res.json({ response: "It's " + now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ".", action: 'speak', visualization: 'idle' });
    }
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
        if (target.includes(key)) return res.json({ response: "Opening " + key + "...", action: 'open', url: apps[key], visualization: 'processing' });
      }
      return res.json({ response: "Searching instead.", action: 'open', url: 'https://google.com/search?q=' + encodeURIComponent(target), visualization: 'processing' });
    }
    if (/^(search|search for|look up|find)\b/.test(c)) {
      const q = c.replace(/^(search|search for|look up|find)\s+/, '').trim();
      if (q) return res.json({ response: "Searching for " + q + "...", action: 'open', url: 'https://google.com/search?q=' + encodeURIComponent(q), visualization: 'processing' });
    }
    if (/\bweather\b/.test(c)) {
      return res.json({ response: "Opening weather...", action: 'open', url: 'https://google.com/search?q=weather', visualization: 'processing' });
    }
    if (/\b(thank|thanks)\b/.test(c)) {
      return res.json({ response: ["You're welcome!", 'Anytime!', 'Glad I could help.'][Math.floor(Math.random() * 3)], action: 'speak', visualization: 'idle' });
    }
    if (/who are you/.test(c)) {
      return res.json({ response: "I'm Hermes, your AI voice agent. I can open your apps, search the web, answer questions.", action: 'speak', visualization: 'idle' });
    }
    if (/\b(help|commands|what can you do)\b/.test(c)) {
      return res.json({ response: "Try: open charge RN, search for something, who are you, what time is it, or say hello.", action: 'speak', visualization: 'idle' });
    }
    if (/\b(joke|make me laugh)\b/.test(c)) {
      const j = ["Why did the scarecrow win? Outstanding in his field.", "What do you call a fake noodle? An impasta.", "Why don't scientists trust atoms? They make up everything."];
      return res.json({ response: j[Math.floor(Math.random() * j.length)], action: 'speak', visualization: 'idle' });
    }
    const fb = ['Interesting. Tell me more.', 'I can search for that if you want.', 'Try saying "search for" followed by your topic.'];
    return res.json({ response: fb[Math.floor(Math.random() * fb.length)], action: 'speak', visualization: 'thinking' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
