'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { validatePassword } from '@/lib/utils';
import type { ManagerType } from '@/types';
import '../auth.css';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    password: '',
    manager_type: 'individual' as ManagerType,
    company_name: '',
    tax_number: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const supabase = createClient();
  const passwordStrength = validatePassword(formData.password);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!passwordStrength.isValid) {
      setError('Şifre gereksinimleri karşılanmıyor. Lütfen kontrol edin.');
      return;
    }

    if (!formData.phone || formData.phone.length < 10) {
      setError('Geçerli bir telefon numarası girin.');
      return;
    }

    setLoading(true);

    try {
      // Telefon numarasını normalize et
      let normalizedPhone = formData.phone.replace(/\D/g, '');
      if (normalizedPhone.startsWith('0')) {
        normalizedPhone = normalizedPhone.substring(1);
      }
      if (normalizedPhone.length === 10) {
        normalizedPhone = '90' + normalizedPhone;
      }

      const email = `${normalizedPhone}@aidatom.com`;

      const { error: authError } = await supabase.auth.signUp({
        email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
            phone: normalizedPhone,
            email: formData.email,
            manager_type: formData.manager_type,
            company_name: formData.manager_type === 'company' ? formData.company_name : null,
            tax_number: formData.manager_type === 'company' ? formData.tax_number : null,
            role: 'site_manager',
          },
        },
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          setError('Bu telefon numarası zaten kayıtlı. Giriş yapmayı deneyin.');
        } else {
          setError('Kayıt sırasında bir hata oluştu: ' + authError.message);
        }
        return;
      }

      setSuccess(true);
    } catch {
      setError('Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.');
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
            <div style={{ fontSize: '3rem', marginBottom: '24px' }}>✅</div>
            <h1>Kayıt Başarılı!</h1>
            <p className="subtitle" style={{ marginBottom: '24px' }}>
              Hesabınız oluşturuldu. Şimdi giriş yaparak belgelerinizi yükleyebilirsiniz.
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
            <img src="/logo.svg" alt="Aidatom" style={{ height: '40px', width: 'auto' }} />
          </a>
        </div>

        <div className="auth-card">
          <h1>Üye Olun</h1>
          <p className="subtitle">Aidatom&apos;a üye olarak aidat yönetiminizi kolaylaştırın.</p>

          {error && (
            <div className="auth-alert error">
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            {/* Ad Soyad */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-name">
                Ad Soyad <span className="required">*</span>
              </label>
              <input
                id="reg-name"
                type="text"
                className="form-input"
                placeholder="Adınız Soyadınız"
                value={formData.full_name}
                onChange={(e) => updateField('full_name', e.target.value)}
                required
              />
            </div>

            {/* Telefon */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-phone">
                Telefon Numarası <span className="required">*</span>
              </label>
              <div className="phone-input-wrapper">
                <span className="phone-prefix">+90</span>
                <input
                  id="reg-phone"
                  type="tel"
                  className="form-input"
                  placeholder="5XX XXX XX XX"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  required
                />
              </div>
            </div>

            {/* E-posta */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">
                E-posta <span className="required">*</span>
              </label>
              <input
                id="reg-email"
                type="email"
                className="form-input"
                placeholder="ornek@mail.com"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                required
              />
            </div>

            {/* Yönetici Şekli */}
            <div className="form-group">
              <label className="form-label">
                Yönetici Şekli <span className="required">*</span>
              </label>
              <div className="manager-type-grid">
                <div
                  className={`manager-type-card ${formData.manager_type === 'individual' ? 'selected' : ''}`}
                  onClick={() => updateField('manager_type', 'individual')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && updateField('manager_type', 'individual')}
                >
                  <div className="type-icon">👤</div>
                  <div className="type-label">Bireysel</div>
                  <div className="type-desc">Site Yöneticisi</div>
                </div>
                <div
                  className={`manager-type-card ${formData.manager_type === 'company' ? 'selected' : ''}`}
                  onClick={() => updateField('manager_type', 'company')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && updateField('manager_type', 'company')}
                >
                  <div className="type-icon">🏢</div>
                  <div className="type-label">Şirket</div>
                  <div className="type-desc">Yönetim Şirketi</div>
                </div>
              </div>
            </div>

            {/* Şirket Bilgileri (koşullu) */}
            {formData.manager_type === 'company' && (
              <div className="form-group animate-fade-in-up" style={{ animationDuration: '0.3s' }}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-company">
                      Şirket Adı <span className="required">*</span>
                    </label>
                    <input
                      id="reg-company"
                      type="text"
                      className="form-input"
                      placeholder="Şirket adınız"
                      value={formData.company_name}
                      onChange={(e) => updateField('company_name', e.target.value)}
                      required={formData.manager_type === 'company'}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-tax">
                      Vergi No <span className="required">*</span>
                    </label>
                    <input
                      id="reg-tax"
                      type="text"
                      className="form-input"
                      placeholder="Vergi numaranız"
                      value={formData.tax_number}
                      onChange={(e) => updateField('tax_number', e.target.value)}
                      required={formData.manager_type === 'company'}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Şifre */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">
                Şifre <span className="required">*</span>
              </label>
              <div className="password-wrapper">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Güçlü bir şifre oluşturun"
                  value={formData.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  required
                  autoComplete="new-password"
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

              {/* Şifre Gereksinimleri */}
              {formData.password.length > 0 && (
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

            <button
              type="submit"
              className="btn-auth-submit"
              style={{ marginTop: '16px' }}
              disabled={loading || !passwordStrength.isValid}
            >
              {loading ? 'Kayıt yapılıyor...' : 'Üye Ol'}
            </button>
          </form>

          <div className="auth-footer">
            Zaten hesabınız var mı?{' '}
            <a href="/giris">Giriş Yapın</a>
          </div>
        </div>
      </div>
    </div>
  );
}
