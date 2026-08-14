'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Code2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/shadcn/utils';

export type ConversationMessage = {
  role: string; // 'user' | 'assistant' | 'agent' | 'tool_call' | 'tool_result' | 'system' | ...
  content?: string;
  tool_name?: string;
  tool_args?: Record<string, unknown> | string | null;
  original_timestamp?: string;
};

function formatTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function ToolCallBubble({ msg }: { msg: ConversationMessage }) {
  const [open, setOpen] = useState(false);

  const argsStr =
    typeof msg.tool_args === 'string'
      ? msg.tool_args
      : msg.tool_args
        ? JSON.stringify(msg.tool_args, null, 2)
        : '';
  const ts = formatTime(msg.original_timestamp);
  const hasArgs = argsStr.length > 0;

  return (
    <div className="my-1.5 flex w-full justify-center">
      <div className="max-w-[85%]">
        <button
          type="button"
          onClick={() => hasArgs && setOpen((o) => !o)}
          className={cn(
            'mx-auto flex items-center gap-1.5 text-[11px] text-white/40 transition-colors',
            hasArgs ? 'cursor-pointer hover:text-white/70' : 'cursor-default'
          )}
        >
          <Code2 className="size-3" />
          <span className="font-mono">{msg.tool_name || 'tool_call'}</span>
          {hasArgs && (
            <ChevronRight
              className={cn('size-3 transition-transform', open && 'rotate-90')}
            />
          )}
          {ts && <span className="text-white/25">· {ts}</span>}
        </button>
        {open && hasArgs && (
          <pre className="mt-1.5 max-h-64 overflow-auto rounded-md border border-white/[0.06] bg-black/30 p-2 text-left font-mono text-[11px] whitespace-pre-wrap text-white/60">
            {argsStr}
          </pre>
        )}
      </div>
    </div>
  );
}

export function ConversationLog({ messages }: { messages: ConversationMessage[] }) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages?.length]);

  if (!messages || messages.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/5 p-8 text-center text-white/40 backdrop-blur-sm">
        No conversation transcript available.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/5 backdrop-blur-sm">
      <div className="max-h-[560px] space-y-2 overflow-y-auto p-4">
        {messages.map((m, i) => {
          const ts = formatTime(m.original_timestamp);
          const role = m.role;

          if (role === 'tool_call') {
            return <ToolCallBubble key={i} msg={m} />;
          }

          if (role === 'tool_result') {
            return (
              <div
                key={i}
                className="my-1 flex w-full justify-center text-center text-[11px] italic"
              >
                <div className="max-w-[85%] text-white/40">
                  {ts && <span className="text-white/25">{ts} · </span>}
                  {m.content || 'tool result'}
                </div>
              </div>
            );
          }

          if (role === 'system') {
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="my-2 flex w-full flex-col items-center text-center"
              >
                <div className="inline-block rounded-md border border-[#f5a623]/30 bg-[#f5a623]/10 px-3 py-1.5 text-[12px] font-medium text-[#f5a623]">
                  {m.content}
                </div>
                {ts && <div className="mt-1 text-[10px] text-white/30">{ts}</div>}
              </motion.div>
            );
          }

          const isUser = role === 'user';
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl border px-3.5 py-2 text-sm',
                  isUser
                    ? 'rounded-br-md border-blue-500/30 bg-blue-500/20 text-white/90'
                    : 'rounded-bl-md border-white/10 bg-white/5 text-white/90'
                )}
              >
                <div className="break-words whitespace-pre-wrap">
                  {m.content || <span className="text-white/40 italic">(no content)</span>}
                </div>
                {ts && (
                  <div
                    className={cn(
                      'mt-1 text-[10px] text-white/40',
                      isUser ? 'text-right' : 'text-left'
                    )}
                  >
                    {ts}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
