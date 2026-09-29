import { z } from 'zod';

export const ProviderCodeSchema = z.enum(['UNAVAILABLE', 'INTERNAL', 'RESOURCE_EXHAUSTED',
  'INVALID_ARGUMENT', 'NOT_FOUND', 'PERMISSION_DENIED', 'UNAUTHENTICATED',
  'FAILED_PRECONDITION', 'DEADLINE_EXCEEDED', 'CANCELLED', 'UNKNOWN']);
export const AiDiagnosticSchema = z.strictObject({
  httpStatus: z.number().int().min(400).max(599).nullable(),
  providerCode: ProviderCodeSchema.nullable(),
  reason: z.enum(['high_demand', 'unknown']),
});
export type AiDiagnostic = z.infer<typeof AiDiagnosticSchema>;
