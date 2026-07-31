import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '@/lib/mailer';

const SECRET_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'aidatom_password_reset_secret_key';

export async function POST(request: Request) {
  try {
    const { input } = await request.json();
    if (!input || typeof input !== 'string') {
      return NextResponse.json({ error: 'Geçerli bir telefon numarası veya e-posta adresi giriniz.' }, { status: 400 });
    }

    const cleanInput = input.trim();
    const isEmail = cleanInput.includes('@');

    // Initialize Supabase Admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let profile: any = null;

    if (isEmail) {
      // Search by email
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .ilike('email', cleanInput)
        .limit(1);
      
      if (data && data.length > 0) {
        profile = data[0];
      }
    } else {
      // Search by phone with all format variants (5XX..., 05XX..., 905XX..., +905XX...)
      const rawDigits = cleanInput.replace(/\D/g, '');
      const base10 = rawDigits.length >= 10 ? rawDigits.slice(-10) : rawDigits;
      
      const phoneVariants = [
        base10,
        `0${base10}`,
        `90${base10}`,
        `+90${base10}`,
      ];

      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .in('phone', phoneVariants)
        .limit(1);

      if (data && data.length > 0) {
        profile = data[0];
      }
    }

    if (!profile) {
      return NextResponse.json({ error: 'Bu telefon numarasına veya e-postaya ait bir kullanıcı bulunamadı.' }, { status: 404 });
    }

    // Determine recipient email for sending reset link
    let recipientEmail = profile.email;
    if (!recipientEmail || recipientEmail.trim() === '') {
      recipientEmail = `${profile.phone}@aidatom.com`;
    }

    // Generate cryptographic 1-hour expiration HMAC token
    const exp = Date.now() + 3600 * 1000; // 1 hour validity
    const hmac = crypto.createHmac('sha256', SECRET_KEY);
    hmac.update(`${profile.id}:${recipientEmail}:${exp}`);
    const sig = hmac.digest('hex');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetLink = `${appUrl}/sifre-sifirla?uid=${profile.id}&email=${encodeURIComponent(recipientEmail)}&exp=${exp}&sig=${sig}`;

    // Send email via Nodemailer
    try {
      await sendPasswordResetEmail(recipientEmail, profile.full_name || 'Sayın Kullanıcımız', resetLink);
    } catch (mailErr: any) {
      console.error('SMTP Mail error:', mailErr);
      return NextResponse.json({
        success: true,
        message: `Şifre sıfırlama bağlantısı ${recipientEmail} adresine gönderildi.`,
        debugLink: process.env.NODE_ENV === 'development' ? resetLink : undefined,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Şifre sıfırlama bağlantısı (${recipientEmail}) adresine e-posta olarak gönderildi.`,
    });
  } catch (err: any) {
    console.error('Reset Password API Error:', err);
    return NextResponse.json({ error: 'Şifre sıfırlama talebi işlenirken bir hata oluştu.' }, { status: 500 });
  }
}
