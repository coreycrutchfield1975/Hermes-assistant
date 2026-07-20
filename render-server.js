const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

// Serve static files from the root
app.use(express.static(__dirname));

// API endpoint
app.post('/api', express.json(), async (req, res) => {
  const command = req.body?.command || '';
  if (!command) return res.json({ response: 'Say something...', action: 'speak' });
  
  const cmd = command.toLowerCase().trim();
  
  // Quick commands
  if (cmd.includes('time') && !cmd.includes('what') || cmd.includes('what time')) {
    const now = new Date();
    const options = { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', hour12: true };
    return res.json({ response: now.toLocaleTimeString('en-US', options), action: 'speak' });
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
    const loc = cmd.replace(/weather|in|at/g, '').trim() || 'Missouri';
    return res.json({ response: 'Checking weather', action: 'open', url: 'https://duckduckgo.com/?q=weather+' + encodeURIComponent(loc) });
  }
  if (cmd.includes('joke')) {
    return res.json({ response: 'Why did the scarecrow win an award? Because he was outstanding in his field!', action: 'speak' });
  }
  
  // Groq AI
  try {
    const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (process.env.GROQ_API_KEY || '') },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are KITT, a cool voice assistant with Knight Rider personality. Be concise and helpful.' },
          { role: 'user', content: cmd }
        ],
        max_tokens: 200,
        temperature: 0.7
      })
    });
    const groq = await groqResp.json();
    if (groq.choices?.[0]) {
      return res.json({ response: groq.choices[0].message.content, action: 'speak' });
    }
  } catch (e) {
    console.error('Groq error:', e.message);
  }
  
  // Bridge to Hermes on Telegram for complex tasks
  const complexKeywords = ['deploy', 'edit', 'build', 'create', 'update', 'change', 'fix', 'add', 'remove', 'make', 'schedule', 'remind', 'email', 'message', 'send'];
  const isComplex = complexKeywords.some(k => cmd.includes(k));
  
  if (isComplex) {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '8973134274';
    if (BOT_TOKEN) {
      try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            text: `🎤 KITT needs you: ${command}`
          })
        });
        console.log('Forwarded to Hermes');
      } catch (e) {
        console.error('Telegram forward failed:', e.message);
      }
    }
  }
  
  return res.json({ response: 'I heard you. Try asking me something else.', action: 'speak' });
});

app.listen(PORT, () => console.log('Hermes KITT running on port ' + PORT));
