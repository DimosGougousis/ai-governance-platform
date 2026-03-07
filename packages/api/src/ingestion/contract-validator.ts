import { z } from 'zod';
import {
  CONTRACT_SCHEMAS,
  type ContractType,
  contractC1Schema,
  contractC2Schema,
  contractC3Schema,
  contractC4Schema,
  contractC5Schema,
  contractC6Schema,
  contractC7Schema,
} from '@governance/shared';

export interface ValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  errors?: z.ZodIssue[];
  contractType: ContractType;
  receivedAt: string;
}

/**
 * Validates incoming data against a governance data contract schema.
 * The platform is tool-agnostic — it validates the shape, not the source.
 */
export function validateContract<T extends ContractType>(
  contractType: T,
  payload: unknown,
): ValidationResult {
  const schema = CONTRACT_SCHEMAS[contractType];
  if (!schema) {
    return {
      success: false,
      errors: [{ code: 'custom', path: ['contractType'], message: `Unknown contract type: ${contractType}` }],
      contractType,
      receivedAt: new Date().toISOString(),
    };
  }

  const result = schema.safeParse(payload);

  if (result.success) {
    return {
      success: true,
      data: result.data,
      contractType,
      receivedAt: new Date().toISOString(),
    };
  }

  return {
    success: false,
    errors: result.error.issues,
    contractType,
    receivedAt: new Date().toISOString(),
  };
}

/**
 * Validates a batch of records against a single contract type.
 * Returns per-record validation results.
 */
export function validateBatch(
  contractType: ContractType,
  records: unknown[],
): { valid: ValidationResult[]; invalid: ValidationResult[] } {
  const valid: ValidationResult[] = [];
  const invalid: ValidationResult[] = [];

  for (const record of records) {
    const result = validateContract(contractType, record);
    if (result.success) {
      valid.push(result);
    } else {
      invalid.push(result);
    }
  }

  return { valid, invalid };
}

/**
 * Maps contract types to their required risk tiers.
 * Used to verify that an agent of a given risk tier provides the required contracts.
 */
export const CONTRACT_REQUIREMENTS: Record<string, ContractType[]> = {
  minimal:       ['C1', 'C2', 'C4'],
  limited:       ['C1', 'C2', 'C3', 'C4', 'C6'],
  high:          ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'],
  unacceptable:  ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'],
};

/**
 * Checks which contracts an agent must satisfy based on its risk tier,
 * and which are currently being satisfied (have recent data).
 */
export function checkContractCompliance(
  riskTier: string,
  satisfiedContracts: ContractType[],
): { required: ContractType[]; missing: ContractType[]; satisfied: ContractType[]; compliant: boolean } {
  const required = CONTRACT_REQUIREMENTS[riskTier] || CONTRACT_REQUIREMENTS.limited;
  const missing = required.filter(c => !satisfiedContracts.includes(c));

  return {
    required,
    missing,
    satisfied: satisfiedContracts.filter(c => required.includes(c)),
    compliant: missing.length === 0,
  };
}
