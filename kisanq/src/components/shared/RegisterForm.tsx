'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { roleHome, type AppRole } from '@/lib/auth/roles';
import { Wheat, ShoppingBag, Eye, EyeOff, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';

export function RegisterForm({
  locale,
  dict
}: {
  locale: string;
  dict: Record<string, string>;
}) {
  const [phone, setPhone] = useState('+91');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'farmer' | 'buyer'>('farmer');
  const [languagePref, setLanguagePref] = useState(locale || 'en');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const router = useRouter();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');

    if (!displayName.trim()) {
      setError('Please enter your full name or farm enterprise name.');
      return;
    }

    if (!phone || phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit mobile number with +91 country code.');
      return;
    }

    if (!password || password.length < 6) {
      setError('Please enter a secure password (minimum 6 characters).');
      return;
    }

    if (!consent) {
      setError(dict.consentRequired || 'Please accept the statutory data-use and DPDP notice.');
      return;
    }

    setBusy(true);
    try {
      // 1. Server-side registration API (bypasses GoTrue email validation & IP rate limits)
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim(),
          phone,
          email: email.trim(),
          password,
          role,
          languagePref
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Registration failed. Please check inputs and retry.');
      }

      // 2. Client-side sign-in to establish browser session cookies
      const sb = createSupabaseBrowserClient();
      const { error: signInError } = await sb.auth.signInWithPassword({
        email: resData.email,
        password
      });

      if (signInError) {
        throw new Error('Account created successfully, but auto-login encountered an error. Please switch to the Sign In page.');
      }

      setNotice('Account registered successfully! Redirecting to your workspace…');
      document.cookie = `NEXT_LOCALE=${languagePref}; Path=/; Max-Age=31536000; SameSite=Lax`;

      setTimeout(() => {
        router.push(roleHome(role as AppRole, languagePref));
        router.refresh();
      }, 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : dict.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleRegister}>
      {/* Account Type Selector */}
      <label className="field-label" style={{ marginBottom: 8 }}>
        Select Account Category *
      </label>
      <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 18 }}>
        <button
          type="button"
          className="field"
          style={{
            textAlign: 'left',
            padding: '12px 14px',
            borderColor: role === 'farmer' ? 'var(--accent)' : 'var(--border)',
            background: role === 'farmer' ? 'var(--accent-soft)' : 'var(--surface)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onClick={() => setRole('farmer')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: role === 'farmer' ? 'var(--accent)' : 'inherit' }}>
            <Wheat size={16} /> 🌾 {dict.farmer}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            Register harvest lots, book tokens, and sell at mandis
          </div>
        </button>

        <button
          type="button"
          className="field"
          style={{
            textAlign: 'left',
            padding: '12px 14px',
            borderColor: role === 'buyer' ? '#2563eb' : 'var(--border)',
            background: role === 'buyer' ? '#eff6ff' : 'var(--surface)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onClick={() => setRole('buyer')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: role === 'buyer' ? '#2563eb' : 'inherit' }}>
            <ShoppingBag size={16} /> 💼 {dict.buyer}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            Place verified offers, deposit escrow, and dispatch pickups
          </div>
        </button>
      </div>

      {/* Full Name */}
      <div style={{ marginBottom: 14 }}>
        <label className="field-label" htmlFor="reg-name">
          Full Name / Enterprise Name *
        </label>
        <input
          id="reg-name"
          className="field"
          type="text"
          placeholder="e.g. Sujay Patil"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          required
        />
      </div>

      {/* Phone Number */}
      <div style={{ marginBottom: 14 }}>
        <label className="field-label" htmlFor="reg-phone">
          Mobile Phone Number (with +91 country code) *
        </label>
        <input
          id="reg-phone"
          className="field"
          type="tel"
          placeholder="+918080097447"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          required
        />
      </div>

      {/* Email Address (Optional, used for password login) */}
      <div style={{ marginBottom: 14 }}>
        <label className="field-label" htmlFor="reg-email">
          Email Address (Optional)
        </label>
        <input
          id="reg-email"
          className="field"
          type="email"
          placeholder="e.g. sujay@example.com (or leave blank to use phone login)"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
      </div>

      {/* Password */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label className="field-label" htmlFor="reg-password">
            Account Password * (min 6 characters)
          </label>
          <button
            type="button"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={13} /> : <Eye size={13} />} {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        <input
          id="reg-password"
          className="field"
          type={showPassword ? 'text' : 'password'}
          placeholder="Enter a secure password for instant sign-in"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={6}
        />
      </div>

      {/* Preferred Language */}
      <div style={{ marginBottom: 16 }}>
        <label className="field-label" htmlFor="reg-lang">
          Preferred Language
        </label>
        <select
          id="reg-lang"
          className="field"
          value={languagePref}
          onChange={e => setLanguagePref(e.target.value)}
        >
          <option value="en">English</option>
          <option value="hi">हिंदी (Hindi)</option>
          <option value="mr">मराठी (Marathi)</option>
        </select>
      </div>

      {/* Privacy Notice */}
      <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
          <ShieldCheck size={14} color="var(--accent)" /> DPDP Statutory Notice
        </div>
        <p className="muted" style={{ fontSize: 11, margin: '0 0 10px' }}>
          {dict.privacy || 'Your information is used to coordinate mandi crop registration, offers and operations. Avoid entering unnecessary sensitive information.'}
        </p>
        <label style={{ display: 'flex', gap: 8, alignItems: 'start', fontSize: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={consent}
            onChange={e => setConsent(e.target.checked)}
            style={{ marginTop: 2 }}
            required
          />
          <span>{dict.consent || 'I have read and agree to the data-use notice.'}</span>
        </label>
      </div>

      {error && (
        <div role="alert" style={{ display: 'flex', gap: 8, color: 'var(--danger)', fontSize: 12, marginBottom: 14 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {notice && (
        <div role="status" style={{ display: 'flex', gap: 8, color: 'var(--accent)', fontSize: 12, marginBottom: 14 }}>
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary"
        style={{ width: '100%', padding: '12px 14px', fontSize: 14 }}
        disabled={busy}
      >
        {busy ? 'Registering Account…' : `Register as ${role === 'farmer' ? 'Farmer' : 'Buyer'}`}
      </button>

      <div style={{ marginTop: 18, textAlign: 'center', fontSize: 12 }}>
        <span className="muted">Already registered? </span>
        <Link href={`/${locale}/login`} style={{ color: 'var(--accent)', fontWeight: 700 }}>
          Sign in to your account
        </Link>
      </div>
    </form>
  );
}
