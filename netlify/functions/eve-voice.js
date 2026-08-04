// netlify/functions/eve-voice.js
//
// Turns EVE's text reply into audio using ElevenLabs, in Yvonne's own
// cloned voice. Keeps the ElevenLabs API key server-side.
//
// Required environment variable (set in Netlify: Site settings ->
// Environment variables):
//   ELEVENLABS_API_KEY   your ElevenLabs API key
//
// Optional:
//   ELEVENLABS_VOICE_ID  defaults to Yvonne's cloned voice below
//   ELEVENLABS_MODEL     defaults to "eleven_multilingual_v2"

const DEFAULT_VOICE_ID = 'Il9Tady3F77uZ44zxDax'; // Yvonne's cloned voice

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'ELEVENLABS_API_KEY is not configured on this site.' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { text } = payload;
  if (!text || typeof text !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing "text" string' }) };
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: text.slice(0, 1000),
        model_id: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('ElevenLabs error:', errText);
      return { statusCode: 502, body: JSON.stringify({ error: 'Voice unavailable right now.' }) };
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'audio/mpeg' },
      body: base64,
      isBase64Encoded: true
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Unexpected error generating voice.' }) };
  }
};
