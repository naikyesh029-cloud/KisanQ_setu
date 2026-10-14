'use client';
import { useEffect,useState } from 'react';
export interface DemandPressureLabels {
  demandEmpty?: string;
  demandSignInPrompt?: string;
}

interface Demand {
  ratio: number | null;
  label: string;
  active_listings?: number;
  active_offers?: number;
  week_start?: string;
}

export function DemandPressure({ crop, labels }: { crop: string; labels?: DemandPressureLabels }) {
  const emptyLabel = labels?.demandEmpty ?? 'Not enough listings to calculate';
  const signInPrompt = labels?.demandSignInPrompt ?? 'Connect Supabase and sign in to calculate from persisted records';

  const [data, setData] = useState<Demand>({ ratio: null, label: emptyLabel });
  const [source, setSource] = useState('Waiting for authenticated market records');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/prices/demand?crop=${encodeURIComponent(crop)}`)
      .then(async r => {
        const d = await r.json();
        if (cancelled) return;
        if (r.ok) {
          setData(d);
          setSource('Calculated from persisted listing and offer records');
        } else {
          setData({ ratio: null, label: emptyLabel });
          setSource(signInPrompt);
        }
      })
      .catch(() => {
        if (!cancelled) setSource('Market activity data is unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [crop, emptyLabel, signInPrompt]);

  return (
    <>
      <div className="metric-value" style={{ marginTop: 16 }}>{data.ratio === null ? 'N/A' : data.ratio.toFixed(2)}</div>
      <p className="muted" style={{ fontSize: 12, marginTop: 7 }}>{data.label}</p>
      {typeof data.active_offers === 'number' && typeof data.active_listings === 'number' && (
        <p style={{ fontSize: 11, marginTop: 9 }}>Active offers: {data.active_offers} · Active listings: {data.active_listings}</p>
      )}
      <p className="muted" style={{ fontSize: 10, marginTop: 8 }}>{source}{data.week_start ? ` · Week of ${data.week_start}` : ''}</p>
    </>
  );
}
