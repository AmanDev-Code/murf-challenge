'use client';

import { useEffect, useState, useCallback } from 'react';

export interface HandoffEvent {
  from_agent: string;
  to_agent: string;
  reason: string;
  timestamp: string;
  handoff_count: number;
}

/**
 * Hook that listens for agent handoff events on the LiveKit data channel.
 * Topic: "voicepay.handoff"
 *
 * Usage in call view:
 *   const { events, currentAgent } = useHandoffEvents(room);
 */
export function useHandoffEvents(room: any) {
  const [events, setEvents] = useState<HandoffEvent[]>([]);
  const [currentAgent, setCurrentAgent] = useState<string>('triage');

  useEffect(() => {
    if (!room) return;

    const handler = (
      payload: Uint8Array,
      _participant: any,
      _kind: any,
      topic?: string
    ) => {
      if (topic !== 'voicepay.handoff') return;
      try {
        const msg = JSON.parse(
          new TextDecoder().decode(payload)
        ) as HandoffEvent;
        setCurrentAgent(msg.to_agent);
        setEvents((prev) => [...prev, msg]);
      } catch {
        // Ignore malformed messages
      }
    };

    room.on('dataReceived', handler);
    return () => {
      room.off('dataReceived', handler);
    };
  }, [room]);

  const reset = useCallback(() => {
    setEvents([]);
    setCurrentAgent('triage');
  }, []);

  return { events, currentAgent, reset };
}
