export type Offer = { id: string; lotId: string; buyerId: string; pricePerUnit: number; status: 'active'|'awaiting_farmer'|'accepted'|'rejected'|'withdrawn'|'expired'; expiresAt: string; createdAt: string };
export type PricePoint = { date: string; modal: number; provenance: 'verified_source'|'simulated_demo' };
export function demandPressure(activeOffers: number, activeListings: number): { ratio: number | null; label: string } {
  if (!Number.isFinite(activeOffers) || !Number.isFinite(activeListings) || activeOffers < 0 || activeListings <= 0) return { ratio: null, label: 'Not enough listings to calculate' };
  const ratio = activeOffers / activeListings;
  return { ratio, label: `${ratio.toFixed(2)} offers per listing` };
}
export function bestOffer(offers: Offer[], lotId: string, now = Date.now(), escalatedOfferId?: string | null): Offer | null {
  return offers.filter(o => o.lotId === lotId && ((o.status === 'active' && Date.parse(o.expiresAt) > now) || (Boolean(escalatedOfferId) && o.id === escalatedOfferId && o.status === 'awaiting_farmer')))
    .sort((a,b) => b.pricePerUnit - a.pricePerUnit || Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id))[0] ?? null;
}
export function offerWindowHours(crop: string): number {
  const normalized = crop.trim().toLowerCase();
  if (['spinach','leafy vegetables','coriander','lettuce','fenugreek'].includes(normalized)) return 3;
  if (['tomato','tomatoes','onion','potato','brinjal'].includes(normalized)) return 8;
  if (['paddy','rice','wheat','soybean','cotton','maize','wheat grain'].includes(normalized)) return 48;
  return 12;
}
export function offerCountdown(expiresAt: string, now = Date.now()): string {
  const ms = Math.max(0, Date.parse(expiresAt) - now);
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return ms <= 0 ? 'Offers closed' : `${hours}h ${minutes}m remaining`;
}
export function calculateStorageHeadroom(capacity: number | null, occupied: number | null): { available: number | null; percent: number | null; label: string } {
  if (capacity === null || occupied === null || !Number.isFinite(capacity) || !Number.isFinite(occupied) || capacity <= 0 || occupied < 0) return { available: null, percent: null, label: 'Capacity or occupancy unavailable' };
  const available = Math.max(0, capacity - occupied);
  return { available, percent: Math.max(0, Math.min(100, available / capacity * 100)), label: `${available.toLocaleString()} units available` };
}
export function slotRecommendation(capacity: number, booked: number, expected: number): { recommended: number; utilization: number; reason: string } {
  const safeCapacity = Math.max(0, capacity);
  const utilization = safeCapacity === 0 ? 100 : Math.round(((booked + expected) / safeCapacity) * 100);
  const recommended = Math.max(0, Math.min(expected, safeCapacity - booked));
  return { recommended, utilization, reason: safeCapacity === 0 ? 'No capacity configured' : utilization >= 90 ? 'Near capacity: divert arrivals to a less-loaded slot' : utilization >= 70 ? 'Elevated load: monitor check-in queue' : 'Capacity available based on booked and expected loads' };
}
export function normalizeLotTokens<T>(tokens: T | T[] | null | undefined): T[] {
  if (!tokens) return [];
  return Array.isArray(tokens) ? tokens : [tokens];
}
