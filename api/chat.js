// api/chat.js
// ─────────────────────────────────────────────────────────────
// Vercel Serverless Function — Groq AI Proxy
//
// ARCHITECTURE ROLE:
//   Browser sends messages here → this function adds the secret
//   key and forwards to Groq → response comes back to browser.
//   The Groq API key lives only in Vercel Environment Variables.
//   It never touches your HTML, GitHub, or the browser.
//
// RATE LIMITING:
//   Each visitor IP is limited to 20 requests per minute.
//   Uses in-memory Map — resets on cold starts (fine for portfolio).
//   For production scale: replace with Upstash Redis.
// ─────────────────────────────────────────────────────────────

const rateLimit = new Map();
const MAX_REQUESTS = 20;
const WINDOW_MS = 60 * 1000;

function isRateLimited(ip) {
  const now = Date.now();
  const record = rateLimit.get(ip);
  if (!record || now > record.resetTime) {
    rateLimit.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return false;
  }
  if (record.count >= MAX_REQUESTS) return true;
  record.count++;
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({
      error: { message: 'Too many requests. Please wait a moment before asking again.' }
    });
  }

  if (!req.body?.messages) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  // Enforce model server-side — frontend cannot override this
  const safeBody = {
    model: 'llama-3.3-70b-versatile',
    messages: req.body.messages,
    max_tokens: 1024,
  };

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify(safeBody)
    });

    const data = await response.json();
    return res.status(response.status).json(data);

  } catch (error) {
    return res.status(500).json({
      error: { message: 'AI service temporarily unavailable. Try again.' }
    });
  }
}
