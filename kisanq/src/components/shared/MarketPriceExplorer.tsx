'use client';
import { useState } from 'react';
import { MarketChart, type ChartPoint } from './MarketChart';
import { DemandPressure } from './DemandPressure';
type MarketCrop = {
  name: string;
  key?: string;
  variety: string;
  price: number;
  change: number;
  data: ChartPoint[];
};

export interface MarketPriceExplorerLabels {
  cropPriceDetail?: string;
  cropPriceDetailSub?: string;
  selectCrop?: string;
  demandPressureTitle?: string;
  marketActivitySignal?: string;
  demandFormula?: string;
  perQuintal?: string;
  mandiIllustrativeNote?: string;
  demandEmpty?: string;
  demandSignInPrompt?: string;
}

export function MarketPriceExplorer({ crops, labels }: { crops: MarketCrop[]; labels?: MarketPriceExplorerLabels }) {
  const [selected, setSelected] = useState(crops[0]?.name ?? '');
  const crop = crops.find(c => c.name === selected) ?? crops[0];
  if (!crop) return null;

  const t = {
    cropPriceDetail: labels?.cropPriceDetail ?? 'Crop price detail',
    cropPriceDetailSub: labels?.cropPriceDetailSub ?? 'Interactive 7-day modal-price history · illustrative demonstration data',
    selectCrop: labels?.selectCrop ?? 'Select crop',
    demandPressureTitle: labels?.demandPressureTitle ?? 'Demand pressure',
    marketActivitySignal: labels?.marketActivitySignal ?? 'Market activity signal',
    demandFormula: labels?.demandFormula ?? 'Active buyer offers ÷ active listings for this crop in the current week.',
    perQuintal: labels?.perQuintal ?? '/ quintal',
    mandiIllustrativeNote: labels?.mandiIllustrativeNote ?? 'Mandi: illustrative Pimpri APMC series · Source: simulated_demo · No verified feed connected.',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginTop: 22 }}>
      <section className="surface lg:col-span-2" style={{ padding: 22 }}>
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div>
            <h2 className="section-title" style={{ margin: 0 }}>{t.cropPriceDetail}</h2>
            <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t.cropPriceDetailSub}</p>
          </div>
          <div>
            <label className="field-label" htmlFor="price-detail-crop">{t.selectCrop}</label>
            <select
              id="price-detail-crop"
              className="field"
              style={{ width: 180 }}
              value={selected}
              onChange={e => setSelected(e.target.value)}
            >
              {crops.map(c => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', marginTop: 18 }}>
          <strong style={{ fontSize: 26 }}>₹{crop.price.toLocaleString('en-IN')}</strong>
          <span className="muted" style={{ fontSize: 12 }}>
            {crop.variety} · {t.perQuintal}
          </span>
        </div>
        <div style={{ marginTop: 12 }}>
          <MarketChart data={crop.data} />
        </div>
        <div className="divider" style={{ margin: '12px 0' }} />
        <p className="muted" style={{ fontSize: 11 }}>{t.mandiIllustrativeNote}</p>
      </section>
      <div className="surface" style={{ padding: 22 }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          {t.demandPressureTitle}: {crop.name}
        </h2>
        <div className="badge badge-neutral" style={{ marginTop: 12 }}>{t.marketActivitySignal}</div>
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>{t.demandFormula}</p>
        <DemandPressure
          crop={crop.key ?? crop.name}
          labels={{
            demandEmpty: labels?.demandEmpty,
            demandSignInPrompt: labels?.demandSignInPrompt,
          }}
        />
      </div>
    </div>
  );
}

