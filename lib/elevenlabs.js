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

export async function generateSpeech(text, voiceId) {
  if (!ELEVENLABS_API_KEY) throw new Error('Missing ELEVENLABS_API_KEY');

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.70,
        style: 0.25,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('ElevenLabs Error:', errorBody);
    throw new Error('Failed to generate speech');
  }

  return response.body;
}
