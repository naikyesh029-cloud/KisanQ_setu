'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, LogIn, UserCheck } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function AuthStatusButton({ locale, dict }: { locale: string; dict: Record<string, string> }) {
  const [signedIn, setSignedIn] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    try {
      const sb = createSupabaseBrowserClient();
      sb.auth.getSession().then(({ data }) => {
        if (!active) return;
        setSignedIn(Boolean(data.session));
        if (data.session?.user) {
          Promise.resolve(sb.from('profiles').select('role').eq('id', data.session.user.id).single())
            .then(({ data: profile }) => { if (active && profile?.role) setUserRole(profile.role); })
            .catch(() => {});
        }
      }).catch(() => { if (active) setSignedIn(false); });

      const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        setSignedIn(Boolean(session));
        if (session?.user) {
          Promise.resolve(sb.from('profiles').select('role').eq('id', session.user.id).single())
            .then(({ data: profile }) => { if (active && profile?.role) setUserRole(profile.role); })
            .catch(() => {});
        } else {
          setUserRole(null);
        }
      });

      return () => {
        active = false;
        subscription.unsubscribe();
      };
    } catch {
      setSignedIn(false);
    }
  }, []);

  async function logout() {
    setBusy(true);
    try {
      await createSupabaseBrowserClient().auth.signOut();
      setSignedIn(false);
      setUserRole(null);
      router.push(`/${locale}/login`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (signedIn) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {userRole && (
          <span className="badge badge-neutral" style={{ textTransform: 'capitalize', fontSize: 11, padding: '4px 8px' }}>
            <UserCheck size={12} style={{ marginRight: 3 }} />
            {userRole}
          </span>
        )}
        <button className="btn" style={{ minHeight: 38 }} disabled={busy} onClick={logout} title={dict.logout}>
          <LogOut size={15} />
          {busy ? 'Signing out…' : dict.logout}
        </button>
      </div>
    );
  }

  return (
    <Link href={`/${locale}/login`} className="btn" style={{ minHeight: 38 }}>
      <LogIn size={15} />
      {dict.login}
    </Link>
  );
}
