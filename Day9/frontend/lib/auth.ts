/**
 * VoicePay API Auth Utilities — Next.js Frontend
 * ================================================
 * API key validation + auth wrapper for all dashboard/analytics routes.
 * The /api/token route is exempt (public — creates LiveKit tokens for callers).
 */

import { NextResponse } from 'next/server';

const API_KEY = process.env.VOICEPAY_DASHBOARD_KEY || '';

/** Routes that skip auth (public endpoints). */
const PUBLIC_ROUTES = new Set(['/api/token']);

/**
 * Validate the X-API-Key header against the server-side secret.
 * Returns true in dev mode (no key configured) for easier local testing.
 */
export function validateApiKey(req: Request): boolean {
  // Dev mode passthrough when no key is configured
  if (!API_KEY) return true;

  const key = req.headers.get('x-api-key') || '';
  return key === API_KEY;
}

/** Standard 401 response. */
export function unauthorized() {
  return NextResponse.json(
    { error: 'Unauthorized', message: 'Valid X-API-Key header required' },
    { status: 401 }
  );
}

/** Standard 429 response. */
export function rateLimited() {
  return NextResponse.json(
    { error: 'Rate Limited', message: 'Too many requests — try again later' },
    { status: 429 }
  );
}

/**
 * Wrap a route handler with auth validation.
 * Usage:
 *   export const GET = withAuth(async (req) => { ... });
 */
export function withAuth(
  handler: (req: Request, context?: any) => Promise<NextResponse>
) {
  return async (req: Request, context?: any) => {
    // Check if this is a public route
    const url = new URL(req.url);
    if (PUBLIC_ROUTES.has(url.pathname)) {
      return handler(req, context);
    }

    if (!validateApiKey(req)) {
      return unauthorized();
    }
    return handler(req, context);
  };
}

/**
 * Simple in-memory rate limiter (per-IP, 60 req/min).
 * For production, use Redis or an edge-based solution.
 */
const rateBuckets = new Map<string, number[]>();
const RATE_LIMIT = 60;

export function checkRateLimit(req: Request): boolean {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const bucket = rateBuckets.get(ip) || [];

  // Sliding window: keep only timestamps within last 60s
  const filtered = bucket.filter((t) => now - t < 60_000);

  if (filtered.length >= RATE_LIMIT) {
    rateBuckets.set(ip, filtered);
    return false; // rate limited
  }

  filtered.push(now);
  rateBuckets.set(ip, filtered);
  return true;
}

/**
 * Combined auth + rate limit wrapper.
 * Usage:
 *   export const GET = withProtection(async (req) => { ... });
 */
export function withProtection(
  handler: (req: Request, context?: any) => Promise<NextResponse>
) {
  return async (req: Request, context?: any) => {
    const url = new URL(req.url);
    if (PUBLIC_ROUTES.has(url.pathname)) {
      return handler(req, context);
    }

    if (!validateApiKey(req)) {
      return unauthorized();
    }

    if (!checkRateLimit(req)) {
      return rateLimited();
    }

    return handler(req, context);
  };
}
