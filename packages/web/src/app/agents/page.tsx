'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { HealthBadge } from '@/components/dashboard/HealthBadge';
import { ARIGauge } from '@/components/dashboard/ARIGauge';
import { ContainmentBadge } from '@/components/dashboard/ContainmentBadge';
import Link from 'next/link';

interface Agent {
  id: string;
  agentName: string;
  agentType: string;
  version: string;
  modelId: string;
  healthState: string;
  riskTier: string;
  oversightModel: string;
  ariScore: string | null;
  currentContainmentLevel: number;
  team: string;
  owner: string;
  deployEnv: string;
  createdAt: string;
}

export default function AgentRegistryPage() {
  const { data, isLoading, error } = useQuery<{ data: Agent[] }>({
    queryKey: ['agents'],
    queryFn: () => apiFetch('/api/v1/agents'),
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Failed to load agents. Is the API running?
        </div>
      </div>
    );
  }

  const agents = data?.data || [];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Agent Registry</h1>
          <p className="text-sm text-gray-500 mt-1">{agents.length} agents registered</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Health</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Oversight</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ARI</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Containment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Env</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {agents.map((agent) => (
                <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/agents/${agent.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                      {agent.agentName}
                    </Link>
                    <p className="text-xs text-gray-400 mt-0.5">{agent.agentType}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 font-mono">{agent.version}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{agent.modelId}</td>
                  <td className="px-6 py-4"><HealthBadge state={agent.healthState} /></td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize bg-gray-100 text-gray-700">
                      {agent.riskTier}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 font-mono">{agent.oversightModel}</td>
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
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                      {agent.deployEnv}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{agent.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
