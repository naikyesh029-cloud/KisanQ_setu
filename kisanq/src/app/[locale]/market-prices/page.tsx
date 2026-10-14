import { ArrowDownRight, ArrowUpRight, BarChart3, Info } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { MarketChart } from '@/components/shared/MarketChart';
import { MarketPriceExplorer } from '@/components/shared/MarketPriceExplorer';
import { getDictionary } from '@/lib/i18n/dictionaries';
const rawCrops = [
  { key: 'Paddy', price: 2320, change: 1.4, data: [{date:'Oct 05',modal:2260},{date:'Oct 06',modal:2270},{date:'Oct 07',modal:2290},{date:'Oct 08',modal:2280},{date:'Oct 09',modal:2310},{date:'Oct 10',modal:2320},{date:'Oct 11',modal:2320}] },
  { key: 'Soybean', price: 4680, change: -0.6, data: [{date:'Oct 05',modal:4740},{date:'Oct 06',modal:4720},{date:'Oct 07',modal:4690},{date:'Oct 08',modal:4710},{date:'Oct 09',modal:4660},{date:'Oct 10',modal:4685},{date:'Oct 11',modal:4680}] },
  { key: 'Onion', price: 2850, change: 3.2, data: [{date:'Oct 05',modal:2540},{date:'Oct 06',modal:2610},{date:'Oct 07',modal:2650},{date:'Oct 08',modal:2690},{date:'Oct 09',modal:2760},{date:'Oct 10',modal:2800},{date:'Oct 11',modal:2850}] },
  { key: 'Tomato', price: 1980, change: 2.1, data: [{date:'Oct 05',modal:1800},{date:'Oct 06',modal:1830},{date:'Oct 07',modal:1850},{date:'Oct 08',modal:1890},{date:'Oct 09',modal:1920},{date:'Oct 10',modal:1940},{date:'Oct 11',modal:1980}] },
  { key: 'Wheat', price: 2750, change: 0.3, data: [{date:'Oct 05',modal:2720},{date:'Oct 06',modal:2730},{date:'Oct 07',modal:2730},{date:'Oct 08',modal:2740},{date:'Oct 09',modal:2740},{date:'Oct 10',modal:2745},{date:'Oct 11',modal:2750}] },
  { key: 'Cotton', price: 7150, change: -1.1, data: [{date:'Oct 05',modal:7290},{date:'Oct 06',modal:7240},{date:'Oct 07',modal:7210},{date:'Oct 08',modal:7190},{date:'Oct 09',modal:7180},{date:'Oct 10',modal:7200},{date:'Oct 11',modal:7150}] }
];

export default async function MarketPricesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = getDictionary(locale);

  const cropNameMap: Record<string, { name: string; variety: string }> = {
    Paddy: { name: dict.cropPaddy, variety: dict.varietyCommon },
    Soybean: { name: dict.cropSoybean, variety: dict.varietyYellow },
    Onion: { name: dict.cropOnion, variety: dict.varietyRed },
    Tomato: { name: dict.cropTomato, variety: dict.varietyLocal },
    Wheat: { name: dict.cropWheat, variety: dict.varietyLokwan },
    Cotton: { name: dict.cropCotton, variety: dict.varietyMediumStaple },
  };

  const crops = rawCrops.map(c => ({
    key: c.key,
    name: cropNameMap[c.key]?.name ?? c.key,
    variety: cropNameMap[c.key]?.variety ?? 'Common',
    price: c.price,
    change: c.change,
    unit: dict.perQuintal,
    data: c.data,
  }));

  return (
    <>
      <PageHeader
        eyebrow="MARKET INTELLIGENCE"
        title={dict.market}
        description={dict.priceSub}
        action={<span className="badge badge-warn"><Info size={13} />{dict.demo}</span>}
      />
      <div
        className="surface"
        style={{
          padding: 18,
          marginBottom: 22,
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          background: 'var(--accent-soft)',
          borderColor: 'transparent'
        }}
      >
        <BarChart3 size={20} color="var(--accent)" />
        <div>
          <strong style={{ fontSize: 13 }}>{dict.simulatedNoticeTitle}</strong>
          <p style={{ fontSize: 12, margin: '3px 0 0', color: 'var(--muted)' }}>
            {dict.simulatedNoticeDesc}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {crops.map(crop => (
          <article className="surface" key={crop.key} style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
              <div>
                <div className="eyebrow">{crop.variety}</div>
                <h2 style={{ fontSize: 17, fontWeight: 750, margin: '3px 0' }}>{crop.name}</h2>
              </div>
              <span className="badge badge-neutral">{dict.demo}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 14 }}>
              <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.04em' }}>
                ₹{crop.price.toLocaleString('en-IN')}
              </span>
              <span className="muted" style={{ fontSize: 11 }}>{dict.perQuintal}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: crop.change >= 0 ? 'var(--accent)' : 'var(--danger)', marginTop: 4 }}>
              {crop.change >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
              {Math.abs(crop.change).toFixed(1)}% <span className="muted" style={{ fontWeight: 400 }}>{dict.vsPreviousDay}</span>
            </div>
            <div style={{ marginTop: 12 }}>
              <MarketChart data={crop.data} compact />
            </div>
            <div className="divider" style={{ margin: '13px 0 10px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span className="muted">{dict.history7Day}</span>
              <span className="muted">{dict.sourceSimulated}</span>
            </div>
          </article>
        ))}
      </div>
      <MarketPriceExplorer
        crops={crops}
        labels={{
          cropPriceDetail: dict.cropPriceDetail,
          cropPriceDetailSub: dict.cropPriceDetailSub,
          selectCrop: dict.selectCrop,
          demandPressureTitle: dict.demandPressureTitle,
          marketActivitySignal: dict.marketActivitySignal,
          demandFormula: dict.demandFormula,
          perQuintal: dict.perQuintal,
          mandiIllustrativeNote: dict.mandiIllustrativeNote,
          demandEmpty: dict.demandEmpty,
          demandSignInPrompt: dict.demandSignInPrompt,
        }}
      />
      <div className="muted" style={{ fontSize: 11, marginTop: 18 }}>
        {dict.dataProvenanceFooter}
      </div>
    </>
  );
}
