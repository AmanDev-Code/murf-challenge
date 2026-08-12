'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  AlertTriangle,
  Shield,
  Phone,
  Clock,
  User,
  MessageSquare,
  Code,
  Zap,
  CheckCircle2,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Message {
  role: string;
  content: string;
  tool_name: string | null;
  tool_args: any;
  original_timestamp: string;
}

interface AuditEntry {
  action: string;
  actor: string;
  old_value: string | null;
  new_value: string | null;
  notes: string | null;
  created_at: string;
}

interface Escalation {
  id: string;
  reference_id: string;
  user_id: string | null;
  type: string;
  urgency: string;
  status: string;
  assigned_to: string | null;
  caller_name: string | null;
  summary: string;
  what_checked: string | null;
  trigger_phrases: string[];
  language: string;
  follow_up_method: string;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  callback_status: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const urgencyColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-300 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  low: 'bg-green-500/20 text-green-300 border-green-500/30',
};

const statusColors: Record<string, string> = {
  open: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  in_progress: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  awaiting_callback: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  resolved: 'bg-green-500/20 text-green-300 border-green-500/30',
  closed: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

const typeColors: Record<string, string> = {
  fraud: 'bg-red-500/20 text-red-300 border-red-500/30',
  regulatory: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
};

// ─── Page Component ──────────────────────────────────────────────────────────
export default function TicketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [escalation, setEscalation] = useState<Escalation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolution form state
  const [newStatus, setNewStatus] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/escalations/${id}`);
      if (!res.ok) {
        setError('Escalation not found');
        return;
      }
      const data = await res.json();
      setEscalation(data.escalation);
      setMessages(data.messages || []);
      setAuditLog(data.audit_log || []);
      setNewStatus(data.escalation?.status || '');
      setAssignedTo(data.escalation?.assigned_to || '');
    } catch (err) {
      setError('Failed to load escalation');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleUpdate = async () => {
    if (!escalation) return;
    setSubmitting(true);
    try {
      const body: any = { actor: 'admin' };
      if (newStatus && newStatus !== escalation.status) body.status = newStatus;
      if (assignedTo && assignedTo !== escalation.assigned_to) body.assigned_to = assignedTo;
      if (resolutionNotes) body.resolution_notes = resolutionNotes;

      const res = await fetch(`/api/escalations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        await fetchDetail();
        setResolutionNotes('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCallback = async () => {
    if (!escalation) return;
    setSubmitting(true);
    try {
      // First resolve if not already
      if (escalation.status !== 'resolved' && resolutionNotes) {
        await fetch(`/api/escalations/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'resolved',
            resolution_notes: resolutionNotes,
            actor: 'admin',
          }),
        });
      }

      // Trigger callback
      await fetch(`/api/escalations/${id}/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: 'anisha', actor: 'admin' }),
      });

      await fetchDetail();
      setResolutionNotes('');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0e1a]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#f5a623]" />
      </div>
    );
  }

  if (error || !escalation) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0e1a]">
        <Shield className="mb-3 h-12 w-12 text-white/20" />
        <p className="text-white/50">{error || 'Escalation not found'}</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-4 text-sm text-[#f5a623] hover:underline"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] p-6 pt-20">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="mb-4 flex items-center gap-2 text-sm text-white/50 transition hover:text-white/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold text-white/90">
              {escalation.reference_id}
            </h1>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs ${typeColors[escalation.type]}`}>
              {escalation.type}
            </span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs ${urgencyColors[escalation.urgency]}`}>
              {escalation.urgency}
            </span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs ${statusColors[escalation.status]}`}>
              {escalation.status.replace('_', ' ')}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-xs text-white/40">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {escalation.caller_name || escalation.user_id || 'Anonymous'}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(escalation.created_at)}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {messages.length} messages
            </span>
            {escalation.language && (
              <span>Lang: {escalation.language}</span>
            )}
          </div>
        </div>

        {/* Summary Card */}
        <div className="mb-6 rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
          <h3 className="mb-2 text-sm font-medium text-white/60">Summary</h3>
          <p className="text-sm leading-relaxed text-white/80">{escalation.summary}</p>
          {escalation.what_checked && (
            <p className="mt-2 text-xs text-white/40">{escalation.what_checked}</p>
          )}
          {escalation.trigger_phrases && escalation.trigger_phrases.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {escalation.trigger_phrases.map((phrase, i) => (
                <span key={i} className="rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-300">
                  &quot;{phrase}&quot;
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Left: Conversation Log (60%) */}
          <div className="lg:col-span-3">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02]">
              <div className="border-b border-white/[0.06] px-5 py-3">
                <h3 className="text-sm font-medium text-white/60">Conversation Log</h3>
              </div>
              <div className="max-h-[600px] overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-white/30">
                    No conversation messages recorded
                  </p>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg, i) => (
                      <MessageBubble key={i} message={msg} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Resolution + Audit (40%) */}
          <div className="space-y-6 lg:col-span-2">
            {/* Resolution Form */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
              <h3 className="mb-4 text-sm font-medium text-white/60">Resolution</h3>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-white/40">Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 outline-none focus:border-[#f5a623]/50"
                  >
                    <option value="open" className="bg-[#0a0e1a]">Open</option>
                    <option value="in_progress" className="bg-[#0a0e1a]">In Progress</option>
                    <option value="resolved" className="bg-[#0a0e1a]">Resolved</option>
                    <option value="closed" className="bg-[#0a0e1a]">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-white/40">Assign To</label>
                  <input
                    type="text"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    placeholder="Team or person name"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 outline-none placeholder:text-white/25 focus:border-[#f5a623]/50"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-white/40">Resolution Notes</label>
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Describe the resolution or action taken..."
                    rows={4}
                    className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 outline-none placeholder:text-white/25 focus:border-[#f5a623]/50"
                  />
                </div>

                {escalation.resolution_notes && (
                  <div className="rounded-lg bg-green-500/5 p-3">
                    <p className="text-xs text-green-300/70">Previous resolution:</p>
                    <p className="mt-1 text-sm text-green-200/80">{escalation.resolution_notes}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleUpdate}
                    disabled={submitting}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/10 disabled:opacity-50"
                  >
                    Update
                  </button>
                  <button
                    onClick={handleCallback}
                    disabled={submitting || (!resolutionNotes && !escalation.resolution_notes)}
                    className="flex-1 rounded-lg bg-gradient-to-r from-[#f5a623] to-[#ffd700] px-4 py-2.5 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-50"
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      Resolve & Notify
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Audit Timeline */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
              <h3 className="mb-4 text-sm font-medium text-white/60">Audit Trail</h3>
              {auditLog.length === 0 ? (
                <p className="text-xs text-white/30">No activity yet</p>
              ) : (
                <div className="space-y-4">
                  {auditLog.map((entry, i) => (
                    <AuditEntry key={i} entry={entry} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function MessageBubble({ message }: { message: Message }) {
  const { role, content, tool_name, original_timestamp } = message;

  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-xl rounded-br-sm border border-blue-500/20 bg-blue-500/10 px-4 py-2.5">
          <p className="text-sm text-white/80">{content}</p>
          <p className="mt-1 text-right text-[10px] text-white/30">{formatTime(original_timestamp)}</p>
        </div>
      </div>
    );
  }

  if (role === 'agent') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] rounded-xl rounded-bl-sm border border-white/[0.08] bg-white/[0.04] px-4 py-2.5">
          <p className="text-sm text-white/75">{content}</p>
          <p className="mt-1 text-[10px] text-white/30">{formatTime(original_timestamp)}</p>
        </div>
      </div>
    );
  }

  if (role === 'tool_call') {
    return (
      <div className="flex justify-center">
        <div className="flex items-center gap-1.5 rounded-full bg-white/[0.03] px-3 py-1">
          <Code className="h-3 w-3 text-white/30" />
          <span className="text-xs text-white/30">{tool_name || content}</span>
          <span className="text-[10px] text-white/20">{formatTime(original_timestamp)}</span>
        </div>
      </div>
    );
  }

  if (role === 'tool_result') {
    return (
      <div className="flex justify-center">
        <div className="max-w-[70%] rounded-lg bg-white/[0.02] px-3 py-1.5">
          <p className="text-xs italic text-white/25">{content.substring(0, 200)}{content.length > 200 ? '...' : ''}</p>
        </div>
      </div>
    );
  }

  if (role === 'system') {
    return (
      <div className="flex justify-center">
        <div className="flex items-center gap-1.5 rounded-full border border-[#f5a623]/20 bg-[#f5a623]/5 px-3 py-1">
          <Zap className="h-3 w-3 text-[#f5a623]" />
          <span className="text-xs text-[#f5a623]/80">{content}</span>
        </div>
      </div>
    );
  }

  return null;
}

function AuditEntry({ entry }: { entry: AuditEntry }) {
  const actionColors: Record<string, string> = {
    created: 'bg-green-500',
    status_change: 'bg-blue-500',
    assigned: 'bg-purple-500',
    note_added: 'bg-gray-500',
    callback_triggered: 'bg-[#f5a623]',
  };

  const dotColor = actionColors[entry.action] || 'bg-white/30';

  let description = '';
  switch (entry.action) {
    case 'created':
      description = 'Ticket created';
      break;
    case 'status_change':
      description = `Status: ${entry.old_value} → ${entry.new_value}`;
      break;
    case 'assigned':
      description = `Assigned to ${entry.new_value}`;
      break;
    case 'note_added':
      description = 'Context updated';
      break;
    case 'callback_triggered':
      description = 'Resolution callback triggered';
      break;
    default:
      description = entry.action;
  }

  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div className={`h-2 w-2 rounded-full ${dotColor}`} />
        <div className="h-full w-px bg-white/[0.06]" />
      </div>
      <div className="flex-1 pb-2">
        <p className="text-xs text-white/60">{description}</p>
        {entry.notes && (
          <p className="mt-0.5 text-xs text-white/30">{entry.notes}</p>
        )}
        <p className="mt-0.5 text-[10px] text-white/25">
          {entry.actor} · {relativeTime(entry.created_at)}
        </p>
      </div>
    </div>
  );
}
