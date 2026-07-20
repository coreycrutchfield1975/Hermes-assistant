const https = require('https');

const token = '47f8a8...n';

function api(method, path, data) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.cloudflare.com',
      path: '/client/v4' + path,
      method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(opts, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch(e) { reject(body); }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  // Verify token
  const verify = await api('GET', '/user/tokens/verify');
  console.log('Token valid:', verify.success);
  if (!verify.success) {
    console.log(JSON.stringify(verify.errors, null, 2));
    return;
  }

  // Get accounts
  const accounts = await api('GET', '/accounts');
  console.log('Accounts:', accounts.result.map(a => a.id + ' ' + a.name));

  if (accounts.result && accounts.result.length > 0) {
    const accountId = accounts.result[0].id;

    // Create a named tunnel
    const tunnel = await api('POST', '/accounts/' + accountId + '/cfd_tunnel', {
      name: 'kitt-bridge',
      tunnel_secret: require('crypto').randomBytes(32).toString('base64')
    });
    console.log('Tunnel created:', JSON.stringify(tunnel, null, 2).substring(0, 300));

    if (tunnel.success && tunnel.result) {
      const tunnelId = tunnel.result.id;
      // Route a DNS record
      const dns = await api('POST', '/accounts/' + accountId + '/cfd_tunnel/' + tunnelId + '/dns', {
        type: 'CNAME',
        name: 'kitt-bridge',
        cloudflare: true
      });
      console.log('DNS routed:', dns.success);

      // Get tunnel token
      const tokenResult = await api('GET', '/accounts/' + accountId + '/cfd_tunnel/' + tunnelId + '/token');
      console.log('Tunnel token:', tokenResult.success ? tokenResult.result.substring(0, 30) + '...' : 'failed');

      // Save credentials
      const fs = require('fs');
      const creds = {
        AccountTag: accountId,
        TunnelID: tunnelId,
        TunnelName: 'kitt-bridge',
        TunnelToken: tokenResult.result
      };
      fs.writeFileSync('C:/Users/corey/.cloudflared/kitt-bridge-creds.json', JSON.stringify(creds, null, 2));
      console.log('Credentials saved to .cloudflared/kitt-bridge-creds.json');
      console.log('Tunnel ID:', tunnelId);
    }
  }
}

main();
