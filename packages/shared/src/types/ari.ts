import type { GovernanceTier } from './agent';

export interface ARIScores {
  autonomy: [number, number, number, number]; // 4 criteria × 0-3
  adaptability: [number, number, number, number];
  continuity: [number, number, number, number];
}

export interface ARICalculation {
  id: string;
  agentId: string;
  autonomyScores: ARIScores['autonomy'];
  adaptabilityScores: ARIScores['adaptability'];
  continuityScores: ARIScores['continuity'];
  compositeScore: number; // 0.00-1.00
  governanceTier: GovernanceTier;
  calculatedAt: string;
}

export type ContainmentLevel = 0 | 1 | 2 | 3 | 4;

export interface ContainmentState {
  level: ContainmentLevel;
  levelName: string;
  actions: ContainmentActions;
  escalationTrigger: string | null;
  humanOwnerNotified: boolean;
  sandboxMigrationRef: string | null;
}

export interface ContainmentActions {
  killSwitch: boolean;
  toolRestriction: string[];
  planningLock: boolean;
  readOnlyMode: boolean;
  nhiRevoked: boolean;
}

export const CONTAINMENT_LEVEL_NAMES: Record<ContainmentLevel, string> = {
  0: 'Standard',
  1: 'State-Preserving',
  2: 'Planning Intervention',
  3: 'Tool Restriction',
  4: 'Execution Isolation',
};

export const ARI_THRESHOLDS = {
  LEVEL_0_MAX: 0.25,
  LEVEL_1_MAX: 0.50,
  LEVEL_2_MAX: 0.75,
  EMERGENCY_POLICY_PASS_RATE: 0.95,
} as const;

export function ariToContainmentLevel(ariScore: number): ContainmentLevel {
  if (ariScore <= ARI_THRESHOLDS.LEVEL_0_MAX) return 0;
  if (ariScore <= ARI_THRESHOLDS.LEVEL_1_MAX) return 1;
  if (ariScore <= ARI_THRESHOLDS.LEVEL_2_MAX) return 2;
  return 3;
}

export function computeARIScore(scores: ARIScores): number {
  const sum = [
    ...scores.autonomy,
    ...scores.adaptability,
    ...scores.continuity,
  ].reduce((a, b) => a + b, 0);
  const max = 12 * 3; // 12 criteria × max score 3
  return Math.round((sum / max) * 100) / 100;
}
