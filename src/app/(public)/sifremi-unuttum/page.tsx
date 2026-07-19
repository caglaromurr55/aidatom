'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import '../auth.css';

export default function ForgotPasswordPage() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phone || phone.length < 10) {
      setError('Geçerli bir telefon numarası girin.');
      return;
    }

    setLoading(true);

    try {
      // Supabase'in phone-based password reset akışı normalde SMS OTP gerektirir.
      // E-posta workaround kullandığımız için, telefon numarasına ait e-postaya sıfırlama linki gönderebiliriz.
      let normalizedPhone = phone.replace(/\D/g, '');
      if (normalizedPhone.startsWith('0')) {
        normalizedPhone = normalizedPhone.substring(1);
      }
      if (normalizedPhone.length === 10) {
        normalizedPhone = '90' + normalizedPhone;
      }

      const email = `${normalizedPhone}@aidatom.com`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/sifre-sifirla`,
      });

      if (resetError) {
        setError('Şifre sıfırlama talebi gönderilirken bir hata oluştu: ' + resetError.message);
        return;
      }

      setSuccess(true);
    } catch {
      setError('Beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-container animate-fade-in-up">
          <div className="auth-logo">
            <a href="/">
              <span className="logo-teal">AİDAT</span>OM
            </a>
          </div>
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '24px' }}>📨</div>
            <h1>Sıfırlama Talebi Gönderildi</h1>
            <p className="subtitle" style={{ marginBottom: '24px', lineHeight: 1.6 }}>
              Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Lütfen gelen kutunuzu (ve gereksiz kutusunu) kontrol edin.
            </p>
            <a href="/giris" className="btn-auth-submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Giriş Ekranına Dön
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container animate-fade-in-up">
        <div className="auth-logo">
          <a href="/">
            <span className="logo-teal">AİDAT</span>OM
          </a>
        </div>

        <div className="auth-card">
          <h1>Şifremi Unuttum</h1>
          <p className="subtitle">Kayıtlı telefon numaranızı girerek şifre sıfırlama bağlantısı talep edin.</p>

          {error && (
            <div className="auth-alert error">
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label" htmlFor="reset-phone">
                Telefon Numarası <span className="required">*</span>
              </label>
              <div className="phone-input-wrapper">
                <span className="phone-prefix">+90</span>
                <input
                  id="reset-phone"
                  type="tel"
                  className="form-input"
                  placeholder="5XX XXX XX XX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-auth-submit"
              disabled={loading}
            >
              {loading ? 'İşleniyor...' : 'Sıfırlama Bağlantısı Gönder'}
            </button>
          </form>

          <div className="auth-footer">
            Şifrenizi hatırladınız mı?{' '}
            <a href="/giris">Giriş Yapın</a>
          </div>
        </div>
      </div>
    </div>
  );
}
