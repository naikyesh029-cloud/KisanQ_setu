import { PageHeader } from '@/components/shared/PageHeader';
import { PhoneCall, Mail, Clock } from 'lucide-react';

export default async function HelpPage() {

  return (
    <>
      <PageHeader
        eyebrow="KISANQ SUPPORT"
        title="Help & Grievance Redressal Center"
        description="Comprehensive guides for harvest registration, weighbridge protocol, offer windows, APMC escrow settlements, and dispute escalation."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ marginBottom: 24 }}>
        <div className="surface" style={{ padding: 20 }}>
          <PhoneCall size={22} color="var(--accent)" />
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '12px 0 6px' }}>Mandi Helpline</h3>
          <p className="muted" style={{ fontSize: 13, margin: '0 0 10px' }}>
            Toll-free 24/7 assistance for farmers and buyers across all Maharashtra APMCs.
          </p>
          <strong style={{ fontSize: 16, color: 'var(--accent)' }}>1800-KISAN-Q (1800-547-267)</strong>
        </div>

        <div className="surface" style={{ padding: 20 }}>
          <Mail size={22} color="var(--accent)" />
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '12px 0 6px' }}>Arbitration Desk</h3>
          <p className="muted" style={{ fontSize: 13, margin: '0 0 10px' }}>
            Official electronic filing for weighbridge discrepancies or payment delays.
          </p>
          <strong style={{ fontSize: 14 }}>disputes@kisanq.gov.in</strong>
        </div>

        <div className="surface" style={{ padding: 20 }}>
          <Clock size={22} color="var(--accent)" />
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '12px 0 6px' }}>Gate Operating Hours</h3>
          <p className="muted" style={{ fontSize: 13, margin: '0 0 10px' }}>
            Token arrivals, weighbridge inspection, and physical lot unloading.
          </p>
          <strong style={{ fontSize: 14 }}>06:00 AM – 06:00 PM (Mon–Sat)</strong>
        </div>
      </div>

      <div className="surface" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 16px' }}>Frequently Asked Questions</h3>

        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg)' }}>
            <strong style={{ fontSize: 14, display: 'block', marginBottom: 6 }}>
              🌾 How does the farmer token and slot booking work?
            </strong>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              After registering your crop lot, choose an open mandi arrival window. The system generates an atomic arrival token (`KQ-XXXXX`). Present this token at the gate checkpost for instant intake without waiting in long unorganized queues.
            </p>
          </div>

          <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg)' }}>
            <strong style={{ fontSize: 14, display: 'block', marginBottom: 6 }}>
              ⚖️ What is the difference between AI Pre-grade and Physical Inspection?
            </strong>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              The AI photo pre-grade provides an immediate indicative estimate of quality grade and moisture. Official pricing and transaction settlements bind strictly to physical inspection and weighbridge verification conducted by certified APMC inspectors.
            </p>
          </div>

          <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg)' }}>
            <strong style={{ fontSize: 14, display: 'block', marginBottom: 6 }}>
              💼 How does APMC Tri-Party Escrow protect buyers and farmers?
            </strong>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              When an offer is accepted, buyer funds are securely deposited in the APMC escrow account. Funds are released to the farmer immediately upon weighbridge gate exit confirmation, protecting farmers from payment defaults and buyers from quantity shortfalls.
            </p>
          </div>

          <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg)' }}>
            <strong style={{ fontSize: 14, display: 'block', marginBottom: 6 }}>
              ⛓️ How does the Blockchain Ledger guarantee immutability?
            </strong>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              Every lot registration, physical weighbridge entry, buyer bid, and dispute resolution is recorded with a SHA-256 cryptographic hash chained to the previous event. Any post-facto modification in the database is automatically flagged by supervisory audit verification.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
