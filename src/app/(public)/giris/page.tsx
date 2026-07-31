'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Phone, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
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
            <img src="/logo.svg" alt="Aidatom" style={{ height: '42px', width: 'auto' }} />
          </a>
        </div>

        <div className="auth-card">
          <h1>Giriş Yap</h1>
          <p className="subtitle">Aidatom Yönetim Paneline Hoş Geldiniz.</p>

          {error && (
            <div className="auth-alert error">
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{error}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-phone">
                Telefon Numarası
              </label>
              <div className="phone-input-wrapper">
                <span className="phone-prefix">+90</span>
                <input
                  id="login-phone"
                  type="tel"
                  className="form-input"
                  placeholder="5XX XXX XX XX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  autoComplete="tel"
                />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" htmlFor="login-password" style={{ margin: 0 }}>
                  Şifre
                </label>
                <a href="/sifremi-unuttum" className="auth-link" style={{ fontSize: '13px' }}>
                  Şifremi Unuttum?
                </a>
              </div>
              <div className="password-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  style={{ paddingRight: '44px' }}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-auth-submit"
              disabled={loading}
              style={{ marginTop: '1.25rem' }}
            >
              {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
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
