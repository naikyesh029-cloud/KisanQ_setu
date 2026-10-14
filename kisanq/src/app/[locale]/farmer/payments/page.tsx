'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { ShieldCheck, Download } from 'lucide-react';

interface Settlement {
  id: string;
  lotId: string;
  crop: string;
  quantity: number;
  unit: string;
  agreedPrice: number;
  grossAmount: number;
  apmcMandiFee: number;
  netPayout: number;
  mandiName: string;
  buyerName: string;
  bankAccount: string;
  utrNo: string;
  date: string;
  status: 'transferred' | 'escrow_locked' | 'processing';
}

const sampleSettlements: Settlement[] = [
  {
    id: 'SET-PUN-2026-881',
    lotId: 'fcae6fc1-f3af-4650-9ad5-5a7ea345ebb0',
    crop: 'Soybean',
    quantity: 50,
    unit: 'quintal',
    agreedPrice: 4850,
    grossAmount: 242500,
    apmcMandiFee: 2425, // 1% mandi cess
    netPayout: 240075,
    mandiName: 'Pune Market Yard',
    buyerName: 'Sahyadri Agro Traders Pvt Ltd',
    bankAccount: 'HDFC Bank ··· 4821',
    utrNo: 'APMC-UTR-20261014-9921',
    date: '14 Oct 2026',
    status: 'escrow_locked'
  },
  {
    id: 'SET-PUN-2026-874',
    lotId: '2c1ab589-c934-4302-8130-9c00a79fb45d',
    crop: 'Paddy',
    quantity: 50,
    unit: 'quintal',
    agreedPrice: 2450,
    grossAmount: 122500,
    apmcMandiFee: 1225,
    netPayout: 121275,
    mandiName: 'Pune Market Yard',
    buyerName: 'Maharashtra Grain Logistics',
    bankAccount: 'HDFC Bank ··· 4821',
    utrNo: 'APMC-UTR-20261013-4410',
    date: '13 Oct 2026',
    status: 'transferred'
  }
];

export default function FarmerPaymentsPage() {
  const [settlements] = useState<Settlement[]>(sampleSettlements);
  const totalReceived = settlements
    .filter(s => s.status === 'transferred')
    .reduce((acc, curr) => acc + curr.netPayout, 0);

  const totalInEscrow = settlements
    .filter(s => s.status === 'escrow_locked')
    .reduce((acc, curr) => acc + curr.netPayout, 0);

  return (
    <>
      <PageHeader
        eyebrow="FINANCIAL SETTLEMENTS"
        title="Payments & APMC Tri-Party Escrow"
        description="Direct-to-bank settlement ledger backed by statutory APMC escrow accounts. 100% protection against payment defaults."
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" style={{ marginBottom: 24 }}>
        <div className="surface" style={{ padding: 18 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Total Settled Payouts</div>
          <div style={{ fontSize: 26, fontWeight: 900, marginTop: 8, color: 'var(--accent)' }}>
            ₹{totalReceived.toLocaleString('en-IN')}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Transferred to your bank via RTGS</div>
        </div>

        <div className="surface" style={{ padding: 18 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Locked in APMC Escrow</div>
          <div style={{ fontSize: 26, fontWeight: 900, marginTop: 8, color: '#2563eb' }}>
            ₹{totalInEscrow.toLocaleString('en-IN')}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Releasing upon weighbridge exit</div>
        </div>

        <div className="surface" style={{ padding: 18 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>APMC Statutory Guarantee</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={20} color="var(--accent)" /> MSAMB Verified
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Section 31 APMC Act Protection</div>
        </div>
      </div>

      {/* Settlements Table */}
      <div className="surface" style={{ padding: 22 }}>
        <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 16px' }}>Settlement & Payment Vouchers</h3>

        <div style={{ display: 'grid', gap: 14 }}>
          {settlements.map(s => (
            <div
              key={s.id}
              style={{
                padding: 18,
                borderRadius: 12,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 14
              }}
            >
              <div>
                <div className="eyebrow">{s.id} · {s.mandiName}</div>
                <h4 style={{ fontSize: 17, fontWeight: 800, margin: '3px 0' }}>
                  {s.crop} ({s.quantity} {s.unit}) · Sold to {s.buyerName}
                </h4>
                <div className="muted" style={{ fontSize: 12 }}>
                  Rate: ₹{s.agreedPrice.toLocaleString('en-IN')}/{s.unit} · Mandi Cess: ₹{s.apmcMandiFee} · Bank: {s.bankAccount}
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                  UTR / APMC Ref: <code>{s.utrNo}</code> · Date: {s.date}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent)' }}>
                  ₹{s.netPayout.toLocaleString('en-IN')}
                </div>
                <span className={`badge ${s.status === 'transferred' ? 'badge-accent' : 'badge-neutral'}`} style={{ marginTop: 4 }}>
                  {s.status === 'transferred' ? '✓ Bank Transfer Complete' : '⏳ Locked in Escrow'}
                </span>
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn"
                    style={{ fontSize: 11, padding: '4px 8px' }}
                    onClick={() => window.print()}
                  >
                    <Download size={13} /> Payment Slip
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
