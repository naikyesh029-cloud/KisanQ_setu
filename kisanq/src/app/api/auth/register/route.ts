import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { displayName, phone, email, password, role, languagePref } = body;

    if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
      return NextResponse.json({ error: 'Please enter your full name or farm enterprise name.' }, { status: 400 });
    }

    if (!phone || typeof phone !== 'string' || phone.replace(/\D/g, '').length < 10) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit mobile phone number.' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const assignedRole = role === 'buyer' ? 'buyer' : 'farmer';
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const normPhone = `+91${cleanPhone}`;

    // Generate reliable, compliant email format
    let emailToUse = '';
    if (email && typeof email === 'string' && email.includes('@') && email.includes('.')) {
      emailToUse = email.trim().toLowerCase();
    } else {
      emailToUse = `${assignedRole}_${cleanPhone}@kisanq.org`;
    }

    const admin = createSupabaseAdminClient();

    // 1. Attempt admin user creation with pre-confirmed email (zero rate limits, zero email dependencies)
    let userId = '';
    const { data: createData, error: createError } = await admin.auth.admin.createUser({
      email: emailToUse,
      password,
      email_confirm: true,
      user_metadata: {
        role: assignedRole,
        display_name: displayName.trim(),
        phone: normPhone,
        language_pref: languagePref || 'en'
      }
    });

    if (createError) {
      // If user already exists in auth, update password and metadata
      if (createError.message.toLowerCase().includes('already') || createError.status === 422) {
        const { data: listData } = await admin.auth.admin.listUsers();
        const existing = listData?.users?.find(
          u => u.email === emailToUse || u.phone === normPhone || u.phone?.endsWith(cleanPhone)
        );

        if (existing) {
          userId = existing.id;
          await admin.auth.admin.updateUserById(userId, {
            password,
            email_confirm: true,
            user_metadata: {
              role: assignedRole,
              display_name: displayName.trim(),
              phone: normPhone,
              language_pref: languagePref || 'en'
            }
          });
          if (existing.email) emailToUse = existing.email;
        } else {
          return NextResponse.json({ error: createError.message }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: createError.message }, { status: 400 });
      }
    } else if (createData.user) {
      userId = createData.user.id;
    }

    if (!userId) {
      return NextResponse.json({ error: 'Could not provision account identity.' }, { status: 500 });
    }

    // 2. Ensure profile is upserted with statutory DPDP consent
    const { error: profileError } = await admin.from('profiles').upsert({
      id: userId,
      role: assignedRole,
      phone: normPhone,
      display_name: displayName.trim(),
      language_pref: languagePref || 'en',
      consent_version: 'kisanq-consent-v1',
      consent_at: new Date().toISOString()
    });

    if (profileError) {
      return NextResponse.json({ error: 'Could not initialize user profile: ' + profileError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      userId,
      email: emailToUse,
      phone: normPhone,
      role: assignedRole
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'An unexpected error occurred during registration.'
    }, { status: 500 });
  }
}
