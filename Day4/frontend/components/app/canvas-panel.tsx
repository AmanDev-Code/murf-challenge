'use client';

import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import type { CanvasItem } from '@/hooks/useCanvasData';
import {
  BalanceCard,
  TransactionTable,
  EMICard,
  StepsCard,
  SchemeCard,
  EscalateCard,
} from './canvas-cards';

interface CanvasPanelProps {
  items: CanvasItem[];
  onDismiss: (id: string) => void;
  onClear: () => void;
}

export function CanvasPanel({ items, onDismiss, onClear }: CanvasPanelProps) {
  if (items.length === 0) return null;

  const latestItem = items[items.length - 1];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={latestItem.id}
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="absolute inset-y-0 right-0 z-40 flex w-[340px] flex-col sm:w-[380px] md:w-[400px]"
      >
        <div className="relative flex h-full flex-col overflow-hidden border-l border-white/10 bg-[#0d1220]/95 backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
              {getToolLabel(latestItem.tool)}
            </span>
            <button
              onClick={() => onDismiss(latestItem.id)}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/20 hover:text-white"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Card Content — scrollable */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-4">
            {renderCard(latestItem)}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function getToolLabel(tool: string): string {
  switch (tool) {
    case 'balance': return 'Account Balance';
    case 'table':
    case 'transactions': return 'Transactions';
    case 'emi':
    case 'emi_calculator': return 'EMI Calculator';
    case 'steps':
    case 'guide':
    case 'how_to': return 'Step-by-Step Guide';
    case 'scheme':
    case 'government_scheme': return 'Government Scheme';
    case 'escalate':
    case 'escalation':
    case 'support': return 'Support Escalation';
    default: return 'Information';
  }
}

function renderCard(item: CanvasItem) {
  const data = item.data as any;
  switch (item.tool) {
    case 'balance':
      return <BalanceCard data={data} />;
    case 'table':
    case 'transactions':
      return <TransactionTable data={data} />;
    case 'emi':
    case 'emi_calculator':
      return <EMICard data={data} />;
    case 'steps':
    case 'guide':
    case 'how_to':
      return <StepsCard data={data} />;
    case 'scheme':
    case 'government_scheme':
      return <SchemeCard data={data} />;
    case 'escalate':
    case 'escalation':
    case 'support':
      return <EscalateCard data={data} />;
    default:
      return (
        <div className="text-sm text-white/60">
          <p className="mb-2 text-xs uppercase tracking-wide text-white/40">Data Received</p>
          <pre className="overflow-auto rounded-lg bg-white/5 p-3 text-xs">
            {JSON.stringify(item.data, null, 2)}
          </pre>
        </div>
      );
  }
}
