'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { HealthBadge } from '@/components/dashboard/HealthBadge';
import { ARIGauge } from '@/components/dashboard/ARIGauge';
import { ContainmentBadge } from '@/components/dashboard/ContainmentBadge';
import Link from 'next/link';

interface DashboardData {
  totalAgents: number;
  ariDistribution: Record<string, number>;
  containmentSummary: Record<string, number>;
  healthDistribution: Record<string, number>;
  complianceScore: number;
  agents: Array<{
    id: string;
    agentName: string;
    agentType: string;
    healthState: string;
    riskTier: string;
    ariScore: string | null;
    currentContainmentLevel: number;
    team: string;
    owner: string;
  }>;
}

export default function TeamDashboard() {
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard', 'tier3'],
    queryFn: () => apiFetch('/api/v1/dashboard/tier/3'),
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Failed to load dashboard data. Is the API running on port 4000?
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Team Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Tier 3 — Operational overview for your agent fleet</p>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="Total Agents"
          value={data.totalAgents}
          status={data.totalAgents > 0 ? 'green' : 'amber'}
        />
        <MetricCard
          label="Compliance Score"
          value={data.complianceScore}
          unit="%"
          status={data.complianceScore >= 80 ? 'green' : data.complianceScore >= 50 ? 'amber' : 'red'}
        />
        <MetricCard
          label="Healthy Agents"
          value={data.healthDistribution?.healthy || 0}
          status="green"
        />
        <MetricCard
          label="In Containment"
          value={data.containmentSummary ? Object.values(data.containmentSummary).reduce((a, b) => a + b, 0) - (data.containmentSummary['0'] || 0) : 0}
          status={
            (data.containmentSummary && Object.entries(data.containmentSummary)
              .filter(([k]) => k !== '0')
              .reduce((sum, [, v]) => sum + v, 0) > 0)
              ? 'red' : 'green'
          }
        />
      </div>

      {/* Agent Registry Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-medium text-gray-900">Agent Fleet</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Health</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Tier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ARI Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Containment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.agents?.map((agent) => (
                <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/agents/${agent.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                      {agent.agentName}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{agent.agentType}</td>
                  <td className="px-6 py-4"><HealthBadge state={agent.healthState} /></td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize bg-gray-100 text-gray-700">
                      {agent.riskTier}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {agent.ariScore ? (
                      <div className="flex items-center gap-2">
                        <ARIGauge score={parseFloat(agent.ariScore)} size="sm" />
                        <span className="text-sm font-mono">{parseFloat(agent.ariScore).toFixed(2)}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4"><ContainmentBadge level={agent.currentContainmentLevel} /></td>
                  <td className="px-6 py-4 text-sm text-gray-600">{agent.team}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
