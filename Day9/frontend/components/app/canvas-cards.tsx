'use client';

import {
  IndianRupee,
  ArrowUpRight,
  ArrowDownLeft,
  Phone,
  Shield,
  BookOpen,
  AlertTriangle,
  Calendar,
  CreditCard,
  Percent,
  Clock,
  CheckCircle2,
  Building2,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/shadcn/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Utility: Format Indian Rupees
// ─────────────────────────────────────────────────────────────────────────────
function formatINR(amount: number | string, showSymbol = true): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return showSymbol ? '₹0' : '0';

  // Indian number formatting (lakhs, crores)
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(num);

  return showSymbol ? `₹${formatted}` : formatted;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  // Backend sends dates like "05 Aug, 02:30 PM" — return as-is if already formatted
  if (dateStr.includes(',') || dateStr.includes('AM') || dateStr.includes('PM')) {
    return dateStr;
  }
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BalanceCard — Shows account balance with type badge
// ─────────────────────────────────────────────────────────────────────────────
interface BalanceData {
  balance?: number | string;
  balance_inr?: number | string;
  balance_formatted?: string;
  account_type?: string;
  account_number?: string;
  as_of?: string;
  currency?: string;
}

export function BalanceCard({ data }: { data: BalanceData }) {
  const { balance_inr, balance, balance_formatted, account_type, account_number, as_of } = data;
  // Use balance_inr (backend field name), fallback to balance
  const amount = balance_inr ?? balance ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f5a623]/10">
            <Wallet className="h-4 w-4 text-[#f5a623]" />
          </div>
          <span className="text-xs font-medium text-white/60">Account Balance</span>
        </div>
        {account_type && (
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">
            {account_type}
          </span>
        )}
      </div>

      {/* Balance Amount */}
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold text-white md:text-4xl">
          {balance_formatted || formatINR(amount)}
        </span>
      </div>

      {/* Footer Meta */}
      <div className="flex items-center justify-between text-[11px] text-white/40">
        {account_number && (
          <span>A/C: ****{account_number.slice(-4)}</span>
        )}
        {as_of && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {as_of}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TransactionTable — Transaction rows with credit/debit styling
// ─────────────────────────────────────────────────────────────────────────────
interface Transaction {
  id?: string;
  date: string;
  description?: string;
  merchant?: string;
  amount?: number | string;
  amount_inr?: number | string;
  type: 'credit' | 'debit' | 'CR' | 'DR';
  rail?: string;
  category?: string;
}

interface TransactionTableData {
  transactions: Transaction[];
  title?: string;
  period?: string;
  window_days?: number;
}

export function TransactionTable({ data }: { data: TransactionTableData }) {
  const { transactions = [], title, period, window_days } = data;

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
            <CreditCard className="h-4 w-4 text-emerald-400" />
          </div>
          <span className="text-xs font-medium text-white/60">
            {title || 'Recent Transactions'}
          </span>
        </div>
        {(period || window_days) && (
          <span className="text-[10px] text-white/40">{period || `Last ${window_days} days`}</span>
        )}
      </div>

      {/* Transaction Rows */}
      <div className="flex flex-col gap-1">
        {transactions.slice(0, 8).map((txn, idx) => {
          const isCredit = txn.type === 'credit' || txn.type === 'CR';
          // Backend sends amount_inr, fallback to amount
          const rawAmount = txn.amount_inr ?? txn.amount ?? 0;
          const amount = typeof rawAmount === 'string' ? parseFloat(rawAmount) : rawAmount;

          return (
            <div
              key={txn.id || idx}
              className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2.5 transition-colors hover:bg-white/[0.05]"
            >
              {/* Left: Icon + Details */}
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full',
                    isCredit ? 'bg-emerald-500/10' : 'bg-red-500/10'
                  )}
                >
                  {isCredit ? (
                    <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <ArrowUpRight className="h-3.5 w-3.5 text-red-400" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-white/90">
                    {txn.merchant || txn.description || 'Transaction'}
                  </span>
                  <span className="text-[10px] text-white/40">
                    {formatDate(txn.date)}
                    {txn.rail && (
                      <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[9px] uppercase">
                        {txn.rail}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Right: Amount */}
              <span
                className={cn(
                  'text-sm font-semibold',
                  isCredit ? 'text-emerald-400' : 'text-red-400'
                )}
              >
                {isCredit ? '+' : '-'}{formatINR(Math.abs(amount))}
              </span>
            </div>
          );
        })}
      </div>

      {transactions.length > 8 && (
        <p className="text-center text-[10px] text-white/30">
          +{transactions.length - 8} more transactions
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMICard — EMI breakdown with visual progress bar
// ─────────────────────────────────────────────────────────────────────────────
interface EMIData {
  monthly_emi: number | string;
  principal: number | string;
  interest: number | string;
  total_payable: number | string;
  tenure_months?: number;
  loan_amount?: number | string;
  interest_rate?: number | string;
}

export function EMICard({ data }: { data: EMIData }) {
  const {
    monthly_emi,
    principal,
    interest,
    total_payable,
    tenure_months,
    loan_amount,
    interest_rate,
  } = data;

  const principalNum = typeof principal === 'string' ? parseFloat(principal) : principal;
  const interestNum = typeof interest === 'string' ? parseFloat(interest) : interest;
  const totalNum = principalNum + interestNum;
  const principalPercent = totalNum > 0 ? (principalNum / totalNum) * 100 : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
          <Calendar className="h-4 w-4 text-blue-400" />
        </div>
        <span className="text-xs font-medium text-white/60">EMI Calculator</span>
      </div>

      {/* Main EMI Amount */}
      <div className="flex flex-col items-center gap-1 rounded-xl bg-[#f5a623]/5 py-4">
        <span className="text-[10px] uppercase tracking-wide text-white/40">
          Monthly EMI
        </span>
        <span className="text-3xl font-bold text-[#f5a623]">
          {formatINR(monthly_emi)}
        </span>
        {tenure_months && (
          <span className="text-[11px] text-white/50">
            for {tenure_months} months
          </span>
        )}
      </div>

      {/* Progress Bar: Principal vs Interest */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[10px]">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Principal ({principalPercent.toFixed(0)}%)
          </span>
          <span className="flex items-center gap-1.5 text-orange-400">
            Interest ({(100 - principalPercent).toFixed(0)}%)
            <span className="h-2 w-2 rounded-full bg-orange-400" />
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            style={{ width: `${principalPercent}%` }}
          />
        </div>
      </div>

      {/* Breakdown Grid */}
      <div className="grid grid-cols-2 gap-2">
        {loan_amount && (
          <div className="rounded-lg bg-white/[0.03] px-3 py-2">
            <p className="text-[10px] text-white/40">Loan Amount</p>
            <p className="text-sm font-semibold text-white/90">{formatINR(loan_amount)}</p>
          </div>
        )}
        <div className="rounded-lg bg-white/[0.03] px-3 py-2">
          <p className="text-[10px] text-white/40">Total Payable</p>
          <p className="text-sm font-semibold text-white/90">{formatINR(total_payable)}</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] px-3 py-2">
          <p className="text-[10px] text-white/40">Principal</p>
          <p className="text-sm font-semibold text-emerald-400">{formatINR(principal)}</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] px-3 py-2">
          <p className="text-[10px] text-white/40">Interest</p>
          <p className="text-sm font-semibold text-orange-400">{formatINR(interest)}</p>
        </div>
      </div>

      {interest_rate && (
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-white/50">
          <Percent className="h-3 w-3" />
          Interest Rate: {interest_rate}% p.a.
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StepsCard — Numbered step list (for UPI guides, etc.)
// ─────────────────────────────────────────────────────────────────────────────
interface Step {
  title?: string;
  description?: string;
  text?: string;
}

interface StepsData {
  title?: string;
  steps: (Step | string)[];
}

export function StepsCard({ data }: { data: StepsData }) {
  const { title, steps = [] } = data;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
          <BookOpen className="h-4 w-4 text-purple-400" />
        </div>
        <span className="text-xs font-medium text-white/60">
          {title || 'How To'}
        </span>
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-3">
        {steps.map((step, idx) => {
          const stepText = typeof step === 'string' ? step : (step.description || step.text || step.title);
          const stepTitle = typeof step === 'string' ? null : step.title;

          return (
            <div key={idx} className="flex gap-3">
              {/* Step Number */}
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f5a623]/10 text-xs font-bold text-[#f5a623]">
                {idx + 1}
              </div>
              {/* Content */}
              <div className="flex flex-col gap-0.5 pt-0.5">
                {stepTitle && (
                  <span className="text-xs font-semibold text-white/90">{stepTitle}</span>
                )}
                <span className="text-xs leading-relaxed text-white/70">{stepText}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SchemeCard — Government/bank scheme info
// ─────────────────────────────────────────────────────────────────────────────
interface SchemeData {
  name: string;
  description?: string;
  eligibility?: string;
  benefits?: string | string[];
  how_to_apply?: string | string[];
  deadline?: string;
  more_info_url?: string;
}

export function SchemeCard({ data }: { data: SchemeData }) {
  const { name, description, eligibility, benefits, how_to_apply, deadline } = data;

  const benefitsList = Array.isArray(benefits) ? benefits : benefits ? [benefits] : [];
  const applySteps = Array.isArray(how_to_apply) ? how_to_apply : how_to_apply ? [how_to_apply] : [];

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
          <Shield className="h-5 w-5 text-emerald-400" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-white">{name}</span>
          {description && (
            <span className="text-xs text-white/60">{description}</span>
          )}
        </div>
      </div>

      {/* Eligibility */}
      {eligibility && (
        <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-white/40">
            Eligibility
          </p>
          <p className="text-xs text-white/80">{eligibility}</p>
        </div>
      )}

      {/* Benefits */}
      {benefitsList.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
            Benefits
          </p>
          <div className="flex flex-col gap-1.5">
            {benefitsList.map((benefit, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span className="text-xs text-white/80">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How to Apply */}
      {applySteps.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
            How to Apply
          </p>
          <div className="flex flex-col gap-1.5">
            {applySteps.map((step, idx) => (
              <div key={idx} className="flex gap-2 text-xs text-white/70">
                <span className="font-semibold text-[#f5a623]">{idx + 1}.</span>
                {step}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deadline */}
      {deadline && (
        <div className="flex items-center gap-2 rounded-lg bg-orange-500/10 px-3 py-2">
          <Clock className="h-3.5 w-3.5 text-orange-400" />
          <span className="text-xs text-orange-300">Deadline: {deadline}</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EscalateCard — Urgent/escalation info with contact numbers
// ─────────────────────────────────────────────────────────────────────────────
interface EscalateData {
  title?: string;
  message?: string;
  reason?: string;
  contacts?: Array<{
    name?: string;
    label?: string;
    phone: string;
    type?: string;
  }>;
  phone_numbers?: string[];
  reference_id?: string;
}

export function EscalateCard({ data }: { data: EscalateData }) {
  const { title, message, reason, contacts = [], phone_numbers = [], reference_id } = data;

  // Normalize contacts
  const allContacts: Array<{ phone: string; name: string }> = [
    ...contacts.map((c) => ({ phone: c.phone, name: c.name || c.label || 'Support' })),
    ...phone_numbers.map((phone) => ({ phone, name: 'Support' })),
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
          <AlertTriangle className="h-5 w-5 text-red-400" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-red-400">
            {title || 'Escalation Required'}
          </span>
          {(message || reason) && (
            <span className="text-xs text-white/60">{message || reason}</span>
          )}
        </div>
      </div>

      {/* Contact Buttons */}
      {allContacts.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
            Contact Support
          </p>
          <div className="flex flex-col gap-2">
            {allContacts.map((contact, idx) => (
              <a
                key={idx}
                href={`tel:${contact.phone}`}
                className="flex items-center justify-between rounded-xl bg-red-500/10 px-4 py-3 transition-colors hover:bg-red-500/20"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20">
                    <Phone className="h-4 w-4 text-red-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-white/90">
                      {contact.name || 'Support Line'}
                    </span>
                  </div>
                </div>
                <span className="text-sm font-semibold text-red-400">{contact.phone}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Reference ID */}
      {reference_id && (
        <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
          <span className="text-[10px] text-white/40">Reference ID</span>
          <span className="font-mono text-xs text-white/70">{reference_id}</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EscalationTicketCard — Day 7: Shows ticket created with status, urgency, ref ID
// ─────────────────────────────────────────────────────────────────────────────
interface EscalationTicketData {
  reference_id: string;
  type: string;
  urgency: string;
  status: string;
  is_update?: boolean;
}

const urgencyConfig: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', label: '🚨 CRITICAL' },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', label: '🔴 HIGH' },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', label: '🟡 MEDIUM' },
  low: { color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', label: '🟢 LOW' },
};

const statusConfig: Record<string, { color: string; label: string }> = {
  open: { color: 'text-yellow-300', label: 'Open — Waiting for review' },
  in_progress: { color: 'text-blue-300', label: 'In Progress — Being handled' },
  awaiting_callback: { color: 'text-purple-300', label: 'Awaiting Callback' },
  resolved: { color: 'text-green-300', label: 'Resolved' },
  closed: { color: 'text-gray-300', label: 'Closed' },
};

export function EscalationTicketCard({ data }: { data: EscalationTicketData }) {
  const { reference_id, type, urgency, status, is_update } = data;
  const urg = urgencyConfig[urgency] || urgencyConfig.medium;
  const stat = statusConfig[status] || statusConfig.open;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f5a623]/10">
          <span className="text-xl">🎫</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-[#f5a623]">
            {is_update ? 'Ticket Updated' : 'Ticket Created'}
          </span>
          <span className="text-[11px] text-white/50">
            {is_update ? 'Your existing ticket was updated' : 'Human team will review'}
          </span>
        </div>
      </div>

      {/* Reference ID — BIG and prominent */}
      <div className="rounded-xl border border-[#f5a623]/20 bg-[#f5a623]/5 p-4 text-center">
        <p className="text-[10px] uppercase tracking-wider text-[#f5a623]/60">Reference Number</p>
        <p className="mt-1 font-mono text-xl font-bold text-[#f5a623]">{reference_id}</p>
        <p className="mt-1 text-[10px] text-white/40">Note this down for tracking</p>
      </div>

      {/* Status & Urgency */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
          <p className="text-[10px] text-white/40">Status</p>
          <p className={`mt-0.5 text-xs font-medium ${stat.color}`}>{stat.label}</p>
        </div>
        <div className={`rounded-lg border p-3 ${urg.bg}`}>
          <p className="text-[10px] text-white/40">Urgency</p>
          <p className={`mt-0.5 text-xs font-medium ${urg.color}`}>{urg.label}</p>
        </div>
      </div>

      {/* Type */}
      <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
        <span className="text-[10px] text-white/40">Issue Type</span>
        <span className={`rounded-full border px-2 py-0.5 text-xs ${type === 'fraud' ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-blue-500/30 bg-blue-500/10 text-blue-300'}`}>
          {type === 'fraud' ? '⚠️ Fraud' : '📋 Regulatory'}
        </span>
      </div>

      {/* Next Steps */}
      <div className="rounded-lg bg-white/[0.02] p-3">
        <p className="text-[10px] font-medium text-white/50">What Happens Next</p>
        <p className="mt-1 text-xs leading-relaxed text-white/60">
          {urgency === 'critical'
            ? 'Our team will review within 1 hour and call you back.'
            : urgency === 'high'
            ? 'Our team will review within 4 hours and call you back.'
            : 'Our team will review within 24 hours and call you back.'}
        </p>
      </div>
    </div>
  );
}
