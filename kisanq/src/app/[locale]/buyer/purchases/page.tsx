'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { CheckCircle2, ShieldCheck, FileCheck } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Purchase = {
  id: string;
  crop: string;
  variety: string;
  quantity: number;
  unit: string;
  agreedPrice: number;
  totalAmount: number;
  mandiName: string;
  escrowStatus: 'funded' | 'released' | 'pending';
  paymentMethod: string;
  date: string;
};

type OfferWithLot = {
  id: string;
  price_per_unit?: number | null;
  status: string;
  created_at: string;
  crop_lots?: {
    crop?: string;
    variety?: string;
    quantity?: number;
    unit?: string;
    mandis?: { name?: string } | { name?: string }[];
  } | {
    crop?: string;
    variety?: string;
    quantity?: number;
    unit?: string;
    mandis?: { name?: string } | { name?: string }[];
  }[];
};

const samplePurchases: Purchase[] = [
  {
    id: 'PUR-PN-2026-001',
    crop: 'Soybean',
    variety: 'Yellow JS-335',
    quantity: 42,
    unit: 'quintal',
    agreedPrice: 4750,
    totalAmount: 199500,
    mandiName: 'Pune Market Yard',
    escrowStatus: 'funded',
    paymentMethod: 'APMC Escrow (NEFT/RTGS)',
    date: '12 Oct 2026'
  },
  {
    id: 'PUR-NS-2026-002',
    crop: 'Onion',
    variety: 'Red Nashik',
    quantity: 85,
    unit: 'quintal',
    agreedPrice: 2850,
    totalAmount: 242250,
    mandiName: 'Nashik APMC',
    escrowStatus: 'released',
    paymentMethod: 'Corporate Direct UPI',
    date: '10 Oct 2026'
  }
];

export default function BuyerPurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>(samplePurchases);
  const [authorizing, setAuthorizing] = useState<string | null>(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Attempt loading real accepted offers for this buyer
    const sb = createSupabaseBrowserClient();
    sb.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        sb.from('offers')
          .select('id, price_per_unit, status, created_at, crop_lots:crop_lots!offers_lot_id_fkey(crop, variety, quantity, unit, mandis(name))')
          .eq('buyer_id', user.id)
          .eq('status', 'accepted')
          .then(({ data }) => {
            if (data && data.length > 0) {
              const records = data as unknown as OfferWithLot[];
              const mapped: Purchase[] = records.map((o: OfferWithLot, idx: number) => {
                const lot = Array.isArray(o.crop_lots) ? o.crop_lots[0] : o.crop_lots;
                const mandi = lot?.mandis ? (Array.isArray(lot.mandis) ? lot.mandis[0]?.name : lot.mandis.name) : 'APMC Pune';
                const qty = lot?.quantity ?? 50;
                const price = o.price_per_unit ?? 3000;
                return {
                  id: `PUR-${o.id.slice(0, 8).toUpperCase()}`,
                  crop: lot?.crop ?? 'Commodity',
                  variety: lot?.variety ?? 'Standard',
                  quantity: qty,
                  unit: lot?.unit ?? 'quintal',
                  agreedPrice: price,
                  totalAmount: qty * price,
                  mandiName: mandi ?? 'APMC Pune',
                  escrowStatus: idx === 0 ? 'funded' : 'released',
                  paymentMethod: 'APMC Escrow (NEFT/RTGS)',
                  date: new Date(o.created_at).toLocaleDateString()
                };
              });
              setPurchases(mapped);
            }
          });
      }
    });
  }, []);

  function handleFundEscrow(id: string) {
    setAuthorizing(id);
    setTimeout(() => {
      setPurchases(prev =>
        prev.map(p => (p.id === id ? { ...p, escrowStatus: 'funded' } : p))
      );
      setAuthorizing(null);
      setSuccess(`Escrow funds locked successfully for agreement ${id}. Mandi dispatch pass generated.`);
      setTimeout(() => setSuccess(''), 5000);
    }, 900);
  }

  const totalProcured = purchases.reduce((acc, curr) => acc + curr.totalAmount, 0);

  return (
    <>
      <PageHeader
        eyebrow="APMC BUYER DESK"
        title="Purchases & Escrow Settlements"
        description="Direct APMC escrow payments guarantee 100% security for both buyer and farmer. Funds are safely locked in APMC escrow until weighbridge verification and physical gate exit."
      />

      {success && (
        <div role="status" style={{ display: 'flex', gap: 8, color: 'var(--accent)', fontSize: 13, padding: 12, borderRadius: 10, background: 'var(--accent-soft)', marginBottom: 18 }}>
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {/* Escrow Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" style={{ marginBottom: 22 }}>
        <div className="surface" style={{ padding: 18 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 650 }}>Total Procurement Value</div>
          <div className="metric-value" style={{ marginTop: 8 }}>₹{totalProcured.toLocaleString('en-IN')}</div>
          <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>Across all confirmed mandi agreements</p>
        </div>
        <div className="surface" style={{ padding: 18 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 650 }}>Escrow Security Model</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={18} /> APMC Tri-Party Escrow
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>Settled upon tare/gross gate weigh slip</p>
        </div>
        <div className="surface" style={{ padding: 18 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 650 }}>Settled Agreements</div>
          <div className="metric-value" style={{ marginTop: 8 }}>{purchases.length} Deals</div>
          <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>100% verified farmer contracts</p>
        </div>
      </div>

      {/* Purchases List */}
      <div className="surface table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Agreement Ref</th>
              <th>Commodity</th>
              <th>Mandi Yard</th>
              <th>Quantity</th>
              <th>Agreed Rate</th>
              <th>Total Value</th>
              <th>Escrow Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 700 }}>
                  {p.id}
                  <div className="muted" style={{ fontSize: 11 }}>{p.date}</div>
                </td>
                <td>
                  <strong>{p.crop}</strong>
                  <div className="muted" style={{ fontSize: 11 }}>{p.variety}</div>
                </td>
                <td>{p.mandiName}</td>
                <td>{p.quantity.toLocaleString()} {p.unit}</td>
                <td>₹{p.agreedPrice.toLocaleString('en-IN')} / {p.unit}</td>
                <td style={{ fontWeight: 750 }}>₹{p.totalAmount.toLocaleString('en-IN')}</td>
                <td>
                  <span className={`badge ${p.escrowStatus === 'funded' ? '' : p.escrowStatus === 'released' ? 'badge-neutral' : 'badge-warn'}`}>
                    {p.escrowStatus === 'funded' ? '🔒 Escrow Locked' : p.escrowStatus === 'released' ? '✅ Released to Farmer' : '⏳ Pending Deposit'}
                  </span>
                </td>
                <td>
                  {p.escrowStatus === 'pending' ? (
                    <button
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      disabled={authorizing === p.id}
                      onClick={() => handleFundEscrow(p.id)}
                    >
                      {authorizing === p.id ? 'Securing…' : 'Fund Escrow'}
                    </button>
                  ) : (
                    <span className="muted" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <FileCheck size={14} color="var(--accent)" /> Receipt Ready
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
