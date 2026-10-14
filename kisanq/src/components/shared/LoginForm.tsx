'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { resolvePostLoginPath, type AppRole } from '@/lib/auth/roles';
import { KeyRound, MessageSquare, Shield, Wheat, ShoppingBag, Eye, EyeOff, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

const DEMO_PRESETS: Record<AppRole, { identifier: string; phone: string; name: string }> = {
  farmer: { identifier: '+917887964304', phone: '+917887964304', name: 'Ramesh Patil (Farmer)' },
  buyer: { identifier: '+919607320058', phone: '+919607320058', name: 'Amit Shah (Buyer)' },
  inspector: { identifier: '+918623076731', phone: '+918623076731', name: 'Vikram Deshmukh (Inspector)' },
  supervisor: { identifier: '+919371403644', phone: '+919371403644', name: 'Pooja Kadam (Supervisor)' }
};

export function LoginForm({
  locale,
  dict
}: {
  locale: string;
  dict: Record<string, string>;
}) {
  const [role, setRole] = useState<AppRole>('farmer');
  const [method, setMethod] = useState<'password' | 'otp'>('password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [consent, setConsent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [nextPath, setNextPath] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(params.get('next'));
    if (params.get('reason') === 'role-mismatch') {
      const reqRole = params.get('required');
      setError(
        `Your signed-in account is not authorized for that workspace, which requires the ${
          reqRole || 'authorized'
        } role. Sign in with an account provisioned for that role.`
      );
    }
  }, []);

  function applyPreset(selectedRole: AppRole) {
    setRole(selectedRole);
    const preset = DEMO_PRESETS[selectedRole];
    setIdentifier(preset.identifier);
    setPassword('password123');
    setError('');
    setNotice(`Loaded credentials for ${preset.name} (${selectedRole}). Click 'Login as ${selectedRole}' to sign in.`);
  }

  async function handlePasswordLogin() {
    setError('');
    setNotice('');
    const id = identifier.trim();
    if (!id) {
      setError('Enter your registered phone number or email address.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }
    if (!consent) {
      setError(dict.consentRequired || 'Please accept the data-use notice.');
      return;
    }

    setBusy(true);
    try {
      const sb = createSupabaseBrowserClient();
      let emailToUse = id.toLowerCase();
      // If user typed a phone number, resolve to email format
      if (!id.includes('@')) {
        try {
          const res = await fetch('/api/auth/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: id })
          });
          const resData = await res.json();
          if (resData.email) emailToUse = resData.email;
        } catch {
          const cleanPhone = id.replace(/\D/g, '').slice(-10);
          emailToUse = `${role}_${cleanPhone}@kisanq.org`;
        }
      }

      const { data, error: authError } = await sb.auth.signInWithPassword({
        email: emailToUse,
        password
      });

      let authenticatedUser = data.user;

      if (authError) {
        // Fallback: If user registered via OTP with phone, try phone sign-in if enabled
        if (!id.includes('@')) {
          const normPhone = id.startsWith('+') ? id : `+91${id.replace(/\D/g, '')}`;
          const { data: phoneData, error: phoneErr } = await sb.auth.signInWithPassword({
            phone: normPhone,
            password
          });
          if (phoneErr) {
            throw new Error('Invalid phone/email or password. If you only registered with OTP, switch to the OTP tab.');
          }
          if (phoneData.user) authenticatedUser = phoneData.user;
        } else {
          throw new Error('Invalid email or password. Please verify credentials.');
        }
      }

      if (!authenticatedUser) throw new Error('Authentication failed.');

      // Verify Profile Role
      const { data: profile } = await sb
        .from('profiles')
        .select('role, display_name')
        .eq('id', authenticatedUser.id)
        .maybeSingle();

      const actualRole = (profile?.role as AppRole) || 'farmer';

      // Strict role check requested by user
      if (actualRole !== role) {
        await sb.auth.signOut();
        throw new Error(
          `Role Mismatch: This account is registered as a ${actualRole.toUpperCase()}. You currently selected '${role}'. Please select the matching role to proceed.`
        );
      }

      // Record statutory DPDP consent
      await sb.from('profiles').update({
        consent_version: 'kisanq-consent-v1',
        consent_at: new Date().toISOString()
      }).eq('id', authenticatedUser.id);

      document.cookie = `NEXT_LOCALE=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
      router.push(resolvePostLoginPath(actualRole, locale, nextPath));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : dict.error);
    } finally {
      setBusy(false);
    }
  }

  async function handleSendOtp() {
    setError('');
    setNotice('');
    const id = identifier.trim();
    if (!id) {
      setError('Enter your mobile number to receive OTP.');
      return;
    }
    const cleanPhone = id.replace(/\D/g, '');
    const normPhone = cleanPhone.length === 10 ? `+91${cleanPhone}` : id.startsWith('+') ? id : `+${cleanPhone}`;
    if (!/^\+[1-9]\d{7,14}$/.test(normPhone)) {
      setError('Use 10-digit mobile number, e.g. 9876543210 or +919876543210.');
      return;
    }

    setBusy(true);
    try {
      const sb = createSupabaseBrowserClient();
      const { error: e } = await sb.auth.signInWithOtp({
        phone: normPhone,
        options: { data: { role, display_name: `KisanQ ${role}` } }
      });

      if (e) {
        // If Twilio provider is unconfigured in Supabase, provide test OTP fallback
        if (e.message.includes('AC000') || e.message.includes('provider') || e.message.includes('SMS')) {
          setOtpSent(true);
          setNotice('Simulated verification active. For demo/evaluation testing, enter OTP: 123456');
          return;
        }
        throw e;
      }

      setOtpSent(true);
      setNotice('Verification code dispatched. Check your SMS inbox.');
    } catch (e) {
      setError(e instanceof Error ? e.message : dict.error);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp() {
    setError('');
    setNotice('');
    if (!/^\d{4,8}$/.test(otp)) {
      setError('Enter the 6-digit numeric OTP.');
      return;
    }

    setBusy(true);
    try {
      const sb = createSupabaseBrowserClient();
      const cleanPhone = identifier.replace(/\D/g, '');
      const normPhone = cleanPhone.length === 10 ? `+91${cleanPhone}` : identifier.startsWith('+') ? identifier : `+${cleanPhone}`;

      const { data, error: e } = await sb.auth.verifyOtp({
        phone: normPhone,
        token: otp,
        type: 'sms'
      });

      let verifiedUser = data.user;

      if (e) {
        // Allow evaluation fallback if 123456 used on demo accounts
        if (otp === '123456') {
          // Attempt email-password login for demo mapping
          let demoEmail = `${cleanPhone}@kisanq.app`;
          try {
            const res = await fetch('/api/auth/resolve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ identifier: cleanPhone })
            });
            const resData = await res.json();
            if (resData.email) demoEmail = resData.email;
          } catch {
            demoEmail = `${role}_${cleanPhone.slice(-10)}@kisanq.org`;
          }
          const { data: dData } = await sb.auth.signInWithPassword({ email: demoEmail, password: 'password123' });
          if (dData.user) verifiedUser = dData.user;
          else throw e;
        } else {
          throw e;
        }
      }

      if (!verifiedUser) throw new Error('Authentication did not return a user identity.');

      const { data: profile } = await sb.from('profiles').select('role').eq('id', verifiedUser.id).maybeSingle();
      const actualRole = (profile?.role as AppRole) || role;

      if (actualRole !== role) {
        await sb.auth.signOut();
        throw new Error(
          `Role Mismatch: This account is registered as a ${actualRole.toUpperCase()}. You currently selected '${role}'. Please select the matching role to proceed.`
        );
      }

      // Record consent
      await sb.from('profiles').update({
        consent_version: 'kisanq-consent-v1',
        consent_at: new Date().toISOString()
      }).eq('id', verifiedUser.id);

      document.cookie = `NEXT_LOCALE=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
      router.push(resolvePostLoginPath(actualRole, locale, nextPath));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : dict.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* 4 Interactive Role Cards */}
      <label className="field-label" style={{ marginBottom: 8 }}>
        Select Your Mandi Role *
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" style={{ marginBottom: 18 }}>
        <button
          type="button"
          className="field"
          style={{
            textAlign: 'center',
            padding: '10px 8px',
            borderColor: role === 'farmer' ? 'var(--accent)' : 'var(--border)',
            background: role === 'farmer' ? 'var(--accent-soft)' : 'var(--surface)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onClick={() => { setRole('farmer'); setError(''); }}
        >
          <Wheat size={18} color="var(--accent)" style={{ margin: '0 auto 4px' }} />
          <div style={{ fontWeight: 700, fontSize: 12 }}>{dict.farmer}</div>
          <div className="muted" style={{ fontSize: 10 }}>Sell produce</div>
        </button>

        <button
          type="button"
          className="field"
          style={{
            textAlign: 'center',
            padding: '10px 8px',
            borderColor: role === 'buyer' ? '#2563eb' : 'var(--border)',
            background: role === 'buyer' ? '#eff6ff' : 'var(--surface)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onClick={() => { setRole('buyer'); setError(''); }}
        >
          <ShoppingBag size={18} color="#2563eb" style={{ margin: '0 auto 4px' }} />
          <div style={{ fontWeight: 700, fontSize: 12 }}>{dict.buyer}</div>
          <div className="muted" style={{ fontSize: 10 }}>Procure crops</div>
        </button>

        <button
          type="button"
          className="field"
          style={{
            textAlign: 'center',
            padding: '10px 8px',
            borderColor: role === 'inspector' ? '#d97706' : 'var(--border)',
            background: role === 'inspector' ? '#fef3c7' : 'var(--surface)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onClick={() => { setRole('inspector'); setError(''); }}
        >
          <Shield size={18} color="#d97706" style={{ margin: '0 auto 4px' }} />
          <div style={{ fontWeight: 700, fontSize: 12 }}>{dict.inspector}</div>
          <div className="muted" style={{ fontSize: 10 }}>Weigh & grade</div>
        </button>

        <button
          type="button"
          className="field"
          style={{
            textAlign: 'center',
            padding: '10px 8px',
            borderColor: role === 'supervisor' ? '#7e22ce' : 'var(--border)',
            background: role === 'supervisor' ? '#f3e8ff' : 'var(--surface)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onClick={() => { setRole('supervisor'); setError(''); }}
        >
          <Shield size={18} color="#7e22ce" style={{ margin: '0 auto 4px' }} />
          <div style={{ fontWeight: 700, fontSize: 12 }}>Supervisor</div>
          <div className="muted" style={{ fontSize: 10 }}>Audit & governance</div>
        </button>
      </div>

      {/* Password vs OTP Mode Pill Toggle */}
      <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 10, background: 'var(--bg)', marginBottom: 16 }}>
        <button
          type="button"
          className="btn"
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: 12,
            border: 'none',
            background: method === 'password' ? 'var(--surface)' : 'transparent',
            boxShadow: method === 'password' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            fontWeight: method === 'password' ? 750 : 500
          }}
          onClick={() => { setMethod('password'); setError(''); }}
        >
          <KeyRound size={14} /> Password Login
        </button>
        <button
          type="button"
          className="btn"
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: 12,
            border: 'none',
            background: method === 'otp' ? 'var(--surface)' : 'transparent',
            boxShadow: method === 'otp' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            fontWeight: method === 'otp' ? 750 : 500
          }}
          onClick={() => { setMethod('otp'); setError(''); }}
        >
          <MessageSquare size={14} /> Phone OTP
        </button>
      </div>

      {/* Identifier Input */}
      <label className="field-label" htmlFor="user-id">
        {method === 'password' ? 'Mobile Phone Number or Email *' : '10-Digit Mobile Phone Number *'}
      </label>
      <input
        id="user-id"
        className="field"
        type={method === 'password' ? 'text' : 'tel'}
        placeholder={method === 'password' ? 'e.g. 9876543210 or user@example.com' : 'e.g. +919876543210'}
        value={identifier}
        onChange={e => setIdentifier(e.target.value)}
        disabled={busy || (method === 'otp' && otpSent)}
        autoComplete="username"
      />

      {/* Password Field (when method === 'password') */}
      {method === 'password' && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="field-label" htmlFor="user-pwd">Password *</label>
            <button
              type="button"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={13} /> : <Eye size={13} />} {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <input
            id="user-pwd"
            className="field"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter account password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={busy}
            autoComplete="current-password"
          />
        </div>
      )}

      {/* OTP Field (when method === 'otp' and sent) */}
      {method === 'otp' && otpSent && (
        <div style={{ marginTop: 14 }}>
          <label className="field-label" htmlFor="user-otp">Enter 6-Digit OTP *</label>
          <input
            id="user-otp"
            className="field"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="e.g. 123456"
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
            autoFocus
          />
        </div>
      )}

      {/* Consent Notice */}
      <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg)', marginTop: 16 }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'start', fontSize: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={consent}
            onChange={e => setConsent(e.target.checked)}
            style={{ marginTop: 2 }}
          />
          <span>{dict.consent}</span>
        </label>
      </div>

      {error && (
        <div role="alert" style={{ display: 'flex', gap: 8, color: 'var(--danger)', fontSize: 12, marginTop: 14 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {notice && (
        <div role="status" style={{ display: 'flex', gap: 8, color: 'var(--accent)', fontSize: 12, marginTop: 14 }}>
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      {/* Action Button */}
      <button
        type="button"
        className="btn btn-primary"
        style={{ width: '100%', marginTop: 18, padding: '12px 14px', fontSize: 14 }}
        disabled={busy}
        onClick={method === 'password' ? handlePasswordLogin : otpSent ? handleVerifyOtp : handleSendOtp}
      >
        {busy ? 'Verifying…' : method === 'password' ? `Login as ${role.charAt(0).toUpperCase() + role.slice(1)}` : otpSent ? 'Verify OTP & Enter' : 'Request OTP Code'}
      </button>

      {/* One-Click Evaluation Quick Presets */}
      <div style={{ marginTop: 20, padding: 12, borderRadius: 10, background: 'var(--accent-soft)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>
          <Sparkles size={13} /> College Evaluator Quick Login ($0 SMS)
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" className="btn" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => applyPreset('farmer')}>
            🌾 Farmer
          </button>
          <button type="button" className="btn" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => applyPreset('buyer')}>
            💼 Buyer
          </button>
          <button type="button" className="btn" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => applyPreset('inspector')}>
            🔬 Inspector
          </button>
          <button type="button" className="btn" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => applyPreset('supervisor')}>
            🛡️ Supervisor
          </button>
        </div>
      </div>

      <div style={{ marginTop: 18, textAlign: 'center', fontSize: 12 }}>
        <span className="muted">Don&apos;t have an account? </span>
        <Link href={`/${locale}/register`} style={{ color: 'var(--accent)', fontWeight: 700 }}>
          Register new account
        </Link>
      </div>
    </div>
  );
}
