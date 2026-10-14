'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { ShieldCheck, Building2, Phone, Mail, Award, CheckCircle2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function BuyerProfilePage() {
  const [profile, setProfile] = useState({
    name: 'Sahyadri Agro Traders Pvt Ltd',
    contactPerson: 'Amit Shah',
    phone: '+919607320058',
    email: 'amit.shah@sahyadriagro.in',
    licenseNo: 'APMC-MH-PUN-2024-T901',
    gstin: '27AABCS1429B1Z8',
    mandisRegistered: ['Pune Market Yard (APMC)', 'Pimpri Agricultural Market', 'Nashik APMC'],
    verifiedStatus: true,
    totalProcuredQuintals: 1840,
    activeAgreements: 3
  });
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

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

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  }

  return (
    <>
      <PageHeader
        eyebrow="APMC BUYER DESK"
        title="Buyer & Institutional Trader Profile"
        description="Verified APMC trader credentials and institutional procurement parameters for instant escrow clearance across participating mandis."
      />

      {saved && (
        <div role="status" style={{ display: 'flex', gap: 8, color: 'var(--accent)', fontSize: 13, padding: 12, borderRadius: 10, background: 'var(--accent-soft)', marginBottom: 18 }}>
          <CheckCircle2 size={16} /> Buyer profile credentials updated successfully.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Profile Card */}
        <div className="surface" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center', margin: '0 auto 14px', fontSize: 26, fontWeight: 800 }}>
            AS
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>{profile.name}</h2>
          <div className="muted" style={{ fontSize: 12 }}>Authorized Representative: {profile.contactPerson}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontSize: 11, fontWeight: 700, marginTop: 12 }}>
            <ShieldCheck size={13} /> APMC Verified Trader
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
              <Building2 size={14} className="muted" /> <span>License: {profile.licenseNo}</span>
            </div>
          </div>
        </div>

        {/* Verification & License Details */}
        <div className="surface lg:col-span-2" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Award size={18} color="var(--accent)" /> Statutory Registration & Mandi Jurisdictions
            </h3>
            <button className="btn" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setEditing(!editing)}>
              {editing ? 'Cancel' : 'Edit Details'}
            </button>
          </div>

          {editing ? (
            <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="field-label">Trading Entity Name</label>
                <input
                  className="field"
                  value={profile.name}
                  onChange={e => setProfile({ ...profile, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="field-label">Authorized Contact Person</label>
                <input
                  className="field"
                  value={profile.contactPerson}
                  onChange={e => setProfile({ ...profile, contactPerson: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="field-label">Phone Number</label>
                <input
                  className="field"
                  value={profile.phone}
                  onChange={e => setProfile({ ...profile, phone: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="field-label">GSTIN Identification</label>
                <input
                  className="field"
                  value={profile.gstin}
                  onChange={e => setProfile({ ...profile, gstin: e.target.value })}
                  required
                />
              </div>
              <div className="sm:col-span-2" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ fontSize: 13 }}>
              <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg)' }}>
                <div className="muted" style={{ fontSize: 11 }}>APMC Trader License</div>
                <strong style={{ fontSize: 14 }}>{profile.licenseNo}</strong>
                <p className="muted" style={{ fontSize: 11, margin: '4px 0 0' }}>Valid through 31 March 2027</p>
              </div>

              <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg)' }}>
                <div className="muted" style={{ fontSize: 11 }}>GSTIN Number</div>
                <strong style={{ fontSize: 14 }}>{profile.gstin}</strong>
                <p className="muted" style={{ fontSize: 11, margin: '4px 0 0' }}>E-way bill certified for interstate transit</p>
              </div>

              <div className="sm:col-span-2" style={{ padding: 14, borderRadius: 10, background: 'var(--bg)' }}>
                <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>Registered Mandi Yards</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {profile.mandisRegistered.map(m => (
                    <span key={m} className="badge">
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg)' }}>
                <div className="muted" style={{ fontSize: 11 }}>Total Sourced Volume</div>
                <strong style={{ fontSize: 18 }}>{profile.totalProcuredQuintals.toLocaleString()} Qtl</strong>
                <p className="muted" style={{ fontSize: 11, margin: '4px 0 0' }}>~184 Metric Tonnes</p>
              </div>

              <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg)' }}>
                <div className="muted" style={{ fontSize: 11 }}>Settlement Track Record</div>
                <strong style={{ fontSize: 18, color: 'var(--accent)' }}>100% On-Time Escrow</strong>
                <p className="muted" style={{ fontSize: 11, margin: '4px 0 0' }}>Zero delayed gate payments</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
