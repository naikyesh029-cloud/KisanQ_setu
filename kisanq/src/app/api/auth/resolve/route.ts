import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const { identifier } = await request.json();
    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json({ error: 'Identifier is required.' }, { status: 400 });
    }

    const trimmed = identifier.trim().toLowerCase();

    // If already an email, return directly
    if (trimmed.includes('@')) {
      return NextResponse.json({ email: trimmed });
    }

    // It's a phone number: extract last 10 digits
    const cleanPhone = trimmed.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length < 10) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit phone number.' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Check profiles table first
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, role, phone')
      .or(`phone.ilike.%${cleanPhone}%,phone.eq.+91${cleanPhone}`)
      .limit(1);

    if (profiles && profiles.length > 0) {
      const profile = profiles[0];
      const { data: userData } = await admin.auth.admin.getUserById(profile.id);
      if (userData?.user?.email) {
        return NextResponse.json({
          email: userData.user.email,
          role: profile.role,
          phone: profile.phone
        });
      }
    }

    // Check auth.users directly
    const { data: listData } = await admin.auth.admin.listUsers();
    const match = listData?.users?.find(
      u => u.phone?.endsWith(cleanPhone) || u.email?.includes(cleanPhone)
    );

    if (match?.email) {
      return NextResponse.json({
        email: match.email,
        role: match.user_metadata?.role ?? 'farmer',
        phone: match.phone
      });
    }

    // Default fallback format
    return NextResponse.json({
      email: `farmer_${cleanPhone}@kisanq.org`
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Could not resolve identifier.'
    }, { status: 500 });
  }
}
