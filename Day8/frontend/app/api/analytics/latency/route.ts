import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

/**
 * GET /api/analytics/latency?days=7
 *
 * Returns:
 *   - percentiles (p50, p75, p95, p99) for total avg_latency_ms
 *   - component averages (eou, llm_ttft, tts_ttfb) from latency_breakdown JSONB
 *   - hourly timeline of avg totals + components
 */
export async function GET(req: Request) {
  const pool = getPool();

  try {
    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '7', 10), 1), 365);

    const [percentilesRes, componentsRes, timelineRes] = await Promise.all([
      pool.query(
        `
        SELECT
          percentile_cont(0.50) WITHIN GROUP (ORDER BY avg_latency_ms)::float AS p50,
          percentile_cont(0.75) WITHIN GROUP (ORDER BY avg_latency_ms)::float AS p75,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY avg_latency_ms)::float AS p95,
          percentile_cont(0.99) WITHIN GROUP (ORDER BY avg_latency_ms)::float AS p99
        FROM call_analytics
        WHERE started_at >= NOW() - ($1 || ' days')::interval
          AND avg_latency_ms > 0
        `,
        [days.toString()]
      ),
      pool.query(
        `
        SELECT
          AVG(NULLIF((latency_breakdown->>'eou_avg')::float, 0))::float AS eou_ms,
          AVG(NULLIF((latency_breakdown->>'llm_avg')::float, 0))::float AS llm_ttft_ms,
          AVG(NULLIF((latency_breakdown->>'tts_avg')::float, 0))::float AS tts_ttfb_ms
        FROM call_analytics
        WHERE started_at >= NOW() - ($1 || ' days')::interval
          AND latency_breakdown IS NOT NULL
          AND avg_latency_ms > 0
        `,
        [days.toString()]
      ),
      pool.query(
        `
        SELECT
          date_trunc('hour', started_at) AS bucket,
          AVG(avg_latency_ms)::float AS avg_total,
          AVG((latency_breakdown->>'eou_avg')::float)::float AS avg_eou,
          AVG((latency_breakdown->>'llm_avg')::float)::float AS avg_llm,
          AVG((latency_breakdown->>'tts_avg')::float)::float AS avg_tts
        FROM call_analytics
        WHERE started_at >= NOW() - ($1 || ' days')::interval
          AND avg_latency_ms > 0
        GROUP BY bucket
        ORDER BY bucket ASC
        `,
        [days.toString()]
      ),
    ]);

    const pctRow = percentilesRes.rows[0] || {};
    const compRow = componentsRes.rows[0] || {};

    const roundOrZero = (v: unknown): number => {
      const n = parseFloat(String(v ?? '0'));
      return Number.isFinite(n) ? Math.round(n) : 0;
    };

    return NextResponse.json({
      percentiles: {
        p50: roundOrZero(pctRow.p50),
        p75: roundOrZero(pctRow.p75),
        p95: roundOrZero(pctRow.p95),
        p99: roundOrZero(pctRow.p99),
      },
      component_averages: {
        eou_ms: roundOrZero(compRow.eou_ms),
        llm_ttft_ms: roundOrZero(compRow.llm_ttft_ms),
        tts_ttfb_ms: roundOrZero(compRow.tts_ttfb_ms),
      },
      timeline: timelineRes.rows.map((row) => ({
        bucket: row.bucket instanceof Date ? row.bucket.toISOString() : String(row.bucket),
        avg_total: roundOrZero(row.avg_total),
        avg_eou: roundOrZero(row.avg_eou),
        avg_llm: roundOrZero(row.avg_llm),
        avg_tts: roundOrZero(row.avg_tts),
      })),
    });
  } catch (error) {
    console.error('GET /api/analytics/latency error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch latency analytics' },
      { status: 500 }
    );
  }
}
