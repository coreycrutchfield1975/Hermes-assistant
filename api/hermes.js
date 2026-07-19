// Hermes AI Bridge — connects KITT voice app to Groq (Llama 3)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { command } = req.body || {};
    const cmd = (command || '').trim();
    if (!cmd) return res.json({ response: "I'm listening. What do you need?", action: 'speak', visualization: 'idle' });

    // System prompt — tells Groq who it is
    const systemPrompt = 'You are Hermes, a voice AI assistant inspired by KITT from Knight Rider and Jarvis from Iron Man. You are concise, helpful, and slightly witty. You speak in short, natural sentences since responses are spoken aloud. You can open apps, search the web, tell jokes, answer questions, and have conversation. Keep responses under 3 sentences when possible. Never mention you are an AI. Just be Hermes.';

    const groqKey = process.env.GROQ_API_KEY || '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';

    // Build the conversation
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: cmd }
    ];

    // Call Groq API
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + groqKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: messages,
        max_tokens: 150,
        temperature: 0.7
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq error:', groqRes.status, errText);
      return res.json({
        response: "I'm having trouble connecting to my brain. Try again.",
        action: 'speak',
        visualization: 'idle'
      });
    }

    const groqData = await groqRes.json();
    const aiResponse = groqData.choices[0].message.content.trim();

    // Check if the response implies opening something
    const lower = cmd.toLowerCase();
    const apps = {
      'charge rn': 'https://chargenurse-app.vercel.app/charge-rn.html',
      'morning report': 'https://chargenurse-app.vercel.app/morning-report.html',
      'scheduler': 'https://clcscheduler.vercel.app/',
      'landing page': 'https://chargenurse-app.vercel.app/',
      'google': 'https://google.com',
      'gmail': 'https://mail.google.com',
      'youtube': 'https://youtube.com',
    };

    // If the user asked to open something, extract the URL
    if (lower.startsWith('open ') || lower.startsWith('go to ')) {
      const target = lower.replace(/^(open |go to )/, '').trim();
      for (const key in apps) {
        if (target.includes(key)) {
          return res.json({
            response: aiResponse,
            action: 'open',
            url: apps[key],
            visualization: 'processing'
          });
        }
      }
      // Unknown app — search
      return res.json({
        response: aiResponse,
        action: 'open',
        url: 'https://google.com/search?q=' + encodeURIComponent(target),
        visualization: 'processing'
      });
    }

    // Search
    if (lower.startsWith('search ') || lower.startsWith('search for ') || lower.startsWith('look up ')) {
      const q = lower.replace(/^(search |search for |look up )/, '').trim();
      return res.json({
        response: aiResponse,
        action: 'open',
        url: 'https://google.com/search?q=' + encodeURIComponent(q),
        visualization: 'processing'
      });
    }

    // Weather
    if (lower.includes('weather')) {
      return res.json({
        response: aiResponse,
        action: 'open',
        url: 'https://google.com/search?q=weather',
        visualization: 'processing'
      });
    }

    // Pure conversation — just speak the AI response
    return res.json({
      response: aiResponse,
      action: 'speak',
      visualization: 'thinking'
    });

  } catch (err) {
    console.error('Hermes API error:', err);
    return res.status(500).json({ response: 'System error. Try again.', action: 'speak', visualization: 'idle' });
  }
}
