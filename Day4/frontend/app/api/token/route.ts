import { NextResponse } from 'next/server';
import { AccessToken, type AccessTokenOptions, type VideoGrant } from 'livekit-server-sdk';
import { RoomConfiguration } from '@livekit/protocol';

type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

// NOTE: you are expected to define the following environment variables in `.env.local`:
const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const AGENT_NAME = process.env.AGENT_NAME;

// Valid voice persona IDs — must match backend VOICE_PERSONAS dict keys.
const VALID_VOICES = ['anisha', 'samar', 'pooja'] as const;
type VoiceId = (typeof VALID_VOICES)[number];

// don't cache the results
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    if (LIVEKIT_URL === undefined) {
      throw new Error('LIVEKIT_URL is not defined');
    }
    if (API_KEY === undefined) {
      throw new Error('LIVEKIT_API_KEY is not defined');
    }
    if (API_SECRET === undefined) {
      throw new Error('LIVEKIT_API_SECRET is not defined');
    }

    // Parse request body — supports optional voice selection + room_config.
    const body = await req.json().catch(() => ({}));

    // Validate voice selection (frontend sends { voice: "anisha" | "samar" | "pooja" })
    let selectedVoice: VoiceId = 'anisha'; // default
    if (body?.voice && VALID_VOICES.includes(body.voice.toLowerCase())) {
      selectedVoice = body.voice.toLowerCase() as VoiceId;
    }

    // Build room metadata JSON — the backend agent reads this on session start.
    const roomMetadata = JSON.stringify({ voice: selectedVoice });

    let roomConfig: RoomConfiguration | undefined;
    if (body?.room_config) {
      roomConfig = RoomConfiguration.fromJson(
        { ...body.room_config, metadata: roomMetadata },
        { ignoreUnknownFields: true }
      );
    } else if (AGENT_NAME) {
      // Include BOTH agent dispatch AND metadata in a single fromJson call
      // so the protobuf serialization captures both fields correctly.
      roomConfig = RoomConfiguration.fromJson(
        { agents: [{ agentName: AGENT_NAME }], metadata: roomMetadata },
        { ignoreUnknownFields: true }
      );
    } else {
      roomConfig = RoomConfiguration.fromJson(
        { metadata: roomMetadata },
        { ignoreUnknownFields: true }
      );
    }

    // Generate participant token
    const participantName = 'user';
    const participantIdentity = `voice_assistant_user_${Math.floor(Math.random() * 10_000)}`;
    const roomName = `voice_assistant_room_${Math.floor(Math.random() * 10_000)}`;

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName },
      roomName,
      roomConfig
    );

    // Return connection details
    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantName,
      participantToken,
    };
    const headers = new Headers({
      'Cache-Control': 'no-store',
    });
    return NextResponse.json(data, { headers });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return new NextResponse(error.message, { status: 500 });
    }
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  roomConfig?: RoomConfiguration
): Promise<string> {
  const at = new AccessToken(API_KEY, API_SECRET, {
    ...userInfo,
    ttl: '15m',
  });
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);

  if (roomConfig) {
    at.roomConfig = roomConfig;
  }

  return at.toJwt();
}
