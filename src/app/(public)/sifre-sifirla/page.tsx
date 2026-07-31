'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { validatePassword } from '@/lib/utils';
import { Eye, EyeOff, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import '../auth.css';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const uid = searchParams.get('uid');
  const email = searchParams.get('email');
  const exp = searchParams.get('exp');
  const sig = searchParams.get('sig');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const passwordStrength = validatePassword(password);

  useEffect(() => {
    if (!uid || !email || !exp || !sig) {
      setError('Geçersiz veya eksik şifre sıfırlama bağlantısı. Lütfen e-postanızdaki bağlantıya tekrar tıklayın.');
    }
  }, [uid, email, exp, sig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!passwordStrength.isValid) {
      setError('Şifreniz güvenlik gereksinimlerini karşılamıyor.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Girdiğiniz şifreler uyuşmuyor.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, email, exp, sig, newPassword: password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Şifre güncellenirken bir hata oluştu.');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Şifre güncellenirken bağlantı hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          backgroundColor: 'var(--success-bg)', color: 'var(--success)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '1.25rem'
        }}>
          <CheckCircle2 size={36} />
        </div>

        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F1F3D' }}>Şifreniz Güncellendi!</h1>
        <p className="subtitle" style={{ marginBottom: '1.5rem', lineHeight: 1.6 }}>
          Yeni şifreniz başarıyla kaydedildi. Artık yeni şifrenizle giriş yapabilirsiniz.
        </p>

        <a href="/giris" className="btn-auth-submit" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
          Giriş Yap
        </a>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h1>Yeni Şifre Belirle</h1>
      <p className="subtitle">Lütfen hesabınız için yeni ve güçlü bir şifre girin.</p>

      {error && (
        <div className="auth-alert error">
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
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
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ paddingRight: '44px' }}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {password.length > 0 && (
            <div className="password-strength" style={{ marginTop: '8px' }}>
              <div className={`password-rule ${passwordStrength.minLength ? 'met' : ''}`}>
                <span className="rule-icon">{passwordStrength.minLength ? '✓' : ''}</span>
                En az 8 karakter
              </div>
              <div className={`password-rule ${passwordStrength.hasUppercase ? 'met' : ''}`}>
                <span className="rule-icon">{passwordStrength.hasUppercase ? '✓' : ''}</span>
                En az 1 büyük harf (A-Z)
              </div>
              <div className={`password-rule ${passwordStrength.hasSpecialChar ? 'met' : ''}`}>
                <span className="rule-icon">{passwordStrength.hasSpecialChar ? '✓' : ''}</span>
                En az 1 özel karakter (!@#$%...)
              </div>
            </div>
          )}
        </div>

        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label className="form-label" htmlFor="confirm-password">
            Şifre Tekrarı <span className="required">*</span>
          </label>
          <input
            id="confirm-password"
            type="password"
            className="form-input"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          className="btn-auth-submit"
          disabled={loading || !passwordStrength.isValid || password !== confirmPassword || !uid}
        >
          {loading ? 'Şifre Güncelleniyor...' : 'Şifreyi Güncelle & Kaydet'}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="auth-page">
      <div className="auth-container animate-fade-in-up">
        <div className="auth-logo" style={{ textAlign: 'center', marginBottom: '32px' }}>
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/logo.svg" alt="Aidatom" style={{ height: '48px', width: 'auto', maxWidth: '100%', objectFit: 'contain' }} />
          </a>
        </div>
        <Suspense fallback={<div className="auth-card"><p>Yükleniyor...</p></div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
