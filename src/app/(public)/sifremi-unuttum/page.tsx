'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import '../auth.css';

export default function ForgotPasswordPage() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  // Verification states
  const [verificationStep, setVerificationStep] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [inputCode, setInputCode] = useState('');

  const supabase = createClient();

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phone || phone.length < 10) {
      setError('Geçerli bir telefon numarası girin.');
      return;
    }

    setLoading(true);

    try {
      let normalizedPhone = phone.replace(/\D/g, '');
      if (normalizedPhone.startsWith('0')) {
        normalizedPhone = normalizedPhone.substring(1);
      }
      if (normalizedPhone.length === 10) {
        normalizedPhone = '90' + normalizedPhone;
      }

      // Verify profile exists in database
      const { data: profile, error: dbError } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', normalizedPhone)
        .single();

      if (dbError || !profile) {
        setError('Bu telefon numarası sisteme kayıtlı değildir.');
        setLoading(false);
        return;
      }

      // Generate a mock code
      const mockCode = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedCode(mockCode);
      setVerificationStep(true);
    } catch {
      setError('Beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (inputCode !== generatedCode) {
      setError('Girdiğiniz doğrulama kodu hatalıdır.');
      return;
    }

    // Save phone to sessionStorage to allow reset password on next page
    let normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = normalizedPhone.substring(1);
    }
    if (normalizedPhone.length === 10) {
      normalizedPhone = '90' + normalizedPhone;
    }
    sessionStorage.setItem('reset_phone', normalizedPhone);

    setSuccess(true);
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-container animate-fade-in-up">
          <div className="auth-logo">
            <a href="/">
              <img src="/logo.svg" alt="Aidatom" style={{ height: '40px', width: 'auto' }} />
            </a>
          </div>
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '24px' }}>🔒</div>
            <h1>Kimlik Doğrulandı</h1>
            <p className="subtitle" style={{ marginBottom: '24px', lineHeight: 1.6 }}>
              Telefon numaranız başarıyla doğrulandı. Şimdi yeni şifrenizi belirleyebilirsiniz.
            </p>
            <a href="/sifre-sifirla" className="btn-auth-submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Yeni Şifre Belirle
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
          <p className="subtitle">
            {!verificationStep
              ? 'Kayıtlı telefon numaranızı girerek şifrenizi sıfırlayın.'
              : 'Telefonunuza simüle edilen 6 haneli doğrulama kodunu girin.'}
          </p>

          {error && (
            <div className="auth-alert error">
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          {verificationStep && generatedCode && (
            <div className="auth-alert success" style={{ marginBottom: '24px' }}>
              <span>💬</span>
              <span><strong>[MOCK SMS]</strong> Gelen Kod: <strong>{generatedCode}</strong></span>
            </div>
          )}

          {!verificationStep ? (
            <form className="auth-form" onSubmit={handleSendCode}>
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
                {loading ? 'Kontrol ediliyor...' : 'Doğrulama Kodu Gönder'}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleVerifyCode}>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" htmlFor="sms-code">
                  Doğrulama Kodu <span className="required">*</span>
                </label>
                <input
                  id="sms-code"
                  type="text"
                  maxLength={6}
                  className="form-input"
                  placeholder="------"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  style={{ textAlign: 'center', fontSize: '1.25rem', letterSpacing: '0.25em' }}
                />
              </div>

              <button
                type="submit"
                className="btn-auth-submit"
              >
                Kodu Doğrula
              </button>
            </form>
          )}

          <div className="auth-footer">
            Şifrenizi hatırladınız mı?{' '}
            <a href="/giris">Giriş Yapın</a>
          </div>
        </div>
      </div>
    </div>
  );
}
