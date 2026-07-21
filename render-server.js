const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;
app.use(express.static(__dirname));

// For Render, these come from environment variables
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '8973134274';

app.post('/api', express.json(), async (req, res) => {
  const command = req.body?.command || '';
  if (!command) return res.json({ response: 'Say something...', action: 'speak' });
  const cmd = command.toLowerCase().trim();
  
  // Quick commands (instant, no bridge needed)
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
  
  // Check if this is a complex task that needs Hermes
  const complexWords = ['deploy', 'edit', 'build', 'create', 'update', 'change', 'fix', 'add', 'remove', 'make', 'schedule', 'remind', 'email', 'message', 'send', 'research', 'what is', 'how do', 'search web'];
  const needsBridge = complexWords.some(w => cmd.includes(w));
  
  // Async Telegram bridge — fires and forgets, KITT responds instantly
  if (needsBridge && BOT_TOKEN) {
    fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: TELEGRAM_CHAT_ID, 
        text: '🎙️ KITT: ' + command
      })
    }).catch(e => console.error('Telegram bridge err:', e.message));
    
    return res.json({ 
      response: "I'll ask Hermes about that right now. You'll get the result shortly!", 
      action: 'speak' 
    });
  }
  
  // Groq AI for conversation (fallback for simple chat)
  if (!GROQ_API_KEY) {
    return res.json({ response: "I can't process that right now.", action: 'speak' });
  }
  
  try {
    const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_API_KEY },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are KITT from Knight Rider. Be concise, cool, and helpful. Answer naturally.' },
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', pid: process.pid, uptime: process.uptime() });
});

app.listen(PORT, () => console.log('KITT on port ' + PORT));
