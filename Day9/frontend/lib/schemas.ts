/**
 * VoicePay Input Validation Schemas (Zod)
 * ========================================
 * Shared schemas for all API route input validation.
 */

import { z } from 'zod';

// --- Analytics Queries ---

export const DaysQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(7),
});

export const PaginatedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const CallsQuerySchema = z.object({
  outcome: z.enum(['success', 'failed', 'abandoned', 'error', '']).default(''),
  language: z.enum(['english', 'hindi', 'hinglish', '']).default(''),
  channel: z.enum(['browser', 'sip', '']).default(''),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const TimelineQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
  granularity: z.enum(['hour', 'day', 'week']).default('day'),
});

// --- Agents Tab ---

export const AgentStatsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

export const HandoffsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  room_name: z.string().optional(),
});

export const AgentFlowQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

// --- Escalations ---

export const EscalationFilterSchema = z.object({
  status: z.enum(['open', 'in_progress', 'awaiting_callback', 'resolved', 'closed', '']).default(''),
  urgency: z.enum(['critical', 'high', 'medium', 'low', '']).default(''),
  type: z.enum(['fraud', 'regulatory', '']).default(''),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const EscalationUpdateSchema = z.object({
  status: z.enum(['open', 'in_progress', 'awaiting_callback', 'resolved', 'closed']).optional(),
  assigned_to: z.string().max(100).optional(),
  resolution_notes: z.string().max(2000).optional(),
  actor: z.string().max(100).default('admin'),
});

// --- Outbound ---

export const OutboundTriggerSchema = z.object({
  phone_number: z.string().regex(/^\+?[0-9]{10,13}$/, 'Invalid phone number format'),
  user_name: z.string().max(100).default('User'),
  purpose: z.string().max(200).default('general'),
  persona: z.enum(['anisha', 'samar', 'pooja']).default('anisha'),
  language: z.enum(['en', 'hi', 'hinglish']).default('en'),
});

// --- Token ---

export const TokenRequestSchema = z.object({
  voice: z.enum(['anisha', 'samar', 'pooja']).default('anisha'),
  participantIdentity: z.string().min(1).max(100).optional(),
  room_config: z.any().optional(),
});

// --- Helper ---

/**
 * Parse and validate query params from a Request URL.
 * Returns { success: true, data } or { success: false, error: NextResponse }.
 */
export function parseQuery<T extends z.ZodType>(
  req: Request,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const result = schema.safeParse(params);

  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    return { success: false, error: issues.join('; ') };
  }

  return { success: true, data: result.data };
}
