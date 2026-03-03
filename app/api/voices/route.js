import { getVoices } from '@/lib/elevenlabs';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const voices = await getVoices();
    return NextResponse.json({ voices });
  } catch (error) {
    console.error('Voices fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
