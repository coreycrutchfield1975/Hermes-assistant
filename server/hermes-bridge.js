// Hermes Bridge Server — local Express endpoint that KITT's API calls
// Receives commands, runs them through Hermes CLI, returns the response

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const PORT = 8645;
const BRIDGE_SECRET = process.env.BRIDGE_SECRET || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const HERMES_CLI = path.join(__dirname, '..', '..', 'AppData', 'Local', 'hermes', 'hermes-agent', 'venv', 'Scripts', 'hermes');
const LOG_FILE = path.join(__dirname, '..', 'bridge.log');
const TEMPLATE_PATH = path.join(__dirname, 'kitt-template.html');

const app = express();
app.use(express.json({ limit: '100kb' }));

function secureCompare(a, b) {
  if (!a || !b) return false;
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireAuth(req, res, next) {
  const secret = req.headers['x-bridge-secret'];
  if (!BRIDGE_SECRET) {
    console.warn('[Bridge] WARNING: No BRIDGE_SECRET set - auth disabled');
    return next();
  }
  if (!secret || !secureCompare(secret, BRIDGE_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized', action: 'speak' });
  }
  next();
}

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  console.log(line.trim());
  fs.appendFileSync(LOG_FILE, line);
}

function isValidCommand(cmd) {
  return typeof cmd === 'string' && cmd.length > 0 && cmd.length <= 2000;
}

app.post('/command', requireAuth, async (req, res) => {
  const { command } = req.body || {};
  const cmd = (command || '').trim();
  if (!cmd) return res.status(400).json({ response: 'No command received.', action: 'speak' });
  if (!isValidCommand(cmd)) return res.status(400).json({ response: 'Command too long or invalid.', action: 'speak' });
  log(`Received: "${cmd}"`);

  const lower = cmd.toLowerCase();

  // Quick local commands (instant)
  if (lower.includes('time')) {
    const now = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', hour12: true });
    return res.json({ response: `It's ${now}`, action: 'speak' });
  }
  if (lower.includes('date')) {
    const d = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return res.json({ response: `Today is ${d}`, action: 'speak' });
  }
  if (lower.includes('open charge rn') || lower.includes('charge rn')) {
    return res.json({ response: 'Opening Charge RN', action: 'open', url: 'https://chargenurse-app.vercel.app/charge-rn.html' });
  }
  if (lower.includes('open morning')) {
    return res.json({ response: 'Opening Morning Report', action: 'open', url: 'https://chargenurse-app.vercel.app/morning-report.html' });
  }
  if (lower.includes('open clc') || lower.includes('clc scheduler')) {
    return res.json({ response: 'Opening CLC Scheduler', action: 'open', url: 'https://clcscheduler.vercel.app' });
  }
  if (lower.includes('open launchpad')) {
    return res.json({ response: 'Opening Launchpad', action: 'open', url: 'https://clc-workstation.vercel.app' });
  }
  if (lower.includes('search ') || lower.includes('find ')) {
    const q = lower.replace(/search |find |for |about /g, '').trim();
    return res.json({ response: 'Searching for ' + q, action: 'open', url: 'https://duckduckgo.com/?q=' + encodeURIComponent(q) });
  }
  if (lower.includes('weather')) {
    const loc = lower.replace(/weather |in |at /g, '').trim() || 'Missouri';
    return res.json({ response: 'Checking weather', action: 'open', url: 'https://duckduckgo.com/?q=weather+' + encodeURIComponent(loc) });
  }
  if (lower.includes('joke')) {
    return res.json({ response: 'Why did the scarecrow win an award? Because he was outstanding in his field!', action: 'speak' });
  }

  // Complex task words that need Hermes
  const complexWords = ['deploy', 'edit', 'build', 'create', 'update', 'change', 'fix', 'add', 'remove', 'make', 'schedule', 'remind', 'email', 'message', 'send', 'research', 'search web'];
  const needsHermes = complexWords.some(w => lower.includes(w));

  // Prevent "date" matching "update" etc.
  if (lower === 'date' || lower.startsWith('date ') || lower.startsWith("what's the date") || lower.startsWith("what is the date")) {
    const d = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return res.json({ response: `Today is ${d}`, action: 'speak' });
  }

  if (!needsHermes) {
    // Fast path: Groq AI (1-2 seconds)
    if (GROQ_API_KEY) {
      try {
        const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_API_KEY },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: 'You are KITT from Knight Rider. Be concise, cool, and helpful. Answer in 1-2 sentences.' },
              { role: 'user', content: cmd }
            ],
            max_tokens: 150,
            temperature: 0.7
          })
        });
        if (groqResp.ok) {
          const groq = await groqResp.json();
          if (groq.choices && groq.choices[0]) {
            const reply = groq.choices[0].message.content;
            log(`Groq: "${reply.substring(0, 100)}..."`);
            return res.json({ response: reply, action: 'speak' });
          }
        }
      } catch (e) {
        log(`Groq error: ${e.message}`);
      }
    }
  }

  // Slow path: Hermes CLI (15-30s for complex tasks)
  log(`Routing to Hermes CLI: "${cmd}"`);

  const hermes = spawn(HERMES_CLI, ['chat', '-q', cmd, '--quiet'], {
    timeout: 60000,
    windowsHide: true,
    shell: false
  });

  let stdout = '';
  let stderr = '';

  hermes.stdout.on('data', (data) => { stdout += data.toString(); });
  hermes.stderr.on('data', (data) => { stderr += data.toString(); });

  hermes.on('error', (err) => {
    log(`Spawn error: ${err.message}`);
    res.status(500).json({ response: 'Failed to process command.', action: 'speak' });
  });

  hermes.on('close', (code) => {
    if (code !== 0) {
      log(`Exit code: ${code}, stderr: ${stderr.substring(0, 200)}`);
    }
    const lines = stdout.trim().split('\n');
    const responseLines = [];
    for (const line of lines) {
      if (line.startsWith('Session:')) break;
      if (line.startsWith('hermes --resume')) continue;
      if (line.startsWith('Duration:')) continue;
      if (line.startsWith('Messages:')) continue;
      if (line.trim()) responseLines.push(line);
    }
    const response = responseLines.join('\n').trim() || 'Done.';
    log(`Response: "${response.substring(0, 200)}..."`);
    res.json({ response, action: 'speak' });
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', pid: process.pid, uptime: process.uptime() });
});

// Landing page - full KITT UI
app.get('/', (req, res) => {
  try {
    let html = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    html = html.replace("'x-bridge-secret':'0'", "'x-bridge-secret':'" + BRIDGE_SECRET + "'");
    res.type('html').send(html);
  } catch (e) {
    res.status(500).send('Template not found: ' + e.message);
  }
});

// SVG icons
app.get('/icon.svg', (req, res) => {
  res.type('svg').send('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#ff1a1a"/><text x="50" y="68" text-anchor="middle" font-size="50" font-weight="bold" fill="#fff" font-family="Arial">K</text></svg>');
});
app.get('/favicon.svg', (req, res) => { res.redirect('/icon.svg'); });
app.get('/manifest.json', (req, res) => {
  res.json({
    name: "KITT - Voice Agent", short_name: "KITT", display: "fullscreen", orientation: "portrait",
    background_color: "#050508", theme_color: "#ff1a1a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
    start_url: "/", scope: "."
  });
});

app.listen(PORT, '127.0.0.1', () => {
  log(`Hermes Bridge Server running on http://127.0.0.1:${PORT}`);
  log(`Hermes CLI: ${HERMES_CLI}`);
  if (BRIDGE_SECRET) log('Bridge auth: enabled');
  else log('Bridge auth: DISABLED (set BRIDGE_SECRET env var)');
  if (GROQ_API_KEY) log('Groq API: enabled (fast path for chat)');
  else log('Groq API: not set (all requests go to Hermes CLI)');
});
