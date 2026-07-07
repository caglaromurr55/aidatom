'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Site, DuesType, LateFeeType } from '@/types';

export default function SitelerPage() {
  const supabase = createClient();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    district: '',
    dues_type: 'fixed' as DuesType,
    default_dues_amount: 0,
    late_fee_type: 'legal_rate' as LateFeeType,
    late_fee_rate: 0,
  });

  const loadSites = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('sites')
      .select('*')
      .eq('manager_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (data) setSites(data as Site[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim() || !formData.address.trim() || !formData.city.trim() || !formData.district.trim()) {
      setError('Lütfen tüm zorunlu alanları doldurun.');
      return;
    }

    setActionLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: dbError } = await supabase.from('sites').insert({
        manager_id: user.id,
        name: formData.name,
        address: formData.address,
        city: formData.city,
        district: formData.district,
        dues_type: formData.dues_type,
        default_dues_amount: formData.default_dues_amount,
        late_fee_type: formData.late_fee_type,
        late_fee_rate: formData.late_fee_type === 'custom_rate' ? formData.late_fee_rate : null,
      });

      if (dbError) throw dbError;

      // Log audit trail
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'site_created',
        entity_type: 'site',
        entity_id: user.id, // Placeholder UUID or use site ID if returned, but here we just write audit log
        new_values: { name: formData.name },
      });

      setModalOpen(false);
      setFormData({
        name: '',
        address: '',
        city: '',
        district: '',
        dues_type: 'fixed',
        default_dues_amount: 0,
        late_fee_type: 'legal_rate',
        late_fee_rate: 0,
      });
      await loadSites();
    } catch (err: any) {
      setError('Site eklenirken bir hata oluştu: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && sites.length === 0) {
    return (
      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-lg)' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 160, borderRadius: 'var(--radius-xl)' }}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
        <div>
          <h1 className="heading-sm">Siteler ve Apartmanlar</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>
            Yöneticisi olduğunuz sitelerin listesi ve yönetimi.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          ➕ Yeni Site Ekle
        </button>
      </div>

      <div className="page-body">
        {sites.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🏢</div>
            <h3 style={{ marginBottom: 'var(--space-sm)' }}>Henüz Site Eklenmedi</h3>
            <p style={{ marginBottom: 'var(--space-lg)' }}>Sistemde yönettiğiniz bir site bulunmuyor. Yeni site ekleyerek başlayın.</p>
            <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
              İlk Sitenizi Ekleyin
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-lg)' }}>
            {sites.map((site) => (
              <a
                href={`/yonetici/siteler/${site.id}`}
                key={site.id}
                className="card card-hover"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: 180,
                  textDecoration: 'none',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 'var(--space-xs)' }}>
                    {site.name}
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                    📍 {site.district}, {site.city}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {site.address}
                  </p>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid var(--border-primary)',
                  paddingTop: 'var(--space-sm)',
                  marginTop: 'var(--space-md)',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                }}>
                  <span>Aidat Tipi: <strong>{
                    site.dues_type === 'fixed' ? 'Sabit' : site.dues_type === 'area_based' ? 'm² Bazlı' : 'Arsa Payı'
                  }</strong></span>
                  <span style={{ color: 'var(--primary-400)', fontWeight: 600 }}>Yönet ➔</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Add Site Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Yeni Site Ekle</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {error && (
                <div className="auth-alert error">
                  <span>⚠</span>
                  <span>{error}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="site-name">
                  Site / Apartman Adı <span className="required">*</span>
                </label>
                <input
                  id="site-name"
                  type="text"
                  className="form-input"
                  placeholder="Örn: Güneş Sitesi veya Huzur Apartmanı"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="site-city">
                    İl <span className="required">*</span>
                  </label>
                  <input
                    id="site-city"
                    type="text"
                    className="form-input"
                    placeholder="Örn: İstanbul"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="site-district">
                    İlçe <span className="required">*</span>
                  </label>
                  <input
                    id="site-district"
                    type="text"
                    className="form-input"
                    placeholder="Örn: Kadıköy"
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="site-address">
                  Açık Adres <span className="required">*</span>
                </label>
                <textarea
                  id="site-address"
                  className="form-input"
                  placeholder="Mahalle, cadde, sokak ve no detaylarını girin..."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="site-dues-type">
                    Aidat Belirleme Tipi <span className="required">*</span>
                  </label>
                  <select
                    id="site-dues-type"
                    className="form-input"
                    value={formData.dues_type}
                    onChange={(e) => setFormData({ ...formData, dues_type: e.target.value as DuesType })}
                  >
                    <option value="fixed">Sabit Tutar</option>
                    <option value="area_based">Daire m² Bazlı</option>
                    <option value="share_based">Arsa Payı Bazlı</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="site-default-dues">
                    Varsayılan Tutar (₺)
                  </label>
                  <input
                    id="site-default-dues"
                    type="number"
                    className="form-input"
                    placeholder="Örn: 500"
                    value={formData.default_dues_amount}
                    onChange={(e) => setFormData({ ...formData, default_dues_amount: Number(e.target.value) })}
                    min={0}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="site-late-fee-type">
                    Gecikme Faizi
                  </label>
                  <select
                    id="site-late-fee-type"
                    className="form-input"
                    value={formData.late_fee_type}
                    onChange={(e) => setFormData({ ...formData, late_fee_type: e.target.value as LateFeeType })}
                  >
                    <option value="legal_rate">Yasal Faiz Oranı</option>
                    <option value="custom_rate">Özel Faiz Oranı</option>
                  </select>
                </div>
                {formData.late_fee_type === 'custom_rate' && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="site-late-fee-rate">
                      Aylık Özel Faiz Oranı (%)
                    </label>
                    <input
                      id="site-late-fee-rate"
                      type="number"
                      step="0.01"
                      className="form-input"
                      placeholder="Örn: 5"
                      value={formData.late_fee_rate}
                      onChange={(e) => setFormData({ ...formData, late_fee_rate: Number(e.target.value) })}
                      min={0}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>İptal</button>
              <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                {actionLoading ? 'Ekleniyor...' : 'Site Ekle'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
