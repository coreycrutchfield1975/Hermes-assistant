const https = require('https');

const API_TOKEN = '47f8a81fb37fac015d4fb60077e3c6e6';

function api(method, path, data) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'api.cloudflare.com',
      path: '/client/v4' + path,
      method,
      headers: {
        'Authorization': 'Bearer ' + API_TOKEN,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(opts, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch(e) { resolve({ error: body }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  // Test: verify token
  const verify = await api('GET', '/user/tokens/verify');
  console.log('VERIFY RESULT:', JSON.stringify(verify, null, 2));

  if (!verify.success) {
    console.log('\nToken verification failed. Check:');
    console.log('1. Copy-paste the token exactly from Cloudflare dashboard');
    console.log('2. Go to https://dash.cloudflare.com/profile/api-tokens');
    console.log('3. Create token with "Cloudflare Tunnel" template');
    console.log('4. Paste the new token here');
    return;
  }

  // Get accounts
  const accounts = await api('GET', '/accounts');
  console.log('\nAccounts:', JSON.stringify(accounts, null, 2).substring(0, 500));
}

main();
