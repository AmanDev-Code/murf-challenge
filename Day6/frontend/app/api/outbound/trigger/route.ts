import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

/**
 * Outbound call trigger — dispatches directly to LiveKit (no separate FastAPI needed).
 * Creates an agent dispatch for "voicepay-outbound" with the phone number in metadata.
 */

const LIVEKIT_URL = process.env.LIVEKIT_URL || '';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';

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

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return NextResponse.json(
        { status: 'error', message: 'LiveKit credentials not configured' },
        { status: 500 }
      );
    }

    // Build room name for this outbound call
    const roomName = `outbound-${phone_number.replace(/\+/g, '')}-${Date.now()}`;

    // Build metadata payload that the outbound worker reads
    const metadata = JSON.stringify({
      phone_number,
      user_name: user_name || 'User',
      purpose: purpose || 'general_reminder',
      persona: persona || 'anisha',
      language: language || 'hi',
      facts: {},
      attempt: 1,
      triggered_at: new Date().toISOString(),
    });

    // Use LiveKit Server SDK to create agent dispatch
    // The dispatch tells LiveKit to spin up a room and route it to "voicepay-outbound" worker
    const httpUrl = LIVEKIT_URL.replace('wss://', 'https://').replace('ws://', 'http://');

    const response = await fetch(`${httpUrl}/twirp/livekit.AgentDispatchService/CreateDispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await createServiceToken()}`,
      },
      body: JSON.stringify({
        agent_name: 'voicepay-outbound',
        room: roomName,
        metadata: metadata,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        status: 'dispatched',
        room_name: roomName,
        phone_number,
        purpose: purpose || 'general_reminder',
        message: `Call dispatched to ${user_name || phone_number}`,
        dispatch_id: data.dispatch_id || roomName,
      });
    } else {
      const errText = await response.text().catch(() => 'Unknown error');
      return NextResponse.json(
        { status: 'error', message: `LiveKit dispatch failed: ${response.status} - ${errText}` },
        { status: 502 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: `Dispatch error: ${String(error)}` },
      { status: 500 }
    );
  }
}

async function createServiceToken(): Promise<string> {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: 'voicepay-trigger',
    ttl: '1m',
  });
  at.addGrant({
    roomCreate: true,
    roomAdmin: true,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });
  return await at.toJwt();
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    trunk_configured: true,
    message: 'Outbound trigger ready — POST phone_number to dispatch a call',
  });
}
