'use client';
import Link from 'next/link';
import { AuthStatusButton } from '@/components/shared/AuthStatusButton';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Boxes,
  CircleHelp,
  ClipboardCheck,
  ClipboardList,
  Gavel,
  LayoutDashboard,
  Plus,
  ShoppingBasket,
  WalletCards,
  Sparkles,
  LogIn,
  UserPlus,
  UserCheck,
  CreditCard,
  Truck,
  User,
  Phone,
  TicketCheck,
  Workflow,
  TrendingUp,
  Bell
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSelect } from './LanguageSelect';
import { KisanQLogo } from '@/components/ui/Logo';
import { useEffect, useState, useMemo, type ReactNode } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Role = 'farmer' | 'buyer' | 'inspector' | 'supervisor' | null;

interface NavItem {
  label: string;
  href: string;
  icon: typeof Boxes;
  tag?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export function AppShell({
  children,
  locale,
  dict
}: {
  children: ReactNode;
  locale: string;
  dict: Record<string, string>;
}) {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const [userRole, setUserRole] = useState<Role>(null);
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    let active = true;
    try {
      const sb = createSupabaseBrowserClient();
      sb.auth.getSession().then(({ data }) => {
        if (!active) return;
        const session = data.session;
        setSignedIn(Boolean(session));
        if (session?.user) {
          setPhone(session.user.phone ?? null);
          Promise.resolve(
            sb.from('profiles').select('role, phone').eq('id', session.user.id).single()
          )
            .then(({ data: profile }) => {
              if (active && profile?.role) {
                setUserRole(profile.role as Role);
                if (profile.phone) setPhone(profile.phone);
              }
            })
            .catch(() => {});
        } else {
          setUserRole(null);
          setPhone(null);
        }
      }).catch(() => {
        if (active) setSignedIn(false);
      });

      const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        setSignedIn(Boolean(session));
        if (session?.user) {
          setPhone(session.user.phone ?? null);
          Promise.resolve(
            sb.from('profiles').select('role, phone').eq('id', session.user.id).single()
          )
            .then(({ data: profile }) => {
              if (active && profile?.role) {
                setUserRole(profile.role as Role);
                if (profile.phone) setPhone(profile.phone);
              }
            })
            .catch(() => {});
        } else {
          setUserRole(null);
          setPhone(null);
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

  const t = (key: string) => dict[key] ?? key;

  const navLabel = (label: string) => {
    switch (label) {
      case 'Overview': return t('overview');
      case 'My Lots': return t('myLots');
      case 'Add Crop': return t('addCrop');
      case 'AI Analyzer': return t('aiAnalyzer');
      case 'Marketplace': return t('marketplace');
      case 'My Offers': return t('myOffers');
      case 'Tokens & Queue': return 'Tokens & Queue';
      case 'Offers & Bids': return 'Offers & Bids';
      case 'Payments & Escrow': return 'Payments & Escrow';
      case 'Mandi Process': return 'Mandi Process';
      case 'Notifications': return 'Notifications';
      case 'Purchases & Escrow': return 'Purchases & Escrow';
      case 'Pickup Pass': return 'Pickup Pass';
      case 'Buyer Profile': return 'Buyer Profile';
      case 'Operations': return t('operations');
      case 'Inspections': return t('inspections');
      case 'Inspector Profile': return 'Inspector Profile';
      case 'Supervisor Audit': return t('supervisorAudit');
      case 'Blockchain Ledger': return t('ledger');
      case 'Dispute Desk': return t('disputes');
      case 'Market Prices': return t('market');
      case 'Sign In': return t('login');
      case 'Register': return t('register');
      case 'Rural IVR Voice Assist': return 'Rural IVR Voice Assist';
      case 'Help & Support': return 'Help & Support';
      default: return label;
    }
  };

  // Strictly gate side panel navigation by the active user's verified role
  const navigationGroups: NavGroup[] = useMemo(() => {
    if (!signedIn || !userRole) {
      return [
        {
          title: 'explore',
          items: [
            { label: 'Overview', href: '', icon: LayoutDashboard },
            { label: 'Market Prices', href: 'market-prices', icon: BarChart3, tag: 'Universal' }
          ]
        },
        {
          title: 'login',
          items: [
            { label: 'Sign In', href: 'login', icon: LogIn },
            { label: 'Register', href: 'register', icon: UserPlus }
          ]
        }
      ];
    }

    if (userRole === 'farmer') {
      return [
        {
          title: 'farmer',
          items: [
            { label: 'My Lots', href: 'farmer/lots', icon: Boxes },
            { label: 'Add Crop', href: 'farmer/lots/new', icon: Plus },
            { label: 'AI Analyzer', href: 'farmer/analyzer', icon: Sparkles, tag: 'AI' },
            { label: 'Tokens & Queue', href: 'farmer/tokens', icon: TicketCheck },
            { label: 'Offers & Bids', href: 'farmer/offers', icon: TrendingUp },
            { label: 'Payments & Escrow', href: 'farmer/payments', icon: CreditCard },
            { label: 'Mandi Process', href: 'farmer/process', icon: Workflow },
            { label: 'Marketplace', href: 'buyer/marketplace', icon: ShoppingBasket },
            { label: 'Notifications', href: 'farmer/notifications', icon: Bell },
            { label: 'Dispute Desk', href: 'inspector/disputes', icon: Gavel },
            { label: 'Market Prices', href: 'market-prices', icon: BarChart3 }
          ]
        },
        {
          title: 'explore',
          items: [
            { label: 'Rural IVR Voice Assist', href: 'ivr-demo', icon: Phone },
            { label: 'Help & Support', href: 'help', icon: CircleHelp }
          ]
        }
      ];
    }

    if (userRole === 'buyer') {
      return [
        {
          title: 'buyer',
          items: [
            { label: 'Marketplace', href: 'buyer/marketplace', icon: ShoppingBasket },
            { label: 'My Offers', href: 'buyer/offers', icon: WalletCards },
            { label: 'Purchases & Escrow', href: 'buyer/purchases', icon: CreditCard },
            { label: 'Pickup Pass', href: 'buyer/pickup', icon: Truck },
            { label: 'Dispute Desk', href: 'inspector/disputes', icon: Gavel },
            { label: 'Market Prices', href: 'market-prices', icon: BarChart3 }
          ]
        },
        {
          title: 'explore',
          items: [
            { label: 'Buyer Profile', href: 'buyer/profile', icon: User },
            { label: 'Help & Support', href: 'help', icon: CircleHelp }
          ]
        }
      ];
    }

    if (userRole === 'inspector') {
      return [
        {
          title: 'inspector',
          items: [
            { label: 'Operations', href: 'inspector/dashboard', icon: LayoutDashboard },
            { label: 'Inspections', href: 'inspector/inspections', icon: ClipboardList },
            { label: 'Dispute Desk', href: 'inspector/disputes', icon: Gavel },
            { label: 'Blockchain Ledger', href: 'inspector/ledger', icon: ClipboardCheck },
            { label: 'Market Prices', href: 'market-prices', icon: BarChart3 }
          ]
        },
        {
          title: 'explore',
          items: [
            { label: 'Inspector Profile', href: 'inspector/profile', icon: User },
            { label: 'Help & Support', href: 'help', icon: CircleHelp }
          ]
        }
      ];
    }

    if (userRole === 'supervisor') {
      return [
        {
          title: 'inspector',
          items: [
            { label: 'Supervisor Audit', href: 'inspector/supervisor-audit', icon: ClipboardCheck },
            { label: 'Blockchain Ledger', href: 'inspector/ledger', icon: ClipboardCheck },
            { label: 'Operations', href: 'inspector/dashboard', icon: LayoutDashboard },
            { label: 'Inspections', href: 'inspector/inspections', icon: ClipboardList },
            { label: 'Dispute Desk', href: 'inspector/disputes', icon: Gavel },
            { label: 'Market Prices', href: 'market-prices', icon: BarChart3 }
          ]
        },
        {
          title: 'explore',
          items: [
            { label: 'Help & Support', href: 'help', icon: CircleHelp }
          ]
        }
      ];
    }

    return [];
  }, [signedIn, userRole]);

  return (
    <div className="main-shell">
      {/* Desktop Sidebar */}
      <aside
        className="desktop-sidebar"
        style={{
          position: 'fixed',
          inset: '0 auto 0 0',
          width: 255,
          padding: '20px 16px',
          borderRight: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 20
        }}
      >
        {/* Brand Header */}
        <Link
          href={`/${locale}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 6px 20px',
            textDecoration: 'none'
          }}
        >
          <KisanQLogo size={38} showText={true} />
        </Link>

        {/* Dynamic Role-Gated Navigation Links */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 2 }}>
          {navigationGroups.map((group) => (
            <div key={group.title} style={{ marginBottom: 20 }}>
              <div
                className="eyebrow"
                style={{
                  padding: '0 10px',
                  marginBottom: 8,
                  fontSize: 10,
                  opacity: 0.8
                }}
              >
                {t(group.title.toLowerCase())}
              </div>
              {group.items.map((item) => {
                const href = item.href ? `/${locale}/${item.href}` : `/${locale}`;
                const active = pathname === href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href || 'home'}
                    href={href}
                    className={`nav-link${active ? ' active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 12px',
                      borderRadius: 10,
                      marginBottom: 2
                    }}
                  >
                    <Icon size={17} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 13, flex: 1 }}>{navLabel(item.label)}</span>
                    {item.tag && !active && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 6,
                          background: item.tag === 'AI' ? 'var(--accent-soft)' : 'var(--bg)',
                          color: item.tag === 'AI' ? 'var(--accent)' : 'var(--muted)',
                          border: '1px solid var(--border)'
                        }}
                      >
                        {item.tag}
                      </span>
                    )}
                    {active && (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 6,
                          background: 'var(--accent)'
                        }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* User Role Card & Status */}
        <div
          className="surface"
          style={{
            padding: 12,
            boxShadow: 'none',
            background: 'var(--bg)',
            borderRadius: 12,
            marginTop: 10
          }}
        >
          {signedIn && userRole ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span
                  className="badge"
                  style={{
                    fontSize: 11,
                    textTransform: 'capitalize',
                    background:
                      userRole === 'farmer'
                        ? '#ecfdf5'
                        : userRole === 'buyer'
                        ? '#eff6ff'
                        : userRole === 'inspector'
                        ? '#fef3c7'
                        : '#f3e8ff',
                    color:
                      userRole === 'farmer'
                        ? '#047857'
                        : userRole === 'buyer'
                        ? '#1d4ed8'
                        : userRole === 'inspector'
                        ? '#b45309'
                        : '#7e22ce',
                    border: '1px solid currentColor'
                  }}
                >
                  <UserCheck size={12} style={{ marginRight: 3 }} />
                  {userRole} Mode
                </span>
                <span className="muted" style={{ fontSize: 10 }}>Active</span>
              </div>
              <div
                className="muted"
                style={{
                  fontSize: 11,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {phone ? `+91 ${phone}` : 'Authenticated Account'}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 13 }}>🌾</span>
                <strong style={{ fontSize: 12 }}>Open Mandi Portal</strong>
              </div>
              <p className="muted" style={{ fontSize: 11, margin: 0, lineHeight: 1.4 }}>
                Sign in to manage harvest listings, place bids, or conduct inspections.
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ marginLeft: 255 }} className="desktop-main">
        {/* Top Navbar */}
        <header
          style={{
            height: 68,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '0 28px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
            position: 'sticky',
            top: 0,
            zIndex: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href={`/${locale}`} className="mobile-only-logo" style={{ display: 'none' }}>
              <KisanQLogo size={32} showText={false} />
            </Link>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em' }}>
                {t('tagline')}
              </div>
              <div className="muted" style={{ fontSize: 11 }}>
                Digital APMC Yard & Transparency Network
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <AuthStatusButton locale={locale} dict={dict} />
            <LanguageSelect locale={locale} />
            <ThemeToggle />
          </div>
        </header>

        {/* Mobile Navigation Bar */}
        <nav
          className="mobile-nav"
          aria-label="Main navigation"
          style={{
            gap: 6,
            padding: '8px 12px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
            overflowX: 'auto'
          }}
        >
          {navigationGroups.flatMap((g) => g.items).map((item) => {
            const href = item.href ? `/${locale}/${item.href}` : `/${locale}`;
            const Icon = item.icon;
            const active = pathname === href;
            return (
              <Link
                key={item.href || 'home'}
                href={href}
                className={`nav-link${active ? ' active' : ''}`}
                style={{
                  padding: '7px 11px',
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                  borderRadius: 8
                }}
              >
                <Icon size={14} />
                {navLabel(item.label)}
              </Link>
            );
          })}
        </nav>

        {/* Page Content */}
        <main className="main-content">{children}</main>

        {/* Footer */}
        <footer
          className="muted"
          style={{
            padding: '0 32px 28px',
            fontSize: 11,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div>
            KisanQ · Digital Mandi Operations & Immutable Ledger ·{' '}
            <Link href={`/${locale}/market-prices`} style={{ textDecoration: 'underline' }}>
              {t('market')}
            </Link>{' '}
            ·{' '}
            <Link href={`/${locale}/ivr-demo`} style={{ textDecoration: 'underline' }}>
              {t('ivr')}
            </Link>
          </div>
          <div>
            DPDP Compliant · Production Architecture
          </div>
        </footer>
      </div>
    </div>
  );
}
