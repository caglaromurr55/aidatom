'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import '../auth.css';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Telefon numarasını normalize et
      let normalizedPhone = phone.replace(/\D/g, '');
      if (normalizedPhone.startsWith('0')) {
        normalizedPhone = '90' + normalizedPhone.substring(1);
      } else if (!normalizedPhone.startsWith('90')) {
        normalizedPhone = '90' + normalizedPhone;
      }

      // Supabase email olarak telefon+@aidatom.com kullanıyoruz
      // Çünkü Supabase Auth phone login SMS OTP gerektiriyor
      // SMS altyapısı gelene kadar bu workaround kullanılacak
      const email = `${normalizedPhone}@aidatom.com`;

      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          setError('Telefon numarası veya şifre hatalı.');
        } else {
          setError('Giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin.');
        }
        return;
      }

      // Başarılı giriş — middleware yönlendirecek
      window.location.href = '/';
    } catch {
      setError('Beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container animate-fade-in-up">
        <div className="auth-logo">
          <a href="/">
            <img src="/logo.svg" alt="Aidatom" style={{ height: '40px', width: 'auto' }} />
          </a>
        </div>

        <div className="auth-card">
          <h1>Giriş Yap</h1>
          <p className="subtitle">Hesabınıza giriş yaparak devam edin.</p>

          {error && (
            <div className="auth-alert error">
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-phone">
                Telefon Numarası <span className="required">*</span>
              </label>
              <div className="phone-input-wrapper">
                <span className="phone-prefix">+90</span>
                <input
                  id="login-phone"
                  type="tel"
                  className="form-input"
                  placeholder="5XX XXX XX XX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  required
                  autoComplete="tel"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password">
                Şifre <span className="required">*</span>
              </label>
              <div className="password-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Şifrenizi girin"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
              <a href="/sifremi-unuttum" style={{ fontSize: '0.875rem', color: '#0FA3A3', fontWeight: 600, textDecoration: 'underline' }}>
                Şifremi Unuttum
              </a>
            </div>

            <button
              type="submit"
              className="btn-auth-submit"
              disabled={loading}
            >
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>

          <div className="auth-footer">
            Hesabınız yok mu?{' '}
            <a href="/kayit">Üye Olun</a>
          </div>
        </div>
      </div>
    </div>
  );
}
