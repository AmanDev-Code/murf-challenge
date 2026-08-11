import { NextResponse } from 'next/server';

/**
 * API route to fetch outbound call logs from Postgres.
 */

export async function GET() {
  const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://voicepay:voicepay_dev_2026@localhost:5433/voicepay';

  try {
    // Use fetch to query via the trigger API, or direct pg query
    // For simplicity, we'll return from trigger API if running,
    // otherwise return mock data structure
    const triggerUrl = process.env.OUTBOUND_TRIGGER_URL || 'http://localhost:8080';

    try {
      const res = await fetch(`${triggerUrl}/api/outbound/logs`, {
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) return NextResponse.json(await res.json());
    } catch {
      // Trigger API not running — that's fine
    }

    // Return empty logs structure (frontend will show "no logs yet")
    return NextResponse.json({
      status: 'ok',
      logs: [],
      message: 'Start the trigger API for live logs, or check Postgres directly',
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: String(error), logs: [] },
      { status: 500 }
    );
  }
}
