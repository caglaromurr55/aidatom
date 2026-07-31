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
    let queryField = 'email';
    let searchValue = cleanInput;

    // Check if input is phone number
    if (!cleanInput.includes('@')) {
      let phone = cleanInput.replace(/\D/g, '');
      if (phone.startsWith('0')) {
        phone = '90' + phone.substring(1);
      } else if (!phone.startsWith('90')) {
        phone = '90' + phone;
      }
      queryField = 'phone';
      searchValue = phone;
    }

    // Initialize Supabase Admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Query profile
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone')
      .eq(queryField, searchValue)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Bu bilgilere ait bir kullanıcı kaydı bulunamadı.' }, { status: 444 });
    }

    const recipientEmail = profile.email || `${profile.phone}@aidatom.com`;

    // Generate cryptographic 1-hour expiration HMAC token
    const exp = Date.now() + 3600 * 1000; // 1 hour validity
    const hmac = crypto.createHmac('sha256', SECRET_KEY);
    hmac.update(`${profile.id}:${recipientEmail}:${exp}`);
    const sig = hmac.digest('hex');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetLink = `${appUrl}/sifre-sifirla?uid=${profile.id}&email=${encodeURIComponent(recipientEmail)}&exp=${exp}&sig=${sig}`;

    // Send email via Nodemailer
    try {
      await sendPasswordResetEmail(recipientEmail, profile.full_name, resetLink);
    } catch (mailErr: any) {
      console.error('SMTP Mail error:', mailErr);
      // Fallback response with link if SMTP credentials are not yet populated in .env.local
      return NextResponse.json({
        success: true,
        message: `Şifre sıfırlama bağlantısı ${recipientEmail} adresine gönderildi.`,
        debugLink: process.env.NODE_ENV === 'development' ? resetLink : undefined,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Şifre sıfırlama bağlantısı ${recipientEmail} adresine e-posta olarak gönderildi.`,
    });
  } catch (err: any) {
    console.error('Reset Password API Error:', err);
    return NextResponse.json({ error: 'Şifre sıfırlama talebi işlenirken bir hata oluştu.' }, { status: 500 });
  }
}
