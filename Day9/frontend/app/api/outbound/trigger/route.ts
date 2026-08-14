import { NextResponse } from 'next/server';
import { AccessToken, type VideoGrant } from 'livekit-server-sdk';

/**
 * Outbound call trigger — dispatches directly to LiveKit.
 * No separate FastAPI needed.
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

    const roomName = `outbound-${phone_number.replace(/\+/g, '')}-${Date.now()}`;

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

    // Create a proper admin token
    const token = await createAdminToken(roomName);
    const httpUrl = LIVEKIT_URL.replace('wss://', 'https://').replace('ws://', 'http://');

    const response = await fetch(`${httpUrl}/twirp/livekit.AgentDispatchService/CreateDispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
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

async function createAdminToken(roomName: string): Promise<string> {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: 'voicepay-service',
    ttl: '2m',
  });

  const grant: VideoGrant = {
    room: roomName,
    roomCreate: true,
    roomAdmin: true,
    roomJoin: true,
    roomList: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  };
  at.addGrant(grant);

  return await at.toJwt();
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    message: 'Outbound trigger ready',
  });
}
