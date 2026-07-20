// Quick Cloudflare Tunnel Login — writes the cert.pem using API token
const https = require('https');
const fs = require('fs');
const path = require('path');

const API_TOKEN = '47f8a8...n';
const HOME = process.env.HOME || process.env.USERPROFILE;
const CERT_DIR = path.join(HOME, '.cloudflared');
const CERT_PATH = path.join(CERT_DIR, 'cert.pem');

// The cert.pem format cloudflared expects:
// https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel/
function buildCert(apiToken, accountId, email) {
  return `-----BEGIN CLOUDFLARE ORIGIN CA KEY-----\n${apiToken}\n-----END CLOUDFLARE ORIGIN CA KEY-----\n`;
}

async function getAccountInfo() {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.cloudflare.com',
      path: '/client/v4/accounts',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + API_TOKEN,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(opts, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          resolve(j);
        } catch(e) { reject(body); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('Verifying API token...');
  const info = await getAccountInfo();
  
  if (info.success && info.result && info.result.length > 0) {
    const account = info.result[0];
    console.log('Account:', account.name, 'ID:', account.id);
    
    // Write cert.pem
    const certContent = JSON.stringify({
      version: 1,
      account: account.id,
      apiToken: API_TOKEN,
      email: ''
    });
    
    if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR, { recursive: true });
    fs.writeFileSync(CERT_PATH, certContent);
    console.log('Cert saved to:', CERT_PATH);
    
    // Now create the tunnel using cloudflared
    const { execSync } = require('child_process');
    const cloudflared = 'C:/Users/corey/hermes-assistant/cloudflared.exe';
    
    console.log('Creating named tunnel...');
    const result = execSync(`"${cloudflared}" tunnel create kitt-bridge 2>&1`, {
      timeout: 30000,
      encoding: 'utf8',
      cwd: 'C:/Users/corey/hermes-assistant'
    });
    console.log(result);
    
    // Get the tunnel ID from credentials file
    const credsDir = path.join(CERT_DIR);
    const files = fs.readdirSync(credsDir).filter(f => f.endsWith('.json') && f !== 'config.yml');
    console.log('Credential files:', files);
    
    // List tunnels
    const listResult = execSync(`"${cloudflared}" tunnel list 2>&1`, {
      timeout: 15000,
      encoding: 'utf8',
      cwd: 'C:/Users/corey/hermes-assistant'
    });
    console.log('Tunnel list:', listResult);
    
  } else {
    console.log('API token failed:', JSON.stringify(info.errors || info));
    console.log('The token may need different permissions.');
    console.log('Create a token with "Cloudflare Tunnel" permissions at:');
    console.log('https://dash.cloudflare.com/profile/api-tokens');
  }
}

main();
