import { generateSpeech } from '@/lib/elevenlabs';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { text, voiceId } = await request.json();
    if (!text || !voiceId) {
      return NextResponse.json({ error: 'Missing text or voiceId' }, { status: 400 });
    }

    const audioStream = await generateSpeech(text, voiceId);
    return new NextResponse(audioStream, {
      headers: { 'Content-Type': 'audio/mpeg' },
    });
  } catch (error) {
    console.error('Speech generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
