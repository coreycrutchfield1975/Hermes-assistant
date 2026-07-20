
// Hermes Bridge v7 — Cloudflare Pages Functions
// Quick commands local, Groq AI for conversation

export async function onRequest(context) {
  const { request, env } = context;
  
  // Get env vars
  const GROQ_API_KEY = env.GROQ_API_KEY || '';
  const BRIDGE_URL = env.HERMES_BRIDGE_URL || '';
  const BRIDGE_SECRET = env.HERMES_BRIDGE_SECRET || '';

  // CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }
  
  if (request.method !== 'POST') {
    return new Response('POST only', { status: 405 });
  }

  const body = await request.json();
  const command = body.command || '';
  if (!command) {
    return Response.json({ response: 'Say something...', action: 'speak' }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
  
  const cmd = command.toLowerCase().trim();
  
  // Quick commands
  if (cmd.includes('time') && !cmd.includes('what')) {
    return Response.json({ response: new Date().toLocaleTimeString(), action: 'speak' }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
  if (cmd.includes('date')) {
    return Response.json({ response: new Date().toLocaleDateString(), action: 'speak' }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
  if (cmd.includes('open charge rn') || cmd.includes('charge rn')) {
    return Response.json({ response: 'Opening Charge RN', action: 'open', url: 'https://chargenurse-app.vercel.app/charge-rn.html' }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
  if (cmd.includes('open morning report') || cmd.includes('morning')) {
    return Response.json({ response: 'Opening Morning Report', action: 'open', url: 'https://chargenurse-app.vercel.app/morning-report.html' }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
  if (cmd.includes('open clc') || cmd.includes('clc scheduler')) {
    return Response.json({ response: 'Opening CLC Scheduler', action: 'open', url: 'https://clcscheduler.vercel.app' }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
  if (cmd.includes('open launchpad')) {
    return Response.json({ response: 'Opening Launchpad', action: 'open', url: 'https://clc-workstation.vercel.app' }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
  if (cmd.includes('search') || cmd.includes('find')) {
    const q = cmd.replace(/search|find|for|about/g, '').trim();
    return Response.json({ response: 'Searching...', action: 'open', url: 'https://duckduckgo.com/?q=' + encodeURIComponent(q) }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
  if (cmd.includes('weather')) {
    const location = cmd.replace(/weather|in|at/g, '').trim() || 'Missouri';
    return Response.json({ response: 'Checking weather for ' + location, action: 'open', url: 'https://duckduckgo.com/?q=weather+' + encodeURIComponent(location) }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
  if (cmd.includes('joke')) {
    return Response.json({ response: 'Why did the scarecrow win an award? Because he was outstanding in his field!', action: 'speak' }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
  
  // Try Groq AI
  try {
    const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_API_KEY },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are KITT, a cool voice assistant with Knight Rider personality. Be concise and helpful. For quick tasks answer directly. For complex real-world tasks, say "I will ask Hermes about that" to route to the main AI.' },
          { role: 'user', content: cmd }
        ],
        max_tokens: 200,
        temperature: 0.7
      })
    });
    const groq = await groqResp.json();
    if (groq.choices && groq.choices[0]) {
      const reply = groq.choices[0].message.content;
      return Response.json({ response: reply, action: 'speak' }, {
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }
  } catch (e) {
    console.error('Groq error:', e.message);
  }
  
  // Fallback
  return Response.json({ response: 'I heard you. Try asking me something else.', action: 'speak' }, {
    headers: { 'Access-Control-Allow-Origin': '*' }
  });
}
