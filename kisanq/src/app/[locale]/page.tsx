import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDictionary, type Locale } from '@/lib/i18n/dictionaries';
import {
  Boxes,
  Plus,
  ShoppingBasket,
  WalletCards,
  LayoutDashboard,
  ClipboardList,
  ClipboardCheck,
  ShieldCheck,
  BarChart3,
  Sparkles,
  LogIn,
  UserPlus
} from 'lucide-react';

export default async function LocaleHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!['en', 'hi', 'mr'].includes(locale)) {
    redirect('/en');
  }

  const dict = getDictionary(locale as Locale);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 8px 48px' }}>
      {/* Hero Section */}
      <section className="surface" style={{ padding: '36px 32px', marginBottom: 28, position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 20, background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 12, fontWeight: 700, marginBottom: 16 }}>
          <Sparkles size={14} />
          Digital Mandi Intelligence & Traceability
        </div>
        <h1 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 800, lineHeight: 1.2, margin: '0 0 14px' }}>
          Fair markets. Faster decisions.
        </h1>
        <p className="muted" style={{ fontSize: 16, maxWidth: 680, lineHeight: 1.6, margin: '0 0 24px' }}>
          {dict.heroSub}
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link href={`/${locale}/login`} className="btn btn-primary" style={{ padding: '10px 20px', fontSize: 14 }}>
            <LogIn size={16} />
            {dict.login}
          </Link>
          <Link href={`/${locale}/register`} className="btn" style={{ padding: '10px 20px', fontSize: 14 }}>
            <UserPlus size={16} />
            {dict.register}
          </Link>
          <Link href={`/${locale}/market-prices`} className="btn" style={{ padding: '10px 18px', fontSize: 14 }}>
            <BarChart3 size={16} />
            {dict.market}
          </Link>
          <Link href={`/${locale}/farmer/analyzer`} className="btn" style={{ padding: '10px 18px', fontSize: 14, background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <Sparkles size={16} />
            {dict.aiAnalyzer}
          </Link>
        </div>
      </section>

      {/* 4 Role Pathways */}
      <h2 className="section-title" style={{ fontSize: 20, marginBottom: 14 }}>
        {dict.operationalGateways}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginBottom: 32 }}>
        {/* Farmer Gateway */}
        <div className="surface" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span className="badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                🌾 {dict.farmer}
              </span>
              <span className="muted" style={{ fontSize: 11 }}>{dict.farmer}</span>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>{dict.farmerPortalTitle}</h3>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, margin: '0 0 16px' }}>
              {dict.farmerPortalDesc}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href={`/${locale}/farmer/lots`} className="btn btn-primary" style={{ fontSize: 12, padding: '7px 12px' }}>
              <Boxes size={14} />
              {dict.myLots}
            </Link>
            <Link href={`/${locale}/farmer/lots/new`} className="btn" style={{ fontSize: 12, padding: '7px 12px' }}>
              <Plus size={14} />
              {dict.addCrop}
            </Link>
            <Link href={`/${locale}/farmer/analyzer`} className="btn" style={{ fontSize: 12, padding: '7px 12px' }}>
              <Sparkles size={14} />
              {dict.aiAnalyzer}
            </Link>
          </div>
        </div>

        {/* Buyer Gateway */}
        <div className="surface" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                💼 {dict.buyer}
              </span>
              <span className="muted" style={{ fontSize: 11 }}>{dict.buyer}</span>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>{dict.buyerMarketplaceTitle}</h3>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, margin: '0 0 16px' }}>
              {dict.buyerMarketplaceDesc}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href={`/${locale}/buyer/marketplace`} className="btn btn-primary" style={{ fontSize: 12, padding: '7px 12px' }}>
              <ShoppingBasket size={14} />
              {dict.marketplace}
            </Link>
            <Link href={`/${locale}/buyer/offers`} className="btn" style={{ fontSize: 12, padding: '7px 12px' }}>
              <WalletCards size={14} />
              {dict.myOffers}
            </Link>
          </div>
        </div>

        {/* Inspector Gateway */}
        <div className="surface" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span className="badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                🔬 {dict.inspector}
              </span>
              <span className="muted" style={{ fontSize: 11 }}>{dict.inspector}</span>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>{dict.inspectorOpsTitle}</h3>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, margin: '0 0 16px' }}>
              {dict.inspectorOpsDesc}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href={`/${locale}/inspector/dashboard`} className="btn btn-primary" style={{ fontSize: 12, padding: '7px 12px' }}>
              <LayoutDashboard size={14} />
              {dict.operations}
            </Link>
            <Link href={`/${locale}/inspector/inspections`} className="btn" style={{ fontSize: 12, padding: '7px 12px' }}>
              <ClipboardList size={14} />
              {dict.inspections}
            </Link>
            <Link href={`/${locale}/inspector/disputes`} className="btn" style={{ fontSize: 12, padding: '7px 12px' }}>
              {dict.disputes}
            </Link>
          </div>
        </div>

        {/* Supervisor Gateway */}
        <div className="surface" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span className="badge" style={{ background: '#f3e8ff', color: '#7e22ce', border: '1px solid #e9d5ff' }}>
                🛡️ {dict.supervisor}
              </span>
              <span className="muted" style={{ fontSize: 11 }}>{dict.supervisor}</span>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>{dict.supervisorAuditTitle}</h3>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, margin: '0 0 16px' }}>
              {dict.supervisorAuditDesc}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href={`/${locale}/inspector/supervisor-audit`} className="btn btn-primary" style={{ fontSize: 12, padding: '7px 12px' }}>
              <ClipboardCheck size={14} />
              {dict.supervisorAudit}
            </Link>
            <Link href={`/${locale}/inspector/ledger`} className="btn" style={{ fontSize: 12, padding: '7px 12px' }}>
              <ShieldCheck size={14} />
              {dict.ledger}
            </Link>
          </div>
        </div>
      </div>

      {/* Security & Architecture Highlights */}
      <div className="surface" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={18} color="var(--accent)" />
          {dict.trustHighlightsTitle}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" style={{ fontSize: 12 }}>
          <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg)' }}>
            <strong style={{ display: 'block', marginBottom: 4 }}>🔒 {dict.accessControlTitle}</strong>
            <span className="muted">
              {dict.accessControlDesc}
            </span>
          </div>
          <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg)' }}>
            <strong style={{ display: 'block', marginBottom: 4 }}>⛓️ {dict.ledgerTitle}</strong>
            <span className="muted">
              {dict.ledgerDesc}
            </span>
          </div>
          <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg)' }}>
            <strong style={{ display: 'block', marginBottom: 4 }}>⚖️ {dict.weighbridgeTitle}</strong>
            <span className="muted">
              {dict.weighbridgeDesc}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}