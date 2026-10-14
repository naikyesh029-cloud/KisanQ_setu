import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface AgmarknetRecord {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  grade: string;
  arrival_date: string;
  min_price: number;
  max_price: number;
  modal_price: number;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const crop = url.searchParams.get('crop')?.trim();
  const mandi = url.searchParams.get('mandi')?.trim();
  const from = url.searchParams.get('from')?.trim();
  const live = url.searchParams.get('live') === 'true';

  const apiKey = process.env.DATA_GOV_IN_API_KEY || '579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b';

  // Live Agmarknet feed from data.gov.in
  if (live && apiKey) {
    try {
      let endpoint = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${apiKey}&format=json&limit=50&filters[state]=Maharashtra`;
      if (crop) {
        endpoint += `&filters[commodity]=${encodeURIComponent(crop)}`;
      }

      const res = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 300 } // cache for 5 minutes
      });

      if (res.ok) {
        const agmarknetData = await res.json();
        const records: AgmarknetRecord[] = Array.isArray(agmarknetData.records)
          ? agmarknetData.records.map((r: Record<string, unknown>) => ({
              state: String(r.state ?? 'Maharashtra'),
              district: String(r.district ?? ''),
              market: String(r.market ?? ''),
              commodity: String(r.commodity ?? ''),
              variety: String(r.variety ?? ''),
              grade: String(r.grade ?? 'FAQ'),
              arrival_date: String(r.arrival_date ?? ''),
              min_price: Number(r.min_price) || 0,
              max_price: Number(r.max_price) || 0,
              modal_price: Number(r.modal_price) || 0
            }))
          : [];

        if (records.length > 0) {
          return NextResponse.json({
            source: 'Agmarknet · Ministry of Agriculture & Farmers Welfare (data.gov.in)',
            provenance: 'agmarknet_live_feed',
            isLive: true,
            total: agmarknetData.total ?? records.length,
            updatedAt: agmarknetData.updated_date ?? new Date().toISOString(),
            prices: records
          });
        }
      }
    } catch {
      // Fallback to database if live API fails
    }
  }

  // Database historical records
  if (mandi && !z.string().uuid().safeParse(mandi).success) {
    return NextResponse.json({ error: 'Invalid mandi ID.' }, { status: 422 });
  }
  if (from && !z.string().date().safeParse(from).success) {
    return NextResponse.json({ error: 'Invalid from date. Use YYYY-MM-DD.' }, { status: 422 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured.', provenance: 'unavailable' }, { status: 503 });
  }

  let query = supabase
    .from('price_history')
    .select('id,mandi_id,crop,observed_on,minimum_price,maximum_price,modal_price,source,source_url,provenance')
    .order('observed_on', { ascending: true })
    .limit(500);

  if (crop) query = query.ilike('crop', crop);
  if (mandi) query = query.eq('mandi_id', mandi);
  if (from) query = query.gte('observed_on', from);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Could not load market prices.' }, { status: 400 });
  }

  return NextResponse.json({
    prices: data,
    provenance: data?.some(p => p.provenance === 'simulated_demo') ? 'contains_simulated_demo' : 'stored_source_records'
  });
}
