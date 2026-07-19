'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { validatePassword } from '@/lib/utils';
import '../auth.css';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const supabase = createClient();
  const passwordStrength = validatePassword(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!passwordStrength.isValid) {
      setError('Şifre gereksinimleri karşılanmıyor.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Şifreler uyuşmuyor.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError('Şifre güncellenirken bir hata oluştu: ' + updateError.message);
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
            <div style={{ fontSize: '3rem', marginBottom: '24px' }}>🎉</div>
            <h1>Şifreniz Güncellendi</h1>
            <p className="subtitle" style={{ marginBottom: '24px' }}>
              Yeni şifreniz başarıyla kaydedildi. Şimdi giriş yapabilirsiniz.
            </p>
            <a href="/giris" className="btn-auth-submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Giriş Yap
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
          <h1>Yeni Şifre Belirle</h1>
          <p className="subtitle">Lütfen hesabınız için yeni bir güçlü şifre girin.</p>

          {error && (
            <div className="auth-alert error">
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="new-password">
                Yeni Şifre <span className="required">*</span>
              </label>
              <div className="password-wrapper">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Yeni şifrenizi girin"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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

              {password.length > 0 && (
                <div className="password-strength">
                  <div className={`password-rule ${passwordStrength.minLength ? 'met' : ''}`}>
                    <span className="rule-icon">{passwordStrength.minLength ? '✓' : ''}</span>
                    En az 8 karakter
                  </div>
                  <div className={`password-rule ${passwordStrength.hasUppercase ? 'met' : ''}`}>
                    <span className="rule-icon">{passwordStrength.hasUppercase ? '✓' : ''}</span>
                    En az 1 büyük harf
                  </div>
                  <div className={`password-rule ${passwordStrength.hasSpecialChar ? 'met' : ''}`}>
                    <span className="rule-icon">{passwordStrength.hasSpecialChar ? '✓' : ''}</span>
                    En az 1 özel karakter (!@#$%...)
                  </div>
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label" htmlFor="confirm-password">
                Şifre Tekrar <span className="required">*</span>
              </label>
              <input
                id="confirm-password"
                type="password"
                className="form-input"
                placeholder="Yeni şifrenizi tekrar girin"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn-auth-submit"
              disabled={loading || !passwordStrength.isValid}
            >
              {loading ? 'İşleniyor...' : 'Şifreyi Güncelle'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
