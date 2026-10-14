import { PageHeader } from '@/components/shared/PageHeader';
import { RegisterForm } from '@/components/shared/RegisterForm';
import Link from 'next/link';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { ShieldCheck, Scale, Lock } from 'lucide-react';

export default async function RegisterPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const d = getDictionary(locale);

  return (
    <>
      <PageHeader
        eyebrow="ONBOARDING"
        title="Create Mandi Account"
        description="Register as a verified Farmer or Buyer to access competitive bidding, AI quality estimates, and digital mandi arrival tokens."
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5" style={{ marginTop: 20 }}>
        <div className="surface lg:col-span-3" style={{ padding: 24 }}>
          <RegisterForm locale={locale} dict={d} />
        </div>

        <div className="surface lg:col-span-2" style={{ padding: 24, background: 'var(--accent-soft)', boxShadow: 'none' }}>
          <h2 className="section-title" style={{ fontSize: 18, marginBottom: 14 }}>
            Digital Mandi Standards
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'start' }}>
              <ShieldCheck size={18} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ fontSize: 13, display: 'block' }}>DPDP Act 2023 Compliance</strong>
                <p className="muted" style={{ fontSize: 12, margin: '2px 0 0', lineHeight: 1.5 }}>
                  Your phone number and harvest data are strictly collected for coordinating mandi transactions, buyer bidding, and token arrival scheduling.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'start' }}>
              <Scale size={18} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ fontSize: 13, display: 'block' }}>Fair Market Protection</strong>
                <p className="muted" style={{ fontSize: 12, margin: '2px 0 0', lineHeight: 1.5 }}>
                  Every lot has a transparent offer window. Farmers receive competitive bids from verified traders and decide whether to accept.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'start' }}>
              <Lock size={18} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ fontSize: 13, display: 'block' }}>Regulatory Role Boundaries</strong>
                <p className="muted" style={{ fontSize: 12, margin: '2px 0 0', lineHeight: 1.5 }}>
                  Only authorized APMC mandi officers can execute weighbridge inspections or audit events. Role integrity is cryptographically enforced at the database layer.
                </p>
              </div>
            </div>
          </div>

          <div className="divider" style={{ margin: '20px 0' }} />

          <div style={{ fontSize: 12 }}>
            <span className="muted">Have questions about the workflow? </span>
            <Link href={`/${locale}/ivr-demo`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
              Try the IVR Voice/SMS Simulation
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
