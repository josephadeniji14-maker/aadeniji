// api/log.js
// ─────────────────────────────────────────────────────────────
// Vercel Serverless Function — Supabase Visitor Log Proxy
//
// ARCHITECTURE ROLE:
//   Browser sends session data here → this function adds the
//   Supabase secret key and forwards to Supabase REST API.
//   SUPABASE_URL and SUPABASE_KEY live only in Vercel env vars.
//
// POST → save or update a visitor session
// GET  → fetch all sessions (for your admin log)
// ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
  };

  // ── POST: save or update a visitor session ──
  if (req.method === 'POST') {
    try {
      const { id, mode, prompts } = req.body;

      if (id) {
        // Update existing session with new prompts
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/visitor_sessions?id=eq.${id}`,
          { method: 'PATCH', headers, body: JSON.stringify({ prompts }) }
        );
        return res.status(response.status).json({ ok: true });

      } else {
        // Insert a new session row
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/visitor_sessions`,
          {
            method: 'POST',
            headers: { ...headers, 'Prefer': 'return=representation' },
            body: JSON.stringify({ mode, prompts: prompts || [] })
          }
        );
        const data = await response.json();
        return res.status(response.status).json(data);
      }

    } catch (error) {
      return res.status(500).json({ error: 'Failed to save session' });
    }
  }

  // ── GET: fetch all sessions for admin log ──
  if (req.method === 'GET') {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/visitor_sessions?select=*&order=created_at.desc`,
        { headers }
      );
      const data = await response.json();
      return res.status(200).json(data);

    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
