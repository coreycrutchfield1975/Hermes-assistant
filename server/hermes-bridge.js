// Hermes Bridge Server — local Express endpoint that KITT's API calls
// Receives commands, runs them through Hermes CLI, returns the response
// No Telegram middleman, no polling — instant Jarvis-style answer

const express = require('express');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 8645;
const HERMES_CLI = path.join(__dirname, '..', '..', 'AppData', 'Local', 'hermes', 'hermes-agent', 'venv', 'Scripts', 'hermes');
const LOG_FILE = path.join(__dirname, '..', 'bridge.log');

const app = express();
app.use(express.json());

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  console.log(line.trim());
  fs.appendFileSync(LOG_FILE, line);
}

// Handle commands from KITT
app.post('/command', (req, res) => {
  const { command, history } = req.body || {};
  const cmd = (command || '').trim();
  
  if (!cmd) {
    return res.json({ response: 'No command received.', action: 'speak' });
  }

  log(`Received: "${cmd}"`);
  
  try {
    // Run the command through Hermes CLI
    // Use execSync with timeout and capture stdout
    const result = execSync(
      `"${HERMES_CLI}" chat -q ${JSON.stringify(cmd)} --quiet 2>&1`,
      { 
        timeout: 60000,  // 60s max
        encoding: 'utf8',
        maxBuffer: 100 * 1024  // 100KB
      }
    );

    // Parse response - Hermes outputs session summary at end
    const lines = result.trim().split('\n');
    const responseLines = [];
    let inResponse = false;
    
    for (const line of lines) {
      if (line.startsWith('Session:')) break; // Skip session footer
      if (line.startsWith('hermes --resume')) continue; // Skip resume hint
      if (line.startsWith('Duration:')) continue;
      if (line.startsWith('Messages:')) continue;
      if (line.trim()) responseLines.push(line);
    }

    const response = responseLines.join('\n').trim() || 'Done.';
    log(`Response: "${response.substring(0, 200)}..."`);
    
    res.json({ response, action: 'speak' });
  } catch (e) {
    log(`Error: ${e.message}`);
    res.json({ 
      response: `I ran into an issue: ${e.message.substring(0, 200)}`, 
      action: 'speak' 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', pid: process.pid });
});

app.listen(PORT, '127.0.0.1', () => {
  log(`Hermes Bridge Server running on http://127.0.0.1:${PORT}`);
  log(`Hermes CLI: ${HERMES_CLI}`);
});
