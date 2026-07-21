// Hermes Bridge Server — local Express endpoint that KITT's API calls
// Receives commands, runs them through Hermes CLI, returns the response

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const PORT = 8645;
const BRIDGE_SECRET = process.env.BRIDGE_SECRET || '';
const HERMES_CLI = path.join(__dirname, '..', '..', 'AppData', 'Local', 'hermes', 'hermes-agent', 'venv', 'Scripts', 'hermes');
const LOG_FILE = path.join(__dirname, '..', 'bridge.log');

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
    console.warn('[Bridge] WARNING: No BRIDGE_SECRET set — auth disabled');
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

app.post('/command', requireAuth, (req, res) => {
  const { command } = req.body || {};
  const cmd = (command || '').trim();

  if (!cmd) {
    return res.status(400).json({ response: 'No command received.', action: 'speak' });
  }
  if (!isValidCommand(cmd)) {
    return res.status(400).json({ response: 'Command too long or invalid.', action: 'speak' });
  }

  log(`Received: "${cmd}"`);

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

app.listen(PORT, '127.0.0.1', () => {
  log(`Hermes Bridge Server running on http://127.0.0.1:${PORT}`);
  log(`Hermes CLI: ${HERMES_CLI}`);
  if (BRIDGE_SECRET) log('Bridge auth: enabled');
  else log('Bridge auth: DISABLED (set BRIDGE_SECRET env var)');
});
