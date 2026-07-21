const express = require('express');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 10000;
app.use(express.static(__dirname));

// For Render, these come from environment variables
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '8973134274';

function sendTelegram(text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text });
    const req = https.request('https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log('Telegram sent:', res.statusCode);
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error('Telegram ' + res.statusCode + ': ' + d.substring(0,200)));
        } else {
          resolve(d);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

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
    sendTelegram('KITT: ' + command).catch(e => console.error('Telegram err:', e.message));
    // Don't await — KITT responds immediately, Telegram sends in background
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

// Telegram test endpoint
app.get('/test-telegram', async (req, res) => {
  try {
    const result = await sendTelegram('Render bridge test');
    res.json({ ok: true, result: result.substring(0, 200) });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    pid: process.pid, 
    uptime: process.uptime(),
    bot_token_set: BOT_TOKEN ? BOT_TOKEN.substring(0, 20) + '...' : 'NOT SET',
    bot_token_len: BOT_TOKEN.length,
    groq_set: GROQ_API_KEY ? GROQ_API_KEY.substring(0,10) + '...' : 'NOT SET'
  });
});

app.listen(PORT, () => console.log('KITT on port ' + PORT));
