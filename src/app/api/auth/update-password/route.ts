import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SECRET_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'aidatom_password_reset_secret_key';

export async function POST(request: Request) {
  try {
    const { uid, email, exp, sig, newPassword } = await request.json();

    if (!uid || !email || !exp || !sig || !newPassword) {
      return NextResponse.json({ error: 'Eksik veya geçersiz istek parametreleri.' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Şifreniz en az 8 karakter uzunluğunda olmalıdır.' }, { status: 400 });
    }

    // 1. Verify token expiration
    const now = Date.now();
    if (now > Number(exp)) {
      return NextResponse.json({ error: 'Şifre sıfırlama bağlantısının süresi dolmuş. Lütfen yeniden talep edin.' }, { status: 410 });
    }

    // 2. Verify HMAC Signature
    const hmac = crypto.createHmac('sha256', SECRET_KEY);
    hmac.update(`${uid}:${email}:${exp}`);
    const expectedSig = hmac.digest('hex');

    if (sig !== expectedSig) {
      return NextResponse.json({ error: 'Geçersiz veya üzerinde oynanmış şifre sıfırlama bağlantısı.' }, { status: 403 });
    }

    // 3. Update password in Supabase via RPC or Admin Client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: rpcRes, error: rpcErr } = await supabase.rpc('reset_user_password', {
      p_uid: uid,
      p_new_password: newPassword,
    });

    if (rpcErr) {
      console.error('Password reset RPC Error:', rpcErr);
      return NextResponse.json({ error: 'Şifre güncellenirken veritabanı hatası oluştu: ' + rpcErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Şifreniz başarıyla güncellendi. Artık yeni şifrenizle giriş yapabilirsiniz.',
    });
  } catch (err: any) {
    console.error('Update Password API Error:', err);
    return NextResponse.json({ error: 'Şifre güncelleme işlemi sırasında bir hata oluştu.' }, { status: 500 });
  }
}
