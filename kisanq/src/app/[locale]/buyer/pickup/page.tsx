'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Truck, QrCode } from 'lucide-react';

type PickupPass = {
  id: string;
  passCode: string;
  crop: string;
  variety: string;
  mandi: string;
  vehicleNo: string;
  driverName: string;
  driverPhone: string;
  slotDate: string;
  timeWindow: string;
  grossWeightKg: number | null;
  tareWeightKg: number | null;
  status: 'scheduled' | 'at_gate' | 'weighed' | 'completed';
};

const demoPasses: PickupPass[] = [
  {
    id: 'PASS-PN-01',
    passCode: 'KQ-PASS-88219',
    crop: 'Soybean',
    variety: 'Yellow JS-335',
    mandi: 'Pune Market Yard (Gate 3)',
    vehicleNo: 'MH-12-QE-4481',
    driverName: 'Sanjay Shinde',
    driverPhone: '+919822334455',
    slotDate: 'Today',
    timeWindow: '14:00 – 16:00',
    grossWeightKg: 4200,
    tareWeightKg: 1850,
    status: 'weighed'
  },
  {
    id: 'PASS-NS-02',
    passCode: 'KQ-PASS-99104',
    crop: 'Onion',
    variety: 'Red Nashik',
    mandi: 'Nashik APMC (Loading Bay 2)',
    vehicleNo: 'MH-15-BT-9021',
    driverName: 'Rahul Verma',
    driverPhone: '+919890112233',
    slotDate: 'Tomorrow',
    timeWindow: '09:00 – 11:00',
    grossWeightKg: null,
    tareWeightKg: null,
    status: 'scheduled'
  }
];

export default function BuyerPickupPage() {
  const [passes] = useState<PickupPass[]>(demoPasses);
  const [showQr, setShowQr] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        eyebrow="APMC BUYER DESK"
        title="Yard Pickup Pass & Gate Clearance"
        description="Manage vehicle logistics dispatch, digital gate entry barcodes, tare/gross weighbridge slips, and produce handover confirmation."
      />

      {/* Workflow stages */}
      <div className="surface" style={{ padding: 22, marginBottom: 22 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 7 }}>
          <Truck size={17} color="var(--accent)" /> APMC Produce Handover Lifecycle
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center" style={{ fontSize: 12 }}>
          <div style={{ padding: 12, borderRadius: 10, background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 700 }}>
            1. Escrow Funded
          </div>
          <div style={{ padding: 12, borderRadius: 10, background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 700 }}>
            2. Pass Generated
          </div>
          <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg)', fontWeight: 650 }}>
            3. Weighbridge In/Out
          </div>
          <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg)', fontWeight: 650 }}>
            4. Gate Exit & Escrow Release
          </div>
        </div>
      </div>

      {/* Active Pickup Passes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {passes.map(p => (
          <article className="surface" key={p.id} style={{ padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
                <div>
                  <span className="eyebrow">{p.mandi}</span>
                  <h2 style={{ fontSize: 18, fontWeight: 800, margin: '4px 0' }}>
                    {p.crop} · {p.variety}
                  </h2>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginTop: 4 }}>
                    Digital Pass: {p.passCode}
                  </div>
                </div>
                <span className={`badge ${p.status === 'weighed' ? '' : 'badge-neutral'}`}>
                  {p.status === 'weighed' ? 'Tare/Gross Weighed' : 'Scheduled Arrival'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4" style={{ marginTop: 18, fontSize: 12 }}>
                <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg)' }}>
                  <div className="muted">Vehicle Number</div>
                  <strong>{p.vehicleNo}</strong>
                </div>
                <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg)' }}>
                  <div className="muted">Driver / Contact</div>
                  <strong>{p.driverName}</strong>
                </div>
                <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg)' }}>
                  <div className="muted">Scheduled Time</div>
                  <strong>{p.slotDate} · {p.timeWindow}</strong>
                </div>
                <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg)' }}>
                  <div className="muted">Net Produce Weight</div>
                  <strong>
                    {p.grossWeightKg && p.tareWeightKg
                      ? `${(p.grossWeightKg - p.tareWeightKg).toLocaleString()} kg`
                      : 'Pending Tare Weigh'}
                  </strong>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                className="btn"
                style={{ fontSize: 12, padding: '8px 14px' }}
                onClick={() => setShowQr(showQr === p.id ? null : p.id)}
              >
                <QrCode size={15} /> {showQr === p.id ? 'Hide Barcode' : 'Show Gate Barcode'}
              </button>
            </div>

            {showQr === p.id && (
              <div style={{ padding: 16, marginTop: 14, borderRadius: 10, background: 'var(--bg)', textAlign: 'center' }}>
                <div style={{ fontSize: 24, letterSpacing: 6, fontWeight: 900, fontFamily: 'monospace', margin: '8px 0' }}>
                  ||||| | |||| || |||
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  Scan at APMC Security Checkpost Gate to verify vehicle entry clearance
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
