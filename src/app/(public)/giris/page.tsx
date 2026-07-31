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
      const email = `${normalizedPhone}@aidatom.com`;

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
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

      // Giriş başarılı — Kullanıcının rolünü ve durumunu çekip ilgili panele yönlendir
      if (authData.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, status')
          .eq('id', authData.user.id)
          .single();

        if (profile) {
          if (profile.status === 'pending_documents' || profile.status === 'rejected') {
            window.location.href = '/belgeler';
            return;
          }
          if (profile.status === 'pending_review') {
            window.location.href = '/beklemede';
            return;
          }
          if (profile.status === 'suspended') {
            setError('Hesabınız askıya alınmıştır. Lütfen yönetici ile iletişime geçin.');
            await supabase.auth.signOut();
            return;
          }

          // Rol bazlı doğrudan yönlendirme
          switch (profile.role) {
            case 'super_admin':
              window.location.href = '/admin';
              break;
            case 'system_admin':
              window.location.href = '/sistem';
              break;
            case 'lawyer':
              window.location.href = '/avukat';
              break;
            case 'call_center':
              window.location.href = '/santral';
              break;
            case 'site_manager':
            default:
              window.location.href = '/yonetici';
              break;
          }
          return;
        }
      }

      window.location.href = '/yonetici';
    } catch {
      setError('Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.');
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
                Telefon Numarası
              </label>
              <input
                id="login-phone"
                type="tel"
                className="form-input"
                placeholder="05XX XXX XX XX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
              />
            </div>

            <div className="form-group">
              <div className="form-label-row">
                <label className="form-label" htmlFor="login-password">
                  Şifre
                </label>
                <a href="/sifremi-unuttum" className="auth-link text-xs">
                  Şifremi Unuttum?
                </a>
              </div>
              <div className="password-input-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? (
                <span className="btn-loading">
                  <span className="spinner"></span>
                  Giriş Yapılıyor...
                </span>
              ) : (
                'Giriş Yap'
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Hesabınız yok mu?{' '}
              <a href="/kayit" className="auth-link">
                Hemen Kayıt Olun
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
