'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { TicketCheck, QrCode } from 'lucide-react';

interface ArrivalToken {
  id: string;
  tokenCode: string;
  lotId: string;
  crop: string;
  variety: string;
  quantity: number;
  unit: string;
  mandi: string;
  gateNo: string;
  slotDate: string;
  timeWindow: string;
  queuePosition: number;
  estimatedWaitMinutes: number;
  status: 'booked' | 'in_queue' | 'called_in' | 'completed';
}

const sampleTokens: ArrivalToken[] = [
  {
    id: 'tok-1',
    tokenCode: 'KQ-PUN-8821',
    lotId: '2c1ab589-c934-4302-8130-9c00a79fb45d',
    crop: 'Paddy',
    variety: 'Lokwan Standard',
    quantity: 50,
    unit: 'quintal',
    mandi: 'Pune Market Yard (Gultekdi)',
    gateNo: 'Gate 2 (Weighbridge Bay A)',
    slotDate: 'Today (14 Oct)',
    timeWindow: '10:00 – 12:00',
    queuePosition: 3,
    estimatedWaitMinutes: 14,
    status: 'in_queue'
  },
  {
    id: 'tok-2',
    tokenCode: 'KQ-PIM-9942',
    lotId: '89e92293-c708-4b41-bfbb-e57a15bf8e60',
    crop: 'Soybean',
    variety: 'Yellow JS-335',
    quantity: 42,
    unit: 'quintal',
    mandi: 'Pimpri Agricultural Market',
    gateNo: 'Main Intake Gate 1',
    slotDate: 'Tomorrow (15 Oct)',
    timeWindow: '08:00 – 10:00',
    queuePosition: 1,
    estimatedWaitMinutes: 0,
    status: 'booked'
  }
];

export default function FarmerTokensPage() {
  const [tokens] = useState<ArrivalToken[]>(sampleTokens);
  const [selectedToken, setSelectedToken] = useState<ArrivalToken | null>(sampleTokens[0]);

  return (
    <>
      <PageHeader
        eyebrow="DIGITAL ARRIVAL PASS"
        title="Mandi Arrival Tokens & Gate Queue"
        description="Atomic slot reservations guarantee direct weighbridge access without manual gate congestion or unorganized vehicle queues."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Active Tokens List */}
        <div className="lg:col-span-2" style={{ display: 'grid', gap: 14 }}>
          {tokens.map(tok => (
            <article
              key={tok.id}
              className="surface"
              style={{
                padding: 20,
                borderLeft: `4px solid ${tok.status === 'in_queue' ? 'var(--accent)' : 'var(--border)'}`,
                cursor: 'pointer'
              }}
              onClick={() => setSelectedToken(tok)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div className="eyebrow">{tok.mandi}</div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: '4px 0' }}>
                    {tok.crop} · {tok.variety}
                  </h3>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Quantity: <strong>{tok.quantity} {tok.unit}</strong>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span className={`badge ${tok.status === 'in_queue' ? 'badge-accent' : 'badge-neutral'}`}>
                    {tok.status === 'in_queue' ? 'In Live Queue' : 'Booked Arrival'}
                  </span>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', marginTop: 6 }}>
                    {tok.tokenCode}
                  </div>
                </div>
              </div>

              <div className="divider" style={{ margin: '14px 0' }} />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg)' }}>
                  <div className="muted" style={{ fontSize: 11 }}>Date & Time</div>
                  <strong style={{ fontSize: 12 }}>{tok.slotDate}</strong>
                  <div className="muted" style={{ fontSize: 10 }}>{tok.timeWindow}</div>
                </div>

                <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg)' }}>
                  <div className="muted" style={{ fontSize: 11 }}>Gate Intake</div>
                  <strong style={{ fontSize: 12 }}>{tok.gateNo}</strong>
                </div>

                <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg)' }}>
                  <div className="muted" style={{ fontSize: 11 }}>Queue Status</div>
                  <strong style={{ fontSize: 12, color: 'var(--accent)' }}>
                    {tok.status === 'in_queue' ? `${tok.queuePosition} Ahead` : 'Scheduled'}
                  </strong>
                </div>

                <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg)' }}>
                  <div className="muted" style={{ fontSize: 11 }}>Estimated Wait</div>
                  <strong style={{ fontSize: 12 }}>~{tok.estimatedWaitMinutes} mins</strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: 12, padding: '6px 12px' }}
                  onClick={e => {
                    e.stopPropagation();
                    setSelectedToken(tok);
                  }}
                >
                  <QrCode size={14} /> View Gate QR Barcode
                </button>
              </div>
            </article>
          ))}
        </div>

        {/* Live Token Details & Gate Dispatch Pass */}
        {selectedToken && (
          <aside className="surface" style={{ padding: 22 }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ width: 50, height: 50, borderRadius: 25, background: 'var(--accent-soft)', display: 'grid', placeItems: 'center', margin: '0 auto 10px', color: 'var(--accent)' }}>
                <TicketCheck size={26} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Mandi Gate Intake Pass</h3>
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Present this token at the APMC checkpost</p>
            </div>

            {/* Visual Token Card */}
            <div style={{ padding: 16, borderRadius: 12, background: 'var(--bg)', border: '1px dashed var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '0.08em', color: 'var(--accent)' }}>
                {selectedToken.tokenCode}
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                Lot ID: {selectedToken.lotId.slice(0, 13)}...
              </div>

              {/* Dynamic QR SVG */}
              <div style={{ margin: '16px auto', display: 'grid', placeItems: 'center' }}>
                <svg width="120" height="120" viewBox="0 0 100 100" style={{ background: '#fff', padding: 8, borderRadius: 8 }}>
                  <rect x="10" y="10" width="24" height="24" fill="#000" />
                  <rect x="14" y="14" width="16" height="16" fill="#fff" />
                  <rect x="18" y="18" width="8" height="8" fill="#000" />
                  <rect x="66" y="10" width="24" height="24" fill="#000" />
                  <rect x="70" y="14" width="16" height="16" fill="#fff" />
                  <rect x="74" y="18" width="8" height="8" fill="#000" />
                  <rect x="10" y="66" width="24" height="24" fill="#000" />
                  <rect x="14" y="70" width="16" height="16" fill="#fff" />
                  <rect x="18" y="74" width="8" height="8" fill="#000" />
                  <rect x="42" y="15" width="8" height="8" fill="#000" />
                  <rect x="45" y="35" width="14" height="10" fill="#000" />
                  <rect x="40" y="55" width="10" height="15" fill="#000" />
                  <rect x="65" y="45" width="20" height="8" fill="#000" />
                  <rect x="65" y="65" width="10" height="20" fill="#000" />
                </svg>
              </div>

              <div style={{ fontSize: 12, fontWeight: 700 }}>
                {selectedToken.mandi}
              </div>
              <div className="muted" style={{ fontSize: 11 }}>
                Arrival Window: {selectedToken.slotDate} · {selectedToken.timeWindow}
              </div>
            </div>

            <div style={{ marginTop: 18, fontSize: 12, display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="muted">Commodity</span>
                <strong>{selectedToken.crop} ({selectedToken.variety})</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="muted">Booked Load</span>
                <strong>{selectedToken.quantity} {selectedToken.unit}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="muted">Assigned Weighbridge</span>
                <strong>{selectedToken.gateNo}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="muted">Verification Protocol</span>
                <span className="badge badge-accent">SHA-256 Ledger Bound</span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 20 }}
              onClick={() => window.print()}
            >
              Print Arrival Gate Pass
            </button>
          </aside>
        )}
      </div>
    </>
  );
}
