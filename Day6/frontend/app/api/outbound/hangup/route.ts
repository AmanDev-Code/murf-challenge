import { NextResponse } from 'next/server';
import { AccessToken, type VideoGrant } from 'livekit-server-sdk';

/**
 * Hangup an outbound call by deleting the LiveKit room.
 */

const LIVEKIT_URL = process.env.LIVEKIT_URL || '';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { room_name } = body;

    if (!room_name) {
      return NextResponse.json(
        { status: 'error', message: 'room_name is required' },
        { status: 400 }
      );
    }

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: 'voicepay-admin',
      ttl: '1m',
    });
    const grant: VideoGrant = {
      roomCreate: true,
      roomAdmin: true,
      roomList: true,
      roomJoin: true,
      room: '*',
      canPublish: true,
      canSubscribe: true,
    };
    at.addGrant(grant);
    const token = await at.toJwt();

    const httpUrl = LIVEKIT_URL.replace('wss://', 'https://').replace('ws://', 'http://');

    const response = await fetch(`${httpUrl}/twirp/livekit.RoomService/DeleteRoom`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ room: room_name }),
    });

    if (response.ok) {
      return NextResponse.json({ status: 'ended', message: 'Call ended' });
    }

    const errText = await response.text().catch(() => '');
    if (response.status === 404 || errText.includes('not found')) {
      return NextResponse.json({ status: 'ended', message: 'Call already ended' });
    }

    return NextResponse.json(
      { status: 'error', message: `Hangup failed: ${response.status} ${errText}` },
      { status: 502 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: String(error) },
      { status: 500 }
    );
  }
}
