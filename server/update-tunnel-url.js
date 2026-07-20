// Auto-update Vercel env var with current Cloudflare tunnel URL
// Runs after bridge + tunnel start up, finds the tunnel URL from logs,
// and updates the HERMES_BRIDGE_URL env var on Vercel via their API

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'tunnel.log');
const BRIDGE_LOG = path.join(__dirname, '..', 'bridge.log');

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  console.log(line.trim());
  try { fs.appendFileSync(BRIDGE_LOG, line); } catch(e) {}
}

async function main() {
  log('Checking tunnel URL...');

  // Wait for tunnel log to contain the URL
  let tunnelUrl = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const log = fs.readFileSync(LOG_FILE, 'utf8');
      const match = log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) {
        tunnelUrl = match[0];
        break;
      }
    } catch(e) {}
    // Wait 2 seconds between checks
    await new Promise(r => setTimeout(r, 2000));
  }

  if (!tunnelUrl) {
    log('ERROR: Could not find tunnel URL after 60 seconds');
    return;
  }

  log('Found tunnel URL: ' + tunnelUrl);

  // Update Vercel env var using the Vercel CLI
  try {
    const vercelBin = path.join(__dirname, '..', '..', '..', '..', 'AppData', 'Roaming', 'npm', 'vercel');
    const result = execSync(
      `"${vercelBin}" env rm HERMES_BRIDGE_URL production --yes 2>&1 && echo "${tunnelUrl}" | "${vercelBin}" env add HERMES_BRIDGE_URL production --yes 2>&1`,
      { 
        cwd: __dirname,
        timeout: 30000,
        encoding: 'utf8',
        maxBuffer: 1024 * 10
      }
    );
    log('Vercel env updated: ' + result.trim().split('\n').pop());

    // Trigger a new deploy so the env var takes effect
    const deployResult = execSync(
      `"${vercelBin}" deploy --prod --force 2>&1`,
      { 
        cwd: __dirname,
        timeout: 60000,
        encoding: 'utf8',
        maxBuffer: 1024 * 10
      }
    );
    
    const deployLines = deployResult.trim().split('\n');
    const aliased = deployLines.find(l => l.includes('Aliased'));
    log('Deploy result: ' + (aliased || deployLines[deployLines.length - 1]));
    log('Bridge URL updated and deployed successfully!');
    
  } catch (e) {
    log('ERROR updating Vercel: ' + e.message.substring(0, 200));
  }
}

main();
