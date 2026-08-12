'use client';

import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/shadcn/utils';

export type TicketFilterValues = {
  status: string;
  urgency: string;
  type: string;
};

const STATUS_OPTIONS = [
  'all',
  'open',
  'in_progress',
  'awaiting_callback',
  'resolved',
  'closed',
] as const;
const URGENCY_OPTIONS = ['all', 'critical', 'high', 'medium', 'low'] as const;
const TYPE_OPTIONS = ['all', 'fraud', 'regulatory'] as const;

function labelize(value: string): string {
  if (value === 'all') return 'All';
  return value
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

function GlassSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex min-w-[140px] flex-col gap-1">
      <span className="text-[10px] font-medium tracking-wider text-white/40 uppercase">
        {label}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full appearance-none rounded-lg px-3 py-2 pr-8 text-sm',
            'border border-white/[0.08] bg-white/5 backdrop-blur-sm',
            'cursor-pointer text-white/90',
            'transition-colors focus:border-[#f5a623]/60 focus:ring-1 focus:ring-[#f5a623]/40 focus:outline-none'
          )}
        >
          {options.map((o) => (
            <option key={o} value={o} className="bg-[#0a0e1a] text-white/90">
              {labelize(o)}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-white/40" />
      </div>
    </label>
  );
}

export function TicketFilters({
  filters,
  onFilterChange,
}: {
  filters: TicketFilterValues;
  onFilterChange: (filters: TicketFilterValues) => void;
}) {
  const hasActiveFilter =
    filters.status !== 'all' || filters.urgency !== 'all' || filters.type !== 'all';

  return (
    <div className="flex flex-wrap items-end gap-3">
      <GlassSelect
        label="Status"
        value={filters.status}
        options={STATUS_OPTIONS}
        onChange={(v) => onFilterChange({ ...filters, status: v })}
      />
      <GlassSelect
        label="Urgency"
        value={filters.urgency}
        options={URGENCY_OPTIONS}
        onChange={(v) => onFilterChange({ ...filters, urgency: v })}
      />
      <GlassSelect
        label="Type"
        value={filters.type}
        options={TYPE_OPTIONS}
        onChange={(v) => onFilterChange({ ...filters, type: v })}
      />
      {hasActiveFilter && (
        <button
          type="button"
          onClick={() =>
            onFilterChange({ status: 'all', urgency: 'all', type: 'all' })
          }
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm',
            'border border-white/[0.08] bg-white/5 text-white/60',
            'transition-colors hover:border-white/20 hover:text-white/90'
          )}
        >
          <X className="size-3.5" />
          Clear
        </button>
      )}
    </div>
  );
}
