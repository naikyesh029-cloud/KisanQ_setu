import { createHash } from 'node:crypto';
export const GENESIS_HASH = 'KISANQ_LEDGER_GENESIS_V1';
export type LedgerEvent = { sequence: number; previousHash: string; payload: Record<string, unknown>; hash: string };
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number') return Number.isFinite(value) ? (Object.is(value, -0) ? '0' : String(value)) : 'null';
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).filter(key => record[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}
export function ledgerHash(previousHash: string, payload: Record<string, unknown>): string {
  return createHash('sha256').update(previousHash + canonicalJson(payload), 'utf8').digest('hex');
}
export function verifyLedger(events: LedgerEvent[]): { valid: boolean; checked: number; firstFailure: number | null } {
  let previous = GENESIS_HASH;
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (event.sequence !== i + 1 || event.previousHash !== previous || ledgerHash(previous, event.payload) !== event.hash) return { valid: false, checked: i + 1, firstFailure: event.sequence };
    previous = event.hash;
  }
  return { valid: true, checked: events.length, firstFailure: null };
}
