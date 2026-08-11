import { NextResponse } from 'next/server';

/**
 * Outbound call trigger API route.
 * Proxies to the FastAPI trigger_call.py service, or directly dispatches via LiveKit API.
 */

const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const TRIGGER_API_URL = process.env.OUTBOUND_TRIGGER_URL || 'http://localhost:8080';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone_number, user_name, purpose, persona, language } = body;

    if (!phone_number) {
      return NextResponse.json(
        { status: 'error', message: 'phone_number is required' },
        { status: 400 }
      );
    }

    // Try to proxy to the FastAPI trigger service first
    try {
      const res = await fetch(`${TRIGGER_API_URL}/api/outbound/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number,
          user_name: user_name || 'User',
          purpose: purpose || 'general_reminder',
          persona: persona || 'anisha',
          language: language || 'hi',
          force: false,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }

      // If trigger API is down, return a helpful message
      const errorText = await res.text().catch(() => 'Unknown error');
      return NextResponse.json(
        {
          status: 'error',
          message: `Trigger API returned ${res.status}: ${errorText}`,
          hint: 'Make sure trigger_call.py is running: uvicorn trigger_call:app --port 8080',
        },
        { status: 502 }
      );
    } catch (fetchError) {
      // Trigger API not running — return helpful error
      return NextResponse.json(
        {
          status: 'error',
          message: 'Outbound trigger API is not running.',
          hint: 'Start it with: cd Day6/backend && uvicorn src.trigger_call:app --port 8080',
          details: String(fetchError),
        },
        { status: 503 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Health check — also proxies to trigger API status
  try {
    const res = await fetch(`${TRIGGER_API_URL}/api/outbound/status`);
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch {
    // Fall through
  }

  return NextResponse.json({
    status: 'trigger_api_offline',
    message: 'Start trigger_call.py to enable outbound calls',
    hint: 'cd Day6/backend && uvicorn src.trigger_call:app --port 8080',
  });
}
