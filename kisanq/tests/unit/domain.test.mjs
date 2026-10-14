import test from 'node:test';
import assert from 'node:assert/strict';
import { demandPressure, bestOffer, offerWindowHours, offerCountdown, calculateStorageHeadroom, slotRecommendation, normalizeLotTokens } from '../../src/lib/domain/market.ts';
import { canonicalJson, ledgerHash, verifyLedger, GENESIS_HASH } from '../../src/lib/domain/ledger.ts';
import { hasRole, roleHome, resolvePostLoginPath } from '../../src/lib/auth/roles.ts';
import {
  cropLotSchema,
  offerSchema,
  inspectionSchema,
  disputeCreateSchema,
  disputeUpdateSchema,
  tokenCheckInSchema
} from '../../src/lib/validation/schemas.ts';
import {
  analyzeRgbSamples,
  extractSamplesFromBase64,
  calculateLuminance,
  calculateColorDistance,
  MANDI_QUALITY_DISCLAIMER
} from '../../src/lib/domain/aiQualityAnalyzer.ts';

test('demand pressure handles zero listings and invalid values without division by zero', () => {
  assert.deepEqual(demandPressure(5, 0), { ratio: null, label: 'Not enough listings to calculate' });
  assert.equal(demandPressure(6, 3).ratio, 2);
  assert.equal(demandPressure(-1, 3).ratio, null);
  assert.equal(demandPressure(Number.NaN, 3).ratio, null);
});

test('best offer chooses highest active unexpired offer; ties use earliest creation time then deterministic ID', () => {
  const now = Date.parse('2026-10-11T10:00:00Z');
  const offers = [
    { id: 'b', lotId: 'lot', buyerId: 'x', pricePerUnit: 20, status: 'active', expiresAt: '2026-10-11T12:00:00Z', createdAt: '2026-10-11T09:00:00Z' },
    { id: 'a', lotId: 'lot', buyerId: 'y', pricePerUnit: 20, status: 'active', expiresAt: '2026-10-11T12:00:00Z', createdAt: '2026-10-11T08:00:00Z' },
    { id: 'c', lotId: 'lot', buyerId: 'z', pricePerUnit: 100, status: 'active', expiresAt: '2026-10-11T09:00:00Z', createdAt: '2026-10-11T07:00:00Z' }
  ];
  assert.equal(bestOffer(offers, 'lot', now)?.id, 'a');
  assert.equal(bestOffer(offers, 'other', now), null);

  const exactTimestampTie = [
    { id: 'offer-2', lotId: 'lot', buyerId: 'x', pricePerUnit: 50, status: 'active', expiresAt: '2026-10-11T12:00:00Z', createdAt: '2026-10-11T08:00:00Z' },
    { id: 'offer-1', lotId: 'lot', buyerId: 'y', pricePerUnit: 50, status: 'active', expiresAt: '2026-10-11T12:00:00Z', createdAt: '2026-10-11T08:00:00Z' }
  ];
  assert.equal(bestOffer(exactTimestampTie, 'lot', now)?.id, 'offer-1');
});

test('best offer supports escalated awaiting_farmer offers after window expiry', () => {
  const now = Date.parse('2026-10-11T14:00:00Z');
  const offers = [
    { id: 'esc-1', lotId: 'lot', buyerId: 'x', pricePerUnit: 2150, status: 'awaiting_farmer', expiresAt: '2026-10-11T12:00:00Z', createdAt: '2026-10-11T08:00:00Z' },
    { id: 'exp-2', lotId: 'lot', buyerId: 'y', pricePerUnit: 2100, status: 'expired', expiresAt: '2026-10-11T12:00:00Z', createdAt: '2026-10-11T08:30:00Z' }
  ];
  assert.equal(bestOffer(offers, 'lot', now, 'esc-1')?.id, 'esc-1');
  assert.equal(bestOffer(offers, 'lot', now, 'other-id'), null);
});

test('crop perishability windows cover all AddCropForm crops and match SQL migrations', async () => {
  assert.equal(offerWindowHours('Spinach'), 3);
  assert.equal(offerWindowHours('Leafy vegetables'), 3);
  assert.equal(offerWindowHours('Coriander'), 3);
  assert.equal(offerWindowHours('Lettuce'), 3);
  assert.equal(offerWindowHours('Fenugreek'), 3);
  assert.equal(offerWindowHours('Tomato'), 8);
  assert.equal(offerWindowHours('Tomatoes'), 8);
  assert.equal(offerWindowHours('Onion'), 8);
  assert.equal(offerWindowHours('Potato'), 8);
  assert.equal(offerWindowHours('Brinjal'), 8);
  assert.equal(offerWindowHours('Paddy'), 48);
  assert.equal(offerWindowHours('Rice'), 48);
  assert.equal(offerWindowHours('Wheat'), 48);
  assert.equal(offerWindowHours('Wheat grain'), 48);
  assert.equal(offerWindowHours('Maize'), 48);
  assert.equal(offerWindowHours('Soybean'), 48);
  assert.equal(offerWindowHours('Cotton'), 48);
  assert.equal(offerWindowHours('unknown crop'), 12);

  const fs = await import('node:fs');
  const path = await import('node:path');
  const m0001 = fs.readFileSync(path.resolve('supabase/migrations/0001_initial_schema.sql'), 'utf8');
  const m0011 = fs.readFileSync(path.resolve('supabase/migrations/0011_workflow_and_security_fixes.sql'), 'utf8');
  const combinedSql = `${m0001}\n${m0011}`.toLowerCase();
  for (const crop of [
    'spinach',
    'leafy vegetables',
    'coriander',
    'lettuce',
    'fenugreek',
    'tomato',
    'tomatoes',
    'onion',
    'potato',
    'brinjal',
    'paddy',
    'rice',
    'wheat',
    'wheat grain',
    'soybean',
    'cotton',
    'maize'
  ]) {
    assert.equal(combinedSql.includes(`'${crop}'`), true, `Expected SQL crop_profiles to include ${crop}`);
  }
});

test('countdown uses persisted deadline and clamps expired deadlines', () => {
  assert.equal(offerCountdown('2026-10-11T12:15:00Z', Date.parse('2026-10-11T10:00:00Z')), '2h 15m remaining');
  assert.equal(offerCountdown('2026-10-11T09:00:00Z', Date.parse('2026-10-11T10:00:00Z')), 'Offers closed');
});

test('storage headroom is unavailable when capacity is missing and bounded at zero', () => {
  assert.equal(calculateStorageHeadroom(null, 10).available, null);
  assert.equal(calculateStorageHeadroom(100, 120).available, 0);
  assert.equal(calculateStorageHeadroom(100, 25).percent, 75);
});

test('slot recommendation explains capacity and never recommends negative capacity', () => {
  assert.equal(slotRecommendation(30, 27, 5).utilization, 107);
  assert.equal(slotRecommendation(30, 27, 5).recommended, 3);
  assert.equal(slotRecommendation(0, 0, 5).recommended, 0);
});

test('canonical JSON is stable across key order, omits undefined properties, and normalizes -0', () => {
  assert.equal(canonicalJson({ z: 2, a: { b: 1 } }), canonicalJson({ a: { b: 1 }, z: 2 }));
  assert.equal(canonicalJson({ a: 1, b: undefined }), '{"a":1}');
  assert.equal(canonicalJson({ zero: -0 }), '{"zero":0}');
  assert.equal(canonicalJson([1, undefined, 'x']), '[1,null,"x"]');
});

test('ledger verifies valid chain and detects payload tampering and sequence gaps', () => {
  const p1 = { action: 'lot_created', id: '1' };
  const h1 = ledgerHash(GENESIS_HASH, p1);
  const p2 = { action: 'offer_created', id: '2' };
  const h2 = ledgerHash(h1, p2);
  const chain = [
    { sequence: 1, previousHash: GENESIS_HASH, payload: p1, hash: h1 },
    { sequence: 2, previousHash: h1, payload: p2, hash: h2 }
  ];
  assert.deepEqual(verifyLedger(chain), { valid: true, checked: 2, firstFailure: null });
  assert.equal(verifyLedger([{ ...chain[0], payload: { ...p1, id: 'tampered' } }, chain[1]]).valid, false);
  assert.equal(verifyLedger([{ ...chain[0], sequence: 2 }]).firstFailure, 2);
});

test('role hierarchy, role homes, and post-login redirect validation prevent privilege escalation and open redirects', () => {
  assert.equal(hasRole('farmer', 'farmer'), true);
  assert.equal(hasRole('inspector', 'farmer'), false);
  assert.equal(hasRole('supervisor', 'inspector'), true);
  assert.equal(hasRole('inspector', 'supervisor'), false);
  assert.equal(roleHome('farmer'), '/en/farmer/lots');
  assert.equal(roleHome('buyer'), '/en/buyer/marketplace');
  assert.equal(roleHome('inspector'), '/en/inspector/dashboard');
  assert.equal(roleHome('supervisor', 'hi'), '/hi/inspector/supervisor-audit');

  // Shared dispute desk is accessible to all four roles
  assert.equal(resolvePostLoginPath('farmer', 'en', '/en/inspector/disputes'), '/en/inspector/disputes');
  assert.equal(resolvePostLoginPath('buyer', 'en', '/en/inspector/disputes'), '/en/inspector/disputes');
  // Cross-role paths fall back to roleHome
  assert.equal(resolvePostLoginPath('farmer', 'en', '/en/inspector/dashboard'), '/en/farmer/lots');
  assert.equal(resolvePostLoginPath('inspector', 'en', '/en/inspector/supervisor-audit'), '/en/inspector/dashboard');
  assert.equal(resolvePostLoginPath('supervisor', 'en', '/en/inspector/supervisor-audit'), '/en/inspector/supervisor-audit');
  // Open redirect vectors are rejected
  assert.equal(resolvePostLoginPath('farmer', 'en', '//evil.example.com'), '/en/farmer/lots');
  assert.equal(resolvePostLoginPath('farmer', 'en', 'https://evil.example.com'), '/en/farmer/lots');
  assert.equal(resolvePostLoginPath('farmer', 'en', '/\\evil.example.com'), '/en/farmer/lots');
});

test('validation schemas preserve optional moisture, reject boolean coercion, and enforce UUID/token constraints', () => {
  const validInspection = inspectionSchema.safeParse({
    lotId: '20000000-0000-4000-8000-000000000001',
    verifiedGrade: 'A',
    verifiedWeight: '29.8',
    moisturePct: '',
    reasonCode: 'weight_correction',
    explanation: 'Physical weighbridge reading verified at gate.'
  });
  assert.equal(validInspection.success, true);
  assert.equal(validInspection.data?.moisturePct, undefined);

  const zeroMoistureInspection = inspectionSchema.safeParse({
    lotId: '20000000-0000-4000-8000-000000000001',
    verifiedGrade: 'A',
    verifiedWeight: 29.8,
    moisturePct: 0,
    reasonCode: 'moisture_correction',
    explanation: 'Dry sample verified at zero moisture.'
  });
  assert.equal(zeroMoistureInspection.success, true);
  assert.equal(zeroMoistureInspection.data?.moisturePct, 0);

  const booleanQuantityLot = cropLotSchema.safeParse({
    consentAccepted: true,
    crop: 'Wheat',
    variety: 'Lokwan',
    area: true,
    areaUnit: 'acre',
    harvestDate: '2026-10-10',
    quantity: 10,
    unit: 'quintal',
    condition: 'good',
    mandiId: '10000000-0000-4000-8000-000000000001'
  });
  assert.equal(booleanQuantityLot.success, false);

  const validOffer = offerSchema.safeParse({
    lotId: '20000000-0000-4000-8000-000000000001',
    pricePerUnit: 2500
  });
  assert.equal(validOffer.success, true);

  assert.equal(disputeCreateSchema.safeParse({ reasonCode: 'quality', description: 'Moisture reading disputed by farmer' }).success, false);
  assert.equal(
    disputeCreateSchema.safeParse({
      lotId: '20000000-0000-4000-8000-000000000001',
      reasonCode: 'quality',
      description: 'Moisture reading disputed by farmer'
    }).success,
    true
  );
  assert.equal(disputeUpdateSchema.safeParse({ status: 'resolved', resolution: 'Re-weighed on calibrated scale #2.' }).success, true);
  assert.equal(tokenCheckInSchema.safeParse({ tokenCode: 'KQ-1A2B3C4D5E' }).success, true);
  assert.equal(tokenCheckInSchema.safeParse({ tokenCode: 'kq-1a2b3c4d5e' }).success, false);
});

test('English, Hindi and Marathi dictionaries have the same stable key set', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const read = locale => JSON.parse(fs.readFileSync(path.resolve('src/messages', `${locale}.json`), 'utf8'));
  const en = read('en');
  const hi = read('hi');
  const mr = read('mr');
  assert.deepEqual(Object.keys(hi).sort(), Object.keys(en).sort());
  assert.deepEqual(Object.keys(mr).sort(), Object.keys(en).sort());
});

test('normalizeLotTokens handles PostgREST one-to-one object, array, null, and undefined shapes', () => {
  const singleToken = { token_code: 'KQ-1A2B3C4D5E', status: 'checked_in' };
  assert.deepEqual(normalizeLotTokens(singleToken), [singleToken]);
  assert.deepEqual(normalizeLotTokens([singleToken]), [singleToken]);
  assert.deepEqual(normalizeLotTokens(null), []);
  assert.deepEqual(normalizeLotTokens(undefined), []);
});

test('migration 0011 qualifies o.created_at in market_demand_pressure, keeps guard_offer_insert least-privilege, and isolates accept_best_offer to target lot', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const sql = fs.readFileSync(path.resolve('supabase/migrations/0011_workflow_and_security_fixes.sql'), 'utf8');

  // 1. market_demand_pressure must qualify o.created_at on both lower and upper bounds in the join query
  assert.equal(sql.includes("and o.created_at>=(week_start::timestamp at time zone 'Asia/Kolkata') and o.created_at<((week_start+7)::timestamp at time zone 'Asia/Kolkata')"), true);
  assert.equal(sql.includes("and o.created_at>=(week_start::timestamp at time zone 'Asia/Kolkata') and created_at<"), false);

  // 2. guard_offer_insert must remain SECURITY INVOKER (no security definer) and not FOR UPDATE lock crop_lots
  const guardOfferMatch = sql.match(/create or replace function public\.guard_offer_insert\(\)[\s\S]*?end; \$\$;/);
  assert.ok(guardOfferMatch, 'guard_offer_insert definition must exist');
  assert.equal(guardOfferMatch[0].toLowerCase().includes('security definer'), false);
  assert.equal(guardOfferMatch[0].toLowerCase().includes('for update'), false);

  // 3. accept_best_offer must not invoke global process_expired_offers()
  const acceptBestMatch = sql.match(/create or replace function public\.accept_best_offer\(p_lot_id uuid\)[\s\S]*?end; \$\$;/);
  assert.ok(acceptBestMatch, 'accept_best_offer definition must exist');
  assert.equal(acceptBestMatch[0].includes('process_expired_offers()'), false);
});

test('AI Crop Quality Analyzer deterministically grades sample pixels, estimates moisture, and enforces advisory disclaimer', () => {
  // Test luminance and color distance
  assert.equal(Math.round(calculateLuminance(255, 255, 255)), 255);
  assert.equal(Math.round(calculateLuminance(0, 0, 0)), 0);
  assert.equal(calculateColorDistance({ r: 10, g: 20, b: 30 }, { r: 10, g: 20, b: 30 }), 0);

  // Pure high-quality tomato samples -> Grade A
  const premiumTomato = Array.from({ length: 100 }, () => ({ r: 200, g: 45, b: 35 }));
  const reportA = analyzeRgbSamples('Tomato', premiumTomato);
  assert.equal(reportA.grade, 'A');
  assert.equal(reportA.defectPercentage, 0);
  assert.equal(reportA.uniformityScore >= 85, true);
  assert.equal(reportA.confidence >= 80, true);
  assert.equal(reportA.disclaimer, MANDI_QUALITY_DISCLAIMER);
  assert.equal(reportA.primaryDefect, null);

  // Highly blemished/dark samples -> Rejected
  const necroticTomato = Array.from({ length: 100 }, (_, i) => 
    i < 40 ? { r: 20, g: 15, b: 15 } : { r: 200, g: 45, b: 35 }
  );
  const reportRejected = analyzeRgbSamples('Tomato', necroticTomato);
  assert.equal(reportRejected.grade, 'rejected');
  assert.equal(reportRejected.defectPercentage >= 35, true);
  assert.ok(reportRejected.primaryDefect);

  // Moderate blemish -> Grade B or C
  const standardWheat = Array.from({ length: 100 }, (_, i) =>
    i < 10 ? { r: 40, g: 40, b: 40 } : { r: 210, g: 175, b: 115 }
  );
  const reportWheat = analyzeRgbSamples('Wheat', standardWheat);
  assert.equal(reportWheat.grade, 'B');
  assert.equal(reportWheat.estimatedMoisturePct >= 9.5 && reportWheat.estimatedMoisturePct <= 14.0, true);

  // Base64 extraction returns reproducible sample array
  const mockBase64 = 'data:image/jpeg;base64,' + Buffer.from('kisanq-crop-sample-photo-data-buffer').toString('base64');
  const extracted = extractSamplesFromBase64(mockBase64);
  assert.equal(Array.isArray(extracted), true);
  assert.equal(extracted.length > 0, true);
});

test('cropLotSchema validates AI pre-grade fields and rejects out-of-range confidence', () => {
  const lotWithAi = cropLotSchema.safeParse({
    consentAccepted: true,
    crop: 'Tomato',
    variety: 'Vaishali',
    area: 2.5,
    areaUnit: 'acre',
    harvestDate: '2026-10-12',
    quantity: 50,
    unit: 'quintal',
    condition: 'excellent',
    mandiId: '10000000-0000-4000-8000-000000000001',
    aiPregrade: 'A',
    aiPregradeConfidence: 92.5,
    gradingMetadata: { defectRatio: 2.1, uniformity: 95 }
  });
  assert.equal(lotWithAi.success, true);
  assert.equal(lotWithAi.data?.aiPregrade, 'A');
  assert.equal(lotWithAi.data?.aiPregradeConfidence, 92.5);

  const invalidGrade = cropLotSchema.safeParse({
    consentAccepted: true,
    crop: 'Tomato',
    variety: 'Vaishali',
    area: 2.5,
    areaUnit: 'acre',
    harvestDate: '2026-10-12',
    quantity: 50,
    unit: 'quintal',
    condition: 'excellent',
    mandiId: '10000000-0000-4000-8000-000000000001',
    aiPregrade: 'INVALID_GRADE'
  });
  assert.equal(invalidGrade.success, false);

  const invalidConfidence = cropLotSchema.safeParse({
    consentAccepted: true,
    crop: 'Tomato',
    variety: 'Vaishali',
    area: 2.5,
    areaUnit: 'acre',
    harvestDate: '2026-10-12',
    quantity: 50,
    unit: 'quintal',
    condition: 'excellent',
    mandiId: '10000000-0000-4000-8000-000000000001',
    aiPregradeConfidence: 150
  });
  assert.equal(invalidConfidence.success, false);
});

test('migration 0011 includes ensure_my_profile and role-aware handle_new_user', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const sql = fs.readFileSync(path.resolve('supabase/migrations/0011_workflow_and_security_fixes.sql'), 'utf8');

  assert.equal(sql.includes('function public.ensure_my_profile'), true);
  assert.equal(sql.includes("p_role in ('farmer', 'buyer')"), true);
  assert.equal(sql.includes('function public.handle_new_user'), true);
  assert.equal(sql.includes('extensions.digest'), true);
});



