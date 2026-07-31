'use client';

import { useState } from 'react';
import { Mail, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import '../auth.css';

export default function ForgotPasswordPage() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [debugLink, setDebugLink] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        throw new Error(`Sunucudan beklenmeyen yanıt alındı (${res.status}).`);
      }

      if (!res.ok) {
        setError(data.error || 'Şifre sıfırlama bağlantısı gönderilemedi.');
        return;
      }

      setSuccessMessage(data.message || 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.');
      if (data.debugLink) {
        setDebugLink(data.debugLink);
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'İstek işlenirken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container animate-fade-in-up">
        <div className="auth-logo" style={{ textAlign: 'center', marginBottom: '32px' }}>
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/logo.svg" alt="Aidatom" style={{ height: '48px', width: 'auto', maxWidth: '100%', objectFit: 'contain' }} />
          </a>
        </div>

        <div className="auth-card">
          <h1>Şifremi Unuttum</h1>
          <p className="subtitle">
            Kayıtlı telefon numaranızı veya e-posta adresinizi girerek şifre sıfırlama bağlantısı talep edin.
          </p>

          {error && (
            <div className="auth-alert error">
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                backgroundColor: 'var(--success-bg)', color: 'var(--success)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '1.25rem'
              }}>
                <CheckCircle2 size={36} />
              </div>

              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: '#0F1F3D' }}>
                E-Posta Gönderildi!
              </h2>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                {successMessage}
              </p>

              {debugLink && (
                <div style={{ background: '#F8FAFC', padding: '0.75rem', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '1.5rem', textAlign: 'left' }}>
                  <div className="text-xs" style={{ fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>⚙ Test Sıfırlama Bağlantısı (Geliştirici Modu):</div>
                  <a href={debugLink} className="text-xs" style={{ color: 'var(--color-teal)', wordBreak: 'break-all' }}>
                    {debugLink}
                  </a>
                </div>
              )}

              <a href="/giris" className="btn-auth-submit" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none' }}>
                <ArrowLeft size={18} /> Giriş Ekranına Dön
              </a>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" htmlFor="reset-input">
                  Telefon Numarası veya E-Posta
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="reset-input"
                    type="text"
                    className="form-input"
                    placeholder="05XX XXX XX XX veya ornek@aidatom.com"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    required
                  />
                  <Mail size={18} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                </div>
              </div>

              <button
                type="submit"
                className="btn-auth-submit"
                disabled={loading || !input.trim()}
              >
                {loading ? 'E-Posta Gönderiliyor...' : 'Şifre Sıfırlama Bağlantısı Gönder'}
              </button>
            </form>
          )}

          <div className="auth-footer" style={{ marginTop: '1.5rem' }}>
            <p>
              Şifrenizi hatırladınız mı?{' '}
              <a href="/giris" className="auth-link">
                Giriş Yapın
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
