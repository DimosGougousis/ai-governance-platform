import type { ContainmentLevel, ContainmentActions } from '../types/ari';

export const CONTAINMENT_DEFAULTS: Record<ContainmentLevel, {
  name: string;
  description: string;
  color: string;
  actions: ContainmentActions;
}> = {
  0: {
    name: 'Standard',
    description: 'Normal monitoring, no restrictions',
    color: '#22c55e',
    actions: { killSwitch: false, toolRestriction: [], planningLock: false, readOnlyMode: false, nhiRevoked: false },
  },
  1: {
    name: 'State-Preserving',
    description: 'HITL checkpoints added, human notified',
    color: '#eab308',
    actions: { killSwitch: false, toolRestriction: [], planningLock: false, readOnlyMode: false, nhiRevoked: false },
  },
  2: {
    name: 'Planning Intervention',
    description: 'Agent planning locked, human review required for plans',
    color: '#f97316',
    actions: { killSwitch: false, toolRestriction: [], planningLock: true, readOnlyMode: false, nhiRevoked: false },
  },
  3: {
    name: 'Tool Restriction',
    description: 'Write/delete tools revoked ("declawing"), read-only mode',
    color: '#ef4444',
    actions: { killSwitch: false, toolRestriction: ['write', 'delete', 'execute'], planningLock: true, readOnlyMode: true, nhiRevoked: false },
  },
  4: {
    name: 'Execution Isolation',
    description: 'Full sandbox, NHI revoked (Identity Kill Switch), manual restart only',
    color: '#7f1d1d',
    actions: { killSwitch: true, toolRestriction: ['*'], planningLock: true, readOnlyMode: true, nhiRevoked: true },
  },
};
