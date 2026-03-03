const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

export async function getVoices() {
  if (!ELEVENLABS_API_KEY) throw new Error('Missing ELEVENLABS_API_KEY');

  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': ELEVENLABS_API_KEY },
  });

  if (!response.ok) throw new Error('Failed to fetch voices');
  const data = await response.json();
  return data.voices;
}

export async function generateSpeech(text, voiceId, { singleWord = false } = {}) {
  if (!ELEVENLABS_API_KEY) throw new Error('Missing ELEVENLABS_API_KEY');

  // Single words: max stability, no style, no filler sounds
  // Full sentences: slightly more expressive
  const voice_settings = singleWord
    ? { stability: 1.0, similarity_boost: 0.85, style: 0.0, use_speaker_boost: false }
    : { stability: 0.75, similarity_boost: 0.75, style: 0.05, use_speaker_boost: true };

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text: singleWord ? text + "." : text,
      model_id: 'eleven_multilingual_v2',
      voice_settings,
      speed: singleWord ? 0.8 : 0.75,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('ElevenLabs Error:', errorBody);
    throw new Error('Failed to generate speech');
  }

  return response.body;
}
