'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { BarChart3, Phone, Timer, AlertTriangle } from 'lucide-react';
import { AnalyticsOverview } from '@/components/dashboard/analytics-overview';
import { CallHistory } from '@/components/dashboard/call-history';
import { LatencyMetrics } from '@/components/dashboard/latency-metrics';
import { EscalationsTab } from '@/components/dashboard/escalations-tab';

// ─── Tab Definitions ─────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'calls', label: 'Call History', icon: Phone },
  { id: 'latency', label: 'Latency', icon: Timer },
  { id: 'escalations', label: 'Escalations', icon: AlertTriangle },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ─── Dashboard Content (wrapped in Suspense for useSearchParams) ─────────────
function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = (searchParams.get('tab') as TabId) || 'overview';

  const setTab = (tab: TabId) => {
    router.push(`/dashboard?tab=${tab}`, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] p-6 pt-20">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white/90">Analytics Dashboard</h1>
          <p className="mt-1 text-sm text-white/50">
            Call metrics, performance, and escalation management
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8 flex items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#f5a623]/10 text-[#f5a623] border border-[#f5a623]/20 shadow-sm shadow-[#f5a623]/5'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="min-h-[600px]">
          {activeTab === 'overview' && <AnalyticsOverview />}
          {activeTab === 'calls' && <CallHistory />}
          {activeTab === 'latency' && <LatencyMetrics />}
          {activeTab === 'escalations' && <EscalationsTab />}
        </div>
      </div>
    </div>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] p-6 pt-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-white/[0.05]" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-white/[0.03]" />
        </div>
        <div className="mb-8 h-12 animate-pulse rounded-xl bg-white/[0.03]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-white/[0.03]" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page Export ──────────────────────────────────────────────────────────────
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
