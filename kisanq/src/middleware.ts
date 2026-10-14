import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.includes('/farmer/analyzer')) return NextResponse.next();

  const match = path.match(/^\/(en|hi|mr)\/(farmer|buyer|inspector)(?:\/|$)/);
  if (!match) return NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without provider configuration the app stays in an explicitly labeled preview mode; APIs remain fail-closed.
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          try {
            return request.cookies.getAll();
          } catch {
            return [];
          }
        },
        setAll(cookies: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookies.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          } catch {
            /* Ignore cookie mutation errors in middleware */
          }
        }
      }
    });

    let user = null;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) user = data.user;
    } catch {
      user = null;
    }

    if (!user) {
      const login = request.nextUrl.clone();
      login.pathname = `/${match[1]}/login`;
      login.searchParams.set('next', path);
      return NextResponse.redirect(login);
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const expected = match[2];
    const supervisorOnly = path.includes('/inspector/supervisor-audit');
    const sharedDisputeDesk = path.includes('/inspector/disputes');
    const allowed = supervisorOnly
      ? profile?.role === 'supervisor'
      : sharedDisputeDesk
      ? ['farmer', 'buyer', 'inspector', 'supervisor'].includes(profile?.role ?? '')
      : expected === 'inspector'
      ? profile?.role === 'inspector' || profile?.role === 'supervisor'
      : profile?.role === expected;

    if (!allowed) {
      const dest = request.nextUrl.clone();
      dest.pathname = `/${match[1]}/login`;
      dest.searchParams.set('reason', 'role-mismatch');
      dest.searchParams.set('required', supervisorOnly ? 'supervisor' : expected);
      return NextResponse.redirect(dest);
    }

    return response;
  } catch {
    // If Supabase client fails unexpectedly (e.g. malformed auth token cookie), safely redirect to login
    const login = request.nextUrl.clone();
    login.pathname = `/${match[1]}/login`;
    login.searchParams.set('next', path);
    return NextResponse.redirect(login);
  }
}

export const config = {
  matcher: [
    '/en/farmer/:path*',
    '/hi/farmer/:path*',
    '/mr/farmer/:path*',
    '/en/buyer/:path*',
    '/hi/buyer/:path*',
    '/mr/buyer/:path*',
    '/en/inspector/:path*',
    '/hi/inspector/:path*',
    '/mr/inspector/:path*'
  ]
};
