'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAgent, useSessionContext } from '@livekit/components-react';

export interface CanvasItem {
  id: string;
  tool: string;
  data: Record<string, any>;
  timestamp: string;
}

export function useCanvasData() {
  const { room } = useSessionContext();
  const [items, setItems] = useState<CanvasItem[]>([]);
  const { state: agentState } = useAgent();
  const lastToolTime = useRef<number>(0);

  // Listen for canvas data from backend
  useEffect(() => {
    if (!room) return;

    const handler = (payload: Uint8Array, participant: any, kind: any, topic: string | undefined) => {
      if (topic !== 'canvas') return;
      try {
        const text = new TextDecoder().decode(payload);
        const msg = JSON.parse(text);
        if (msg.type !== 'canvas') return;

        const item: CanvasItem = {
          id: `${msg.tool}-${Date.now()}`,
          tool: msg.tool,
          data: msg.data,
          timestamp: msg.timestamp,
        };
        lastToolTime.current = Date.now();
        // Replace with latest — only show one card at a time
        setItems([item]);
      } catch {
        // ignore non-canvas messages
      }
    };

    room.on('dataReceived', handler);
    return () => { room.off('dataReceived', handler); };
  }, [room]);

  // Auto-dismiss canvas ONLY when the user asks a NEW question and the agent
  // responds WITHOUT calling a tool. Canvas stays visible while agent explains
  // the current tool result. Only hides when agent answers something unrelated.
  const speakingWithoutToolRef = useRef(false);

  useEffect(() => {
    if (items.length === 0) return;

    if (agentState === 'speaking') {
      const timeSinceLastTool = Date.now() - lastToolTime.current;
      // Agent started speaking and no new tool was pushed recently
      // = this is a response to a NEW question that doesn't use the canvas
      if (timeSinceLastTool > 2000) {
        speakingWithoutToolRef.current = true;
      } else {
        speakingWithoutToolRef.current = false;
      }
    }

    // Only dismiss when agent finishes a non-tool response (back to listening)
    if (agentState === 'listening' && speakingWithoutToolRef.current) {
      setItems([]);
      speakingWithoutToolRef.current = false;
    }
  }, [agentState, items.length]);

  const dismissItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearCanvas = useCallback(() => {
    setItems([]);
  }, []);

  const latestItem = items[items.length - 1] ?? null;

  return { items, latestItem, dismissItem, clearCanvas };
}
