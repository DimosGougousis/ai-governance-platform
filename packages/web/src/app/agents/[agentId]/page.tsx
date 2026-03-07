'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { HealthBadge } from '@/components/dashboard/HealthBadge';
import { ARIGauge } from '@/components/dashboard/ARIGauge';
import { ContainmentBadge } from '@/components/dashboard/ContainmentBadge';
import { MetricCard } from '@/components/dashboard/MetricCard';
import Link from 'next/link';
import { useState } from 'react';

interface AgentDetail {
  id: string;
  agentName: string;
  agentType: string;
  version: string;
  modelId: string;
  modelVersion: string;
  deployEnv: string;
  healthState: string;
  riskTier: string;
  oversightModel: string;
  ariScore: string | null;
  currentContainmentLevel: number;
  spiffeId: string | null;
  owner: string;
  team: string;
  functions: string[];
  outOfScope: string[];
  createdAt: string;
  updatedAt: string;
}

interface ContractCompliance {
  agentId: string;
  riskTier: string;
  required: string[];
  missing: string[];
  satisfied: string[];
  compliant: boolean;
  sources: Array<{
    contractType: string;
    provider: string;
    protocol: string;
    lastReceived: string | null;
    schemaValid: boolean;
    enabled: boolean;
  }>;
}

const TABS = ['Overview', 'Contracts', 'Health', 'KPIs', 'ARI'] as const;
type Tab = typeof TABS[number];

const CONTRACT_LABELS: Record<string, string> = {
  C1: 'Identity & Registration',
  C2: 'Health & Liveness',
  C3: 'Traces & Reasoning',
  C4: 'Cost & Usage',
  C5: 'Quality & Drift',
  C6: 'Guardrail Events',
  C7: 'Decisions & Delegations',
};

export default function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('Overview');

  const { data: agent, isLoading } = useQuery<AgentDetail>({
    queryKey: ['agent', agentId],
    queryFn: () => apiFetch(`/api/v1/agents/${agentId}`),
  });

  const { data: contracts } = useQuery<ContractCompliance>({
    queryKey: ['agent-contracts', agentId],
    queryFn: () => apiFetch(`/api/v1/agents/${agentId}/contracts`),
    enabled: !!agentId,
  });

  const { data: kpis } = useQuery<{ data: any[] }>({
    queryKey: ['agent-kpis', agentId],
    queryFn: () => apiFetch(`/api/v1/agents/${agentId}/kpis`),
    enabled: activeTab === 'KPIs',
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="h-48 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Agent not found
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/agents" className="text-gray-400 hover:text-gray-600 text-sm">&larr; Registry</Link>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mt-2">{agent.agentName}</h1>
          <p className="text-sm text-gray-500 mt-1">{agent.agentType} &middot; v{agent.version} &middot; {agent.modelId}</p>
        </div>
        <div className="flex items-center gap-3">
          <HealthBadge state={agent.healthState} />
          <ContainmentBadge level={agent.currentContainmentLevel} />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        <MetricCard label="ARI Score" value={agent.ariScore ? parseFloat(agent.ariScore).toFixed(2) : '—'} status={
          agent.ariScore ? (parseFloat(agent.ariScore) <= 0.25 ? 'green' : parseFloat(agent.ariScore) <= 0.50 ? 'amber' : 'red') : 'neutral'
        } />
        <MetricCard label="Risk Tier" value={agent.riskTier} status={agent.riskTier === 'high' ? 'red' : agent.riskTier === 'limited' ? 'amber' : 'green'} />
        <MetricCard label="Oversight" value={agent.oversightModel} status="neutral" />
        <MetricCard label="Containment" value={`Level ${agent.currentContainmentLevel}`} status={agent.currentContainmentLevel === 0 ? 'green' : agent.currentContainmentLevel <= 2 ? 'amber' : 'red'} />
        <MetricCard label="Contracts" value={contracts ? `${contracts.satisfied.length}/${contracts.required.length}` : '—'} status={contracts?.compliant ? 'green' : 'red'} />
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Identity</h3>
            <dl className="space-y-3">
              {[
                ['Agent ID', agent.id],
                ['Owner', agent.owner],
                ['Team', agent.team],
                ['Environment', agent.deployEnv],
                ['SPIFFE ID', agent.spiffeId || 'Not assigned'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-sm text-gray-500">{label}</dt>
                  <dd className="text-sm font-mono text-gray-900 truncate max-w-[60%]">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Capabilities</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400 mb-2">Functions</p>
                <div className="flex flex-wrap gap-1.5">
                  {(agent.functions as string[] || []).map(fn => (
                    <span key={fn} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-50 text-green-700 font-mono">{fn}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-2">Out of Scope</p>
                <div className="flex flex-wrap gap-1.5">
                  {(agent.outOfScope as string[] || []).map(fn => (
                    <span key={fn} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-50 text-red-700 font-mono">{fn}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {agent.ariScore && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-center">
              <ARIGauge score={parseFloat(agent.ariScore)} size="lg" />
            </div>
          )}
        </div>
      )}

      {activeTab === 'Contracts' && contracts && (
        <div className="space-y-4">
          <div className={`rounded-xl border p-4 ${contracts.compliant ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <p className={`text-sm font-medium ${contracts.compliant ? 'text-green-800' : 'text-red-800'}`}>
              {contracts.compliant
                ? 'All required governance data contracts are being satisfied.'
                : `Missing ${contracts.missing.length} required contract(s): ${contracts.missing.join(', ')}`}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contract</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Required</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Protocol</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Received</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'] as const).map(ct => {
                  const source = contracts.sources.find(s => s.contractType === ct);
                  const required = contracts.required.includes(ct);
                  const satisfied = contracts.satisfied.includes(ct);
                  return (
                    <tr key={ct} className={!required ? 'opacity-50' : ''}>
                      <td className="px-6 py-3 text-sm">
                        <span className="font-mono font-medium">{ct}</span>
                        <span className="text-gray-400 ml-2">{CONTRACT_LABELS[ct]}</span>
                      </td>
                      <td className="px-6 py-3">
                        {required
                          ? <span className="text-xs font-medium text-blue-600">Required</span>
                          : <span className="text-xs text-gray-400">Optional</span>}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">{source?.provider || '—'}</td>
                      <td className="px-6 py-3 text-sm font-mono text-gray-600">{source?.protocol || '—'}</td>
                      <td className="px-6 py-3 text-sm text-gray-500">
                        {source?.lastReceived ? new Date(source.lastReceived).toLocaleString() : '—'}
                      </td>
                      <td className="px-6 py-3">
                        {satisfied
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                          : required
                            ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Missing</span>
                            : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">N/A</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'KPIs' && (
        <div className="grid grid-cols-3 gap-4">
          {kpis?.data?.map((kpi: any) => (
            <div key={kpi.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-900">{kpi.kpiName}</p>
              <p className="text-xs text-gray-400 mt-0.5">{kpi.metricId} &middot; {kpi.measurementWindow}</p>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-2xl font-semibold">{kpi.currentValue ?? '—'}</span>
                <span className="text-sm text-gray-400 mb-0.5">target: {kpi.target}</span>
              </div>
              {kpi.currentStatus && <HealthBadge state={kpi.currentStatus === 'green' ? 'healthy' : kpi.currentStatus === 'amber' ? 'degraded' : 'critical'} />}
            </div>
          )) || <p className="text-sm text-gray-400 col-span-3">No KPIs configured</p>}
        </div>
      )}

      {activeTab === 'ARI' && agent.ariScore && (
        <div className="flex justify-center">
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <ARIGauge score={parseFloat(agent.ariScore)} size="lg" />
          </div>
        </div>
      )}

      {activeTab === 'Health' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
          Health history chart will appear here once health data is ingested via the C2 contract.
        </div>
      )}
    </div>
  );
}
