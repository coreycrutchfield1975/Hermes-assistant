const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;
app.use(express.static(__dirname));

// For Render, these come from environment variables
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const BRIDGE_URL = process.env.HERMES_BRIDGE_URL || '';
const BRIDGE_SECRET = process.env.HERMES_BRIDGE_SECRET || '';

app.post('/api', express.json(), async (req, res) => {
  const command = req.body?.command || '';
  if (!command) return res.json({ response: 'Say something...', action: 'speak' });
  const cmd = command.toLowerCase().trim();
  
  // Quick commands
  if ((cmd.includes('time') && !cmd.includes('what')) || cmd.includes('what time')) {
    return res.json({ response: new Date().toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', hour12: true }), action: 'speak' });
  }
  if (cmd.includes('open charge rn') || cmd.includes('charge rn')) {
    return res.json({ response: 'Opening Charge RN', action: 'open', url: 'https://chargenurse-app.vercel.app/charge-rn.html' });
  }
  if (cmd.includes('open morning')) {
    return res.json({ response: 'Opening Morning Report', action: 'open', url: 'https://chargenurse-app.vercel.app/morning-report.html' });
  }
  if (cmd.includes('open clc') || cmd.includes('clc scheduler')) {
    return res.json({ response: 'Opening CLC Scheduler', action: 'open', url: 'https://clcscheduler.vercel.app' });
  }
  if (cmd.includes('open launchpad')) {
    return res.json({ response: 'Opening Launchpad', action: 'open', url: 'https://clc-workstation.vercel.app' });
  }
  if (cmd.includes('search ') || cmd.includes('find ')) {
    const q = cmd.replace(/search |find |for |about /g, '').trim();
    return res.json({ response: 'Searching for ' + q, action: 'open', url: 'https://duckduckgo.com/?q=' + encodeURIComponent(q) });
  }
  if (cmd.includes('weather')) {
    const loc = cmd.replace(/weather |in |at /g, '').trim() || 'Missouri';
    return res.json({ response: 'Checking weather', action: 'open', url: 'https://duckduckgo.com/?q=weather+' + encodeURIComponent(loc) });
  }
  if (cmd.includes('joke')) {
    return res.json({ response: 'Why did the scarecrow win an award? Because he was outstanding in his field!', action: 'speak' });
  }
  
  // Route complex commands to Hermes bridge via Cloudflare tunnel
  const complexWords = ['deploy', 'edit', 'build', 'create', 'update', 'change', 'fix', 'add', 'remove', 'make', 'schedule', 'remind', 'email', 'message', 'send', 'search web', 'research', 'find', 'what is', 'how do'];
  const needsBridge = complexWords.some(w => cmd.includes(w));
  
  if (needsBridge && BRIDGE_URL && BRIDGE_SECRET) {
    try {
      const bridgeResp = await fetch(BRIDGE_URL + '/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bridge-secret': BRIDGE_SECRET
        },
        body: JSON.stringify({ command }),
        signal: AbortSignal.timeout(90000) // 90s timeout
      });
      
      if (bridgeResp.ok) {
        const data = await bridgeResp.json();
        return res.json({ response: data.response, action: 'speak' });
      }
      console.error('Bridge HTTP error:', bridgeResp.status);
    } catch (e) {
      console.error('Bridge fetch error:', e.message);
      // Fall through to Groq
    }
  }
  
  // Groq AI fallback
  if (!GROQ_API_KEY) {
    return res.json({ response: "I can't process that right now — Hermes bridge is unavailable.", action: 'speak' });
  }
  
  try {
    const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_API_KEY },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are KITT from Knight Rider. Be concise, cool, and helpful. Answer naturally.' + (needsBridge ? ' The Hermes bridge was unavailable, so just answer directly.' : '') },
          { role: 'user', content: cmd }
        ],
        max_tokens: 250,
        temperature: 0.7
      })
    });
    const groq = await groqResp.json();
    if (groq.choices && groq.choices[0]) {
      return res.json({ response: groq.choices[0].message.content, action: 'speak' });
    }
  } catch (e) {
    console.error('Groq:', e.message);
  }
  
  return res.json({ response: 'Try asking me something else.', action: 'speak' });
});

app.listen(PORT, () => console.log('KITT on port ' + PORT));
