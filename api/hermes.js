// Hermes Bridge v7
const GROQ_API_KEY=process.env.GROQ_API_KEY;
const BRIDGE_URL = process.env.HERMES_BRIDGE_URL || '';
const BRIDGE_SECRET=process.env.HERMES_BRIDGE_SECRET || '';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const { command } = req.body || {};
  if (!command) return res.status(400).json({ response: 'Say something...', action: 'speak' });
  
  const cmd = command.toLowerCase().trim();
  
  // Quick commands (handled locally)
  if (cmd.includes('time') && !cmd.includes('what')) {
    return res.json({ response: new Date().toLocaleTimeString(), action: 'speak' });
  }
  if (cmd.includes('date')) {
    return res.json({ response: new Date().toLocaleDateString(), action: 'speak' });
  }
  if (cmd.includes('open charge rn') || cmd.includes('charge rn')) {
    return res.json({ response: 'Opening Charge RN', action: 'open', url: 'https://chargenurse-app.vercel.app/charge-rn.html' });
  }
  if (cmd.includes('open morning report') || cmd.includes('morning')) {
    return res.json({ response: 'Opening Morning Report', action: 'open', url: 'https://chargenurse-app.vercel.app/morning-report.html' });
  }
  if (cmd.includes('open clc') || cmd.includes('clc scheduler')) {
    return res.json({ response: 'Opening CLC Scheduler', action: 'open', url: 'https://clcscheduler.vercel.app' });
  }
  if (cmd.includes('open launchpad')) {
    return res.json({ response: 'Opening Launchpad', action: 'open', url: 'https://clc-workstation.vercel.app' });
  }
  if (cmd.includes('search') || cmd.includes('find')) {
    const q = cmd.replace(/search|find|for|about/g, '').trim();
    return res.json({ response: 'Searching...', action: 'open', url: 'https://duckduckgo.com/?q=' + encodeURIComponent(q) });
  }
  if (cmd.includes('weather')) {
    const location = cmd.replace(/weather|in|at/g, '').trim() || 'Missouri';
    return res.json({ response: 'Checking weather for ' + location, action: 'open', url: 'https://duckduckgo.com/?q=weather+' + encodeURIComponent(location) });
  }
  if (cmd.includes('joke')) {
    return res.json({ response: 'Why did the scarecrow win an award? Because he was outstanding in his field!', action: 'speak' });
  }
  
  // Try Groq AI for conversation
  try {
    const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_API_KEY },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are KITT, a cool voice assistant with Knight Rider personality. Be concise and helpful. For quick tasks answer directly. For complex real-world tasks, say "I will ask Hermes about that" to route to the main AI.' },
          { role: 'user', content: cmd }
        ],
        max_tokens: 200,
        temperature: 0.7
      })
    });
    const groq = await groqResp.json();
    if (groq.choices && groq.choices[0]) {
      const reply = groq.choices[0].message.content;
      return res.json({ response: reply, action: 'speak' });
    }
  } catch (e) {
    console.error('Groq error:', e.message);
  }
  
  // Fallback
  return res.json({ response: 'I heard you. Try asking me something else.', action: 'speak' });
}
