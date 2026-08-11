import { NextResponse } from 'next/server';
import { AccessToken, type VideoGrant } from 'livekit-server-sdk';

/**
 * Hangup an outbound call by deleting the LiveKit room.
 * Deleting the room disconnects the SIP participant → Twilio sends BYE → call ends.
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

    const token = await createAdminToken(room_name);
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
      return NextResponse.json({ status: 'ended', message: 'Call ended — room deleted' });
    } else {
      const errText = await response.text().catch(() => '');
      return NextResponse.json(
        { status: 'error', message: `Hangup failed: ${response.status} ${errText}` },
        { status: 502 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: String(error) },
      { status: 500 }
    );
  }
}

async function createAdminToken(roomName: string): Promise<string> {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: 'voicepay-service',
    ttl: '1m',
  });
  const grant: VideoGrant = {
    room: roomName,
    roomCreate: true,
    roomAdmin: true,
    roomJoin: true,
    roomList: true,
    canPublish: true,
    canSubscribe: true,
  };
  at.addGrant(grant);
  return await at.toJwt();
}
