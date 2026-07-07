'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import type { Site, IncomeExpense, IncomeExpenseType } from '@/types';

export default function GelirGiderPage() {
  const supabase = createClient();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [transactions, setTransactions] = useState<IncomeExpense[]>([]);
  
  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    type: 'expense' as IncomeExpenseType,
    category: 'Temizlik',
    amount: 0,
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
    receipt_file: null as File | null,
  });

  useEffect(() => {
    async function loadSites() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('sites')
        .select('*')
        .eq('manager_id', user.id)
        .is('deleted_at', null);
      if (data) {
        const loadedSites = data as Site[];
        setSites(loadedSites);
        if (loadedSites.length > 0) {
          setSelectedSiteId(loadedSites[0].id);
        }
      }
      setLoading(false);
    }
    loadSites();
  }, [supabase]);

  const loadTransactions = useCallback(async () => {
    if (!selectedSiteId) return;
    setLoading(true);

    const { data } = await supabase
      .from('income_expenses')
      .select('*')
      .eq('site_id', selectedSiteId)
      .order('transaction_date', { ascending: false });

    if (data) {
      setTransactions(data as IncomeExpense[]);
    }
    setLoading(false);
  }, [supabase, selectedSiteId]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const handleFileUpload = async (file: File): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return '';

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/receipt_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('documents') // Let's use the existing 'documents' bucket for simplicity
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw uploadError;
    return fileName;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedSiteId || !formData.category || formData.amount <= 0 || !formData.description.trim()) {
      setError('Lütfen tüm alanları doldurun.');
      return;
    }

    setActionLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let receiptPath = null;
      if (formData.receipt_file) {
        setUploading(true);
        receiptPath = await handleFileUpload(formData.receipt_file);
        setUploading(false);
      }

      const { error: dbError } = await supabase.from('income_expenses').insert({
        site_id: selectedSiteId,
        type: formData.type,
        category: formData.category,
        amount: formData.amount,
        description: formData.description,
        transaction_date: formData.transaction_date,
        recorded_by: user.id,
        receipt_path: receiptPath,
      });

      if (dbError) throw dbError;

      // Log audit
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'transaction_recorded',
        entity_type: 'income_expense',
        entity_id: user.id, // placeholder
        new_values: { type: formData.type, amount: formData.amount, category: formData.category },
      });

      setSuccess('Kayıt başarıyla eklendi.');
      setModalOpen(false);
      setFormData({
        type: 'expense',
        category: 'Temizlik',
        amount: 0,
        description: '',
        transaction_date: new Date().toISOString().split('T')[0],
        receipt_file: null,
      });
      await loadTransactions();
    } catch (err: any) {
      setError('Kayıt eklenirken bir hata oluştu: ' + err.message);
    } finally {
      setActionLoading(false);
      setUploading(false);
    }
  };

  const getReceiptUrl = async (filePath: string) => {
    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

  // Finance summaries
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const netBalance = totalIncome - totalExpense;

  if (loading && transactions.length === 0 && sites.length === 0) {
    return (
      <div className="page-body">
        <div className="skeleton" style={{ height: 180, borderRadius: 'var(--radius-xl)' }}></div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
        <div>
          <h1 className="heading-sm">Gelir - Gider Takibi</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>
            Sitenizin tüm gelir ve gider kalemlerini kayıt altında tutun, fatura ve makbuz yükleyin.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)} disabled={sites.length === 0}>
          ➕ Yeni Gelir / Gider Ekle
        </button>
      </div>

      <div className="page-body">
        {success && <div className="auth-alert success" style={{ marginBottom: 'var(--space-lg)' }}><span>✓</span><span>{success}</span></div>}
        {error && <div className="auth-alert error" style={{ marginBottom: 'var(--space-lg)' }}><span>⚠</span><span>{error}</span></div>}

        {/* Site Filter */}
        <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)', alignItems: 'center' }}>
          <span className="form-label" style={{ margin: 0 }}>Site Seçimi:</span>
          <div style={{ width: 220 }}>
            <select
              className="form-input"
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              aria-label="Site Seçimi"
            >
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* Finance summaries */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-lg)', marginBottom: 'var(--space-2xl)' }}>
          <div className="stat-card">
            <span className="stat-value" style={{ color: 'var(--success)' }}>{formatCurrency(totalIncome)}</span>
            <span className="stat-label">Toplam Gelir</span>
          </div>
          <div className="stat-card">
            <span className="stat-value" style={{ color: 'var(--error)' }}>{formatCurrency(totalExpense)}</span>
            <span className="stat-label">Toplam Gider</span>
          </div>
          <div className="stat-card" style={{ borderColor: netBalance >= 0 ? 'var(--success)' : 'var(--error)' }}>
            <span className="stat-value" style={{ color: netBalance >= 0 ? 'var(--success-light)' : 'var(--error-light)' }}>
              {formatCurrency(netBalance)}
            </span>
            <span className="stat-label">Net Kasa Durumu</span>
          </div>
        </div>

        {/* Transactions Table */}
        {transactions.length === 0 ? (
          <div className="empty-state">
            <div className="icon">💸</div>
            <h3>İşlem Kaydı Yok</h3>
            <p>Seçili site için kaydedilmiş bir gelir veya gider bulunmamaktadır.</p>
          </div>
        ) : (
          <div className="table-wrapper animate-fade-in">
            <table className="table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Tür</th>
                  <th>Kategori</th>
                  <th>Açıklama</th>
                  <th>Tutar</th>
                  <th>Belge</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="text-sm">{new Date(t.transaction_date).toLocaleDateString('tr-TR')}</td>
                    <td>
                      {t.type === 'income' ? (
                        <span className="badge badge-success">Gelir</span>
                      ) : (
                        <span className="badge badge-error">Gider</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>{t.category}</td>
                    <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.description}
                    </td>
                    <td style={{ 
                      fontWeight: 700, 
                      color: t.type === 'income' ? 'var(--success-light)' : 'var(--error-light)' 
                    }}>
                      {t.type === 'income' ? '+' : '-'}{t.amount} ₺
                    </td>
                    <td>
                      {t.receipt_path ? (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => getReceiptUrl(t.receipt_path!)}
                          style={{ color: 'var(--primary-400)' }}
                        >
                          👁️ Belgeyi Gör
                        </button>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Belge Yok</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Gelir / Gider Girişi</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {error && <div className="auth-alert error"><span>⚠</span><span>{error}</span></div>}

              <div className="form-group">
                <label className="form-label">İşlem Türü</label>
                <div className="manager-type-grid" style={{ gap: 'var(--space-md)' }}>
                  <div
                    className={`manager-type-card ${formData.type === 'income' ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, type: 'income', category: 'Aidat Tahsilatı' })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setFormData({ ...formData, type: 'income', category: 'Aidat Tahsilatı' })}
                  >
                    🟢 Gelir (Kasa Girişi)
                  </div>
                  <div
                    className={`manager-type-card ${formData.type === 'expense' ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, type: 'expense', category: 'Temizlik' })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setFormData({ ...formData, type: 'expense', category: 'Temizlik' })}
                  >
                    🔴 Gider (Kasa Çıkışı)
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="tx-category">Kategori</label>
                  {formData.type === 'expense' ? (
                    <select
                      id="tx-category"
                      className="form-input"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      <option value="Temizlik">Temizlik</option>
                      <option value="Elektrik">Elektrik</option>
                      <option value="Su">Su</option>
                      <option value="Asansör Bakım">Asansör Bakım</option>
                      <option value="Yönetici Huzur Hakkı">Yönetici Huzur Hakkı</option>
                      <option value="Bahçe Bakımı">Bahçe Bakımı</option>
                      <option value="Ortak Alan Onarım">Ortak Alan Onarım</option>
                      <option value="Diğer">Diğer</option>
                    </select>
                  ) : (
                    <select
                      id="tx-category"
                      className="form-input"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      <option value="Aidat Tahsilatı">Aidat Tahsilatı</option>
                      <option value="Demirbaş Tahsilatı">Demirbaş Tahsilatı</option>
                      <option value="Reklam Geliri">Reklam / Ortak Alan Geliri</option>
                      <option value="Faiz Geliri">Faiz Geliri</option>
                      <option value="Diğer">Diğer</option>
                    </select>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="tx-amount">Tutar (₺) <span className="required">*</span></label>
                  <input
                    id="tx-amount"
                    type="number"
                    className="form-input"
                    placeholder="Tutar girin"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                    min={1}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="tx-date">İşlem Tarihi <span className="required">*</span></label>
                  <input
                    id="tx-date"
                    type="date"
                    className="form-input"
                    value={formData.transaction_date}
                    onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="tx-file">Makbuz / Fatura Dosyası</label>
                  <input
                    id="tx-file"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="form-input"
                    onChange={(e) => setFormData({ ...formData, receipt_file: e.target.files?.[0] || null })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="tx-desc">Açıklama <span className="required">*</span></label>
                <input
                  id="tx-desc"
                  type="text"
                  className="form-input"
                  placeholder="Örn: Haziran ayı ortak elektrik faturası ödemesi"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>İptal</button>
              <button type="submit" className="btn btn-primary" disabled={actionLoading || uploading}>
                {actionLoading || uploading ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
