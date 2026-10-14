import { z } from 'zod';
const numericField = (schema: z.ZodNumber) =>
  z.preprocess(v => (typeof v === 'boolean' || v === '' || v === null ? NaN : v), schema);
const optionalNumericField = (schema: z.ZodNumber) =>
  z.preprocess(v => (v === '' || v === null || v === undefined ? undefined : typeof v === 'boolean' ? NaN : v), schema.optional());

export const cropLotSchema = z.object({
  consentAccepted: z.literal(true),
  crop: z.string().trim().min(2).max(80),
  variety: z.string().trim().min(1).max(100),
  area: numericField(z.coerce.number().positive().max(100000)),
  areaUnit: z.enum(['acre', 'hectare']),
  harvestDate: z.string().date(),
  quantity: numericField(z.coerce.number().positive().max(1_000_000)),
  unit: z.enum(['kg', 'quintal', 'tonne']),
  condition: z.enum(['excellent', 'good', 'fair', 'needs_review']),
  mandiId: z.string().uuid(),
  moisturePct: optionalNumericField(z.coerce.number().min(0).max(100)),
  askingPrice: optionalNumericField(z.coerce.number().positive().max(100_000_000)),
  description: z.preprocess(v => (v === '' || v === null ? undefined : v), z.string().trim().max(1000).optional()),
  aiPregrade: z.preprocess(v => (v === '' || v === null ? undefined : v), z.enum(['A', 'B', 'C', 'rejected']).optional()),
  aiPregradeConfidence: optionalNumericField(z.coerce.number().min(0).max(100)),
  gradingMetadata: z.record(z.unknown()).optional()
});
export const offerSchema = z.object({
  lotId: z.string().uuid(),
  pricePerUnit: numericField(z.coerce.number().positive().max(100_000_000))
});
export const acceptBestOfferSchema = z.object({
  lotId: z.string().uuid()
});
export const slotReserveSchema = z.object({
  lotId: z.string().uuid(),
  slotId: z.string().uuid()
});
export const tokenCheckInSchema = z.object({
  tokenCode: z.string().trim().regex(/^KQ-[A-F0-9]{10}$/)
});
export const inspectionSchema = z.object({
  lotId: z.string().uuid(),
  verifiedGrade: z.enum(['A', 'B', 'C', 'rejected']),
  verifiedWeight: numericField(z.coerce.number().positive().max(1_000_000)),
  moisturePct: optionalNumericField(z.coerce.number().min(0).max(100)),
  reasonCode: z.enum(['estimate_mismatch', 'weight_correction', 'moisture_correction', 'physical_condition', 'other']),
  explanation: z.string().trim().min(8).max(1000)
});
export const disputeCreateSchema = z.object({
  lotId: z.preprocess(v => (v === '' || v === null ? undefined : v), z.string().uuid().optional()),
  offerId: z.preprocess(v => (v === '' || v === null ? undefined : v), z.string().uuid().optional()),
  reasonCode: z.enum(['quality', 'weight', 'payment', 'offer_process', 'token_slot', 'other']),
  description: z.string().trim().min(8).max(2000)
}).refine(v => Boolean(v.lotId || v.offerId), { message: 'A lot or offer reference is required.' });
export const disputeUpdateSchema = z.object({
  status: z.enum(['under_review', 'resolved', 'rejected']),
  resolution: z.string().trim().min(8).max(2000)
});
export const demandQuerySchema = z.string().trim().min(2).max(80);
