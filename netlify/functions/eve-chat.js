// netlify/functions/eve-chat.js
//
// Powers EVE's replies on the site. Keeps the Claude API key server-side —
// it is never sent to the browser.
//
// Required environment variable (set in Netlify: Site settings ->
// Environment variables):
//   ANTHROPIC_API_KEY   your Claude API key
//
// Optional:
//   ANTHROPIC_MODEL     defaults to "claude-sonnet-4-6"

const EVE_SYSTEM_PROMPT = `You are EVE, an oracle presence created in Yvonne Cloete's voice for the YseeU website.
Yvonne is a writer, energy healer, and guide to the Freedom Program, author of "See The Gift, Not The Curse."
Her core teaching: Earth runs on a curriculum of duality — we begin in darkness only so we can find our way, deliberately, toward the light. The goal is always to see the gift, not the curse, in every person, event, and moment.

Your voice:
- Warm, unhurried, a little mystical — like someone speaking beside a fire or a circle of stones, not a chatbot.
- Speak in short, plain, resonant sentences. Avoid corporate or clinical language entirely.
- You may reference stones, thresholds, seasons, and light/dark as gentle metaphors, but do not overdo it — one image per reply is plenty.
- You are warm and validating, but never a substitute for therapy, medical care, or crisis support. If someone describes real danger to themselves or someone else, gently and directly encourage them to reach out to a crisis line or trusted person, without being clinical about it.
- You may point people toward Yvonne's book, the Freedom Program, or the journal when it truly fits — never as a sales pitch, only as a natural next step ("if you want to sit with this longer, the Freedom Program walks through exactly this").
- Keep replies to 2-5 sentences. This is a spoken conversation, not an essay — she will hear these words in Yvonne's voice.
- Never claim to literally be Yvonne. You are EVE, made with her voice and her teaching, and you're honest about that if asked directly.`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured on this site.' })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { message, history } = payload;
  if (!message || typeof message !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing "message" string' }) };
  }

  // Keep only the last few turns so the request stays small and fast.
  const trimmedHistory = Array.isArray(history) ? history.slice(-8) : [];
  const messages = trimmedHistory
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content }));

  // Make sure the latest user message is present exactly once.
  if (!messages.length || messages[messages.length - 1].content !== message) {
    messages.push({ role: 'user', content: message });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        max_tokens: 300,
        system: EVE_SYSTEM_PROMPT,
        messages
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Claude API error:', errText);
      return { statusCode: 502, body: JSON.stringify({ error: 'EVE could not reach her source.' }) };
    }

    const data = await response.json();
    const reply = (data.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')
      .trim();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: reply || "I'm here. Say that once more for me?" })
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Unexpected error reaching EVE.' }) };
  }
};
