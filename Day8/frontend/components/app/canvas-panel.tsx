'use client';

import { AnimatePresence, motion } from 'motion/react';
import { X, IndianRupee } from 'lucide-react';
import type { CanvasItem } from '@/hooks/useCanvasData';
import {
  BalanceCard,
  TransactionTable,
  EMICard,
  StepsCard,
  SchemeCard,
  EscalateCard,
  EscalationTicketCard,
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
    case 'government_scheme':
    case 'scheme_eligibility': return 'Scheme Eligibility';
    case 'escalate':
    case 'escalation':
    case 'escalation_status':
    case 'support': return 'Escalation Ticket';
    case 'gold_prices': return 'Gold & Silver Prices';
    case 'rbi_rates': return 'RBI Policy Rates';
    case 'fd_comparison': return 'FD Rate Comparison';
    case 'loan_eligibility': return 'Loan Eligibility';
    case 'documents': return 'Document Checklist';
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
    case 'escalation_status':
    case 'support':
      // Day 7: If data has reference_id + status, use the ticket card
      if (data.reference_id && data.status) {
        return <EscalationTicketCard data={data} />;
      }
      return <EscalateCard data={data} />;
    // Day 5 tools — render result_text as formatted card
    case 'gold_prices':
    case 'rbi_rates':
    case 'fd_comparison':
    case 'loan_eligibility':
    case 'scheme_eligibility':
    case 'documents':
      return <FormattedTextCard data={data} />;
    default:
      return <FormattedTextCard data={data} />;
  }
}

/** Day 5 card — renders result_text as a clean formatted card */
function FormattedTextCard({ data }: { data: any }) {
  const title = data?.title || 'Result';
  const text = data?.result_text || '';

  // Parse the text into sections
  const lines = text.split('\n');

  return (
    <div className="space-y-3">
      {/* Title */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f5a623]/10">
          <IndianRupee className="h-4 w-4 text-[#f5a623]" />
        </div>
        <h3 className="text-sm font-semibold text-white/90">{title}</h3>
      </div>

      {/* Content */}
      <div className="space-y-1">
        {lines.map((line: string, i: number) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={i} className="h-2" />;

          // Section headers (lines with === or all caps)
          if (trimmed.match(/^={3,}$/)) return null;
          if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && !trimmed.startsWith('Rs')) {
            return (
              <p key={i} className="mt-3 text-[10px] font-bold uppercase tracking-wider text-[#f5a623]/80">
                {trimmed}
              </p>
            );
          }

          // Data lines with colon (key: value)
          const colonIdx = trimmed.indexOf(':');
          if (colonIdx > 0 && colonIdx < 30 && trimmed.startsWith(' ')) {
            const key = trimmed.slice(0, colonIdx).trim();
            const val = trimmed.slice(colonIdx + 1).trim();
            return (
              <div key={i} className="flex items-baseline justify-between gap-2 py-0.5">
                <span className="text-[11px] text-white/50">{key}</span>
                <span className="text-[11px] font-medium text-white/90">{val}</span>
              </div>
            );
          }

          // Rank/table lines (start with number)
          if (trimmed.match(/^\d+\s/)) {
            return (
              <p key={i} className="font-mono text-[11px] text-white/70">{trimmed}</p>
            );
          }

          // Note/tip lines
          if (trimmed.startsWith('Note:') || trimmed.startsWith('Tip:') || trimmed.startsWith('Data as of:')) {
            return (
              <p key={i} className="mt-2 text-[10px] italic text-white/40">{trimmed}</p>
            );
          }

          // Regular text
          return (
            <p key={i} className="text-[11px] leading-relaxed text-white/70">{trimmed}</p>
          );
        })}
      </div>
    </div>
  );
}
