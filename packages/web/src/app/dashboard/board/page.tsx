'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { MetricCard } from '@/components/dashboard/MetricCard';

interface BoardData {
  totalAgents: number;
  ariDistribution: Record<string, number>;
  containmentSummary: Record<string, number>;
  healthDistribution: Record<string, number>;
  complianceScore: number;
  auditReadiness: number;
}

export default function BoardDashboard() {
  const { data, isLoading, error } = useQuery<BoardData>({
    queryKey: ['dashboard', 'tier1'],
    queryFn: () => apiFetch('/api/v1/dashboard/tier/1'),
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Failed to load board dashboard. Is the API running on port 4000?
        </div>
      </div>
    );
  }

  if (!data) return null;

  const healthyPct = data.totalAgents > 0
    ? Math.round(((data.healthDistribution?.healthy || 0) / data.totalAgents) * 100)
    : 0;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Board Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Tier 1 — Executive portfolio overview</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="Fleet Size"
          value={data.totalAgents}
          status={data.totalAgents > 0 ? 'green' : 'amber'}
        />
        <MetricCard
          label="SAFEST Compliance"
          value={data.complianceScore}
          unit="%"
          status={data.complianceScore >= 80 ? 'green' : data.complianceScore >= 50 ? 'amber' : 'red'}
        />
        <MetricCard
          label="Audit Readiness"
          value={data.auditReadiness ?? 0}
          unit="%"
          status={(data.auditReadiness ?? 0) >= 95 ? 'green' : (data.auditReadiness ?? 0) >= 75 ? 'amber' : 'red'}
        />
        <MetricCard
          label="Fleet Health"
          value={healthyPct}
          unit="%"
          status={healthyPct >= 80 ? 'green' : healthyPct >= 50 ? 'amber' : 'red'}
        />
      </div>

      {/* ARI Distribution */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">ARI Distribution</h2>
        <div className="grid grid-cols-4 gap-4">
          {Object.entries(data.ariDistribution || {}).map(([tier, count]) => (
            <div key={tier} className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-semibold">{count}</p>
              <p className="text-sm text-gray-500 capitalize mt-1">{tier}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Containment Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Containment Status</h2>
        <div className="grid grid-cols-5 gap-4">
          {[0, 1, 2, 3, 4].map(level => {
            const count = data.containmentSummary?.[`level${level}`] || 0;
            const labels = ['Standard', 'State-Preserving', 'Planning Lock', 'Tool Restriction', 'Isolation'];
            const colors = ['bg-green-50 text-green-700', 'bg-yellow-50 text-yellow-700', 'bg-orange-50 text-orange-700', 'bg-red-50 text-red-700', 'bg-red-100 text-red-900'];
            return (
              <div key={level} className={`text-center p-4 rounded-lg ${colors[level]}`}>
                <p className="text-2xl font-semibold">{count}</p>
                <p className="text-xs mt-1">L{level}: {labels[level]}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
