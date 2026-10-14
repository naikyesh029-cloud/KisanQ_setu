import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { normalizeLotTokens } from '@/lib/domain/market';
import { cropLotSchema } from '@/lib/validation/schemas';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: 'Database is not configured. Set Supabase URL/key, apply migrations and sign in before registering a production lot.' }, { status: 503 });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Sign in is required to register a crop lot.' }, { status: 401 });
  const { data: profile, error: profileError } = await supabase.from('profiles').select('role,consent_version,consent_at').eq('id', user.id).single();
  if (profileError || profile?.role !== 'farmer') return NextResponse.json({ error: 'Only a farmer account can register crop lots.' }, { status: 403 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const parsed = cropLotSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Please correct the crop lot fields.', issues: parsed.error.flatten().fieldErrors }, { status: 422 });
  const input = parsed.data;
  if (!profile.consent_version || !profile.consent_at) {
    await supabase.from('profiles').update({
      consent_version: 'kisanq-consent-v1',
      consent_at: new Date().toISOString()
    }).eq('id', user.id);
  }
  if (input.harvestDate > new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())) return NextResponse.json({ error: 'Harvest date cannot be in the future.' }, { status: 422 });
  const { data: mandi } = await supabase.from('mandis').select('id').eq('id', input.mandiId).eq('active', true).maybeSingle();
  if (!mandi) return NextResponse.json({ error: 'Selected mandi is unavailable. Refresh and choose an active mandi.' }, { status: 422 });
  const { data: lot, error } = await supabase.from('crop_lots').insert({
    farmer_id: user.id,
    crop: input.crop,
    variety: input.variety,
    area: input.area,
    area_unit: input.areaUnit,
    harvest_date: input.harvestDate,
    quantity: input.quantity,
    unit: input.unit,
    condition: input.condition,
    mandi_id: input.mandiId,
    moisture_pct: input.moisturePct ?? null,
    asking_price: input.askingPrice ?? null,
    description: input.description ?? null,
    ai_pregrade: input.aiPregrade ?? null,
    ai_pregrade_confidence: input.aiPregradeConfidence ?? null,
    grading_method: input.aiPregrade ? 'kisanq_ai_vision_v1' : null,
    grading_metadata: input.gradingMetadata ? (input.gradingMetadata as Record<string, unknown>) : null,
    status: 'listed',
    consent_recorded_at: new Date().toISOString()
  }).select('id,crop,variety,quantity,unit,status,created_at').single();
  if (error) return NextResponse.json({ error: 'Could not save the crop lot. Confirm the database migration and selected mandi are configured.' }, { status: 400 });
  return NextResponse.json({ lot }, { status: 201 });
}
export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase is not configured.', lots: [] }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to view database-backed crop lots.', lots: [] }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  let query = supabase.from('crop_lots').select('id,crop,variety,area,area_unit,harvest_date,quantity,unit,condition,mandi_id,status,moisture_pct,verified_moisture_pct,asking_price,ai_pregrade,ai_pregrade_confidence,verified_grade,verified_weight,offer_expires_at,expiry_processed_at,best_offer_id,created_at,mandis(name,district),tokens(token_code,status,slots(slot_date,starts_at,ends_at)),offers:offers!offers_lot_id_fkey(id,price_per_unit,status,expires_at,created_at)').order('created_at',{ascending:false}).limit(100);
  if (profile?.role === 'farmer') query = query.eq('farmer_id', user.id);
  else if (profile?.role === 'buyer') query = query.in('status',['listed','reserved','checked_in','inspected']).is('expiry_processed_at',null).or(`offer_expires_at.is.null,offer_expires_at.gt.${new Date().toISOString()}`);
  else if (profile?.role !== 'inspector' && profile?.role !== 'supervisor') return NextResponse.json({ error: 'Your account role is not authorized.', lots: [] }, { status: 403 });
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Could not load crop lots.', lots: [] }, { status: 400 });
  const rows = (data ?? []).map(lot => ({ ...lot, tokens: normalizeLotTokens(lot.tokens) }));
  if ((profile?.role === 'buyer' || profile?.role === 'inspector' || profile?.role === 'supervisor') && rows.length > 0) {
    const { data: aggregates } = await supabase.rpc('highest_active_offers', { p_lot_ids: rows.map(lot => lot.id) });
    const highestByLot = new Map<string, number | null>((aggregates ?? []).map((item: { lot_id: string; highest_offer: number | string | null }) => [item.lot_id, item.highest_offer === null ? null : Number(item.highest_offer)] as const));
    return NextResponse.json({ lots: rows.map(lot => ({ ...lot, highest_offer: highestByLot.get(lot.id) ?? null })), mode: 'supabase' });
  }
  return NextResponse.json({ lots: rows, mode: 'supabase' });
}
