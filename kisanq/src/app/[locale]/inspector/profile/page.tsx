'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Shield, Award, MapPin, Phone, Mail } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function InspectorProfilePage() {
  const [profile, setProfile] = useState({
    name: 'Vikram Deshmukh',
    badgeId: 'INSP-MH-PUN-084',
    designation: 'Senior Mandi Quality Inspector & Weighbridge Officer',
    phone: '+918623076731',
    email: 'v.deshmukh@msamb.gov.in',
    assignedMandi: 'Pune Market Yard (Gultekdi)',
    jurisdictionScope: ['Pune Market Yard (Gultekdi)', 'Pimpri Agricultural Market'],
    inspectionsCompleted: 342,
    overrideRatePct: 4.8,
    activeSince: 'August 2023'
  });

  useEffect(() => {
    const sb = createSupabaseBrowserClient();
    sb.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        sb.from('profiles').select('display_name, phone').eq('id', user.id).single().then(({ data }) => {
          if (data) {
            setProfile(prev => ({
              ...prev,
              name: data.display_name || prev.name,
              phone: data.phone || user.phone || prev.phone,
              email: user.email || prev.email
            }));
          }
        });
      }
    });
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="APMC INSPECTOR DESK"
        title="Inspector Credentials & Mandi Jurisdiction"
        description="Official MSAMB government accreditation, active gate weighbridge assignment, and operational inspection credentials."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Badge Card */}
        <div className="surface" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#fef3c7', color: '#b45309', display: 'grid', placeItems: 'center', margin: '0 auto 14px', fontSize: 26, fontWeight: 800 }}>
            VD
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>{profile.name}</h2>
          <div className="muted" style={{ fontSize: 12 }}>{profile.designation}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontSize: 11, fontWeight: 700, marginTop: 12 }}>
            <Shield size={13} /> {profile.badgeId}
          </div>

          <div className="divider" style={{ margin: '18px 0' }} />

          <div style={{ textAlign: 'left', fontSize: 12, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Phone size={14} className="muted" /> <strong>{profile.phone}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Mail size={14} className="muted" /> <span>{profile.email}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={14} className="muted" /> <span>{profile.assignedMandi}</span>
            </div>
          </div>
        </div>

        {/* Operating Scope & Stats */}
        <div className="surface lg:col-span-2" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Award size={18} color="var(--accent)" /> Inspection Jurisdiction & Authority Metrics
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ fontSize: 13 }}>
            <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg)' }}>
              <div className="muted" style={{ fontSize: 11 }}>Accredited Mandi Assignment</div>
              <strong style={{ fontSize: 14 }}>{profile.assignedMandi}</strong>
              <p className="muted" style={{ fontSize: 11, margin: '4px 0 0' }}>Primary Weighbridge Gate 2 & QC Lab</p>
            </div>

            <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg)' }}>
              <div className="muted" style={{ fontSize: 11 }}>Official Badge ID</div>
              <strong style={{ fontSize: 14 }}>{profile.badgeId}</strong>
              <p className="muted" style={{ fontSize: 11, margin: '4px 0 0' }}>Maharashtra State APMC Board</p>
            </div>

            <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg)' }}>
              <div className="muted" style={{ fontSize: 11 }}>Inspections Certified</div>
              <strong style={{ fontSize: 18 }}>{profile.inspectionsCompleted} Lots</strong>
              <p className="muted" style={{ fontSize: 11, margin: '4px 0 0' }}>Cryptographically signed onto SHA-256 ledger</p>
            </div>

            <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg)' }}>
              <div className="muted" style={{ fontSize: 11 }}>Grade Override Audit Ratio</div>
              <strong style={{ fontSize: 18, color: 'var(--accent)' }}>{profile.overrideRatePct}%</strong>
              <p className="muted" style={{ fontSize: 11, margin: '4px 0 0' }}>Well within normal APMC variance tolerance</p>
            </div>

            <div className="sm:col-span-2" style={{ padding: 14, borderRadius: 10, background: 'var(--bg)' }}>
              <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>Supervised APMC Jurisdiction Scope</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {profile.jurisdictionScope.map(m => (
                  <span key={m} className="badge">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
