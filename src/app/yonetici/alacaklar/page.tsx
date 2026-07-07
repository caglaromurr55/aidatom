'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { calculateLateFee } from '@/lib/late-fee-calculator';
import { formatCurrency, CHARGE_STATUS_LABELS } from '@/lib/utils';
import type { Site, Block, Unit, Charge } from '@/types';

interface ChargeWithDetails extends Charge {
  residents: { full_name: string; phone: string } | null;
  units: {
    unit_number: string;
    dues_amount: number;
    blocks: {
      name: string;
      sites: Site;
    };
  } | null;
}

export default function AlacaklarPage() {
  const supabase = createClient();
  const [charges, setCharges] = useState<ChargeWithDetails[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filter states
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState<ChargeWithDetails | null>(null);
  const [reverseModalOpen, setReverseModalOpen] = useState<ChargeWithDetails | null>(null);

  // Bulk Billing Form State
  const [bulkForm, setBulkForm] = useState({
    site_id: '',
    block_id: 'all', // all or specific block
    charge_name: 'Aidat', // Aidat, Demirbaş Avansı, etc.
    period_month: new Date().getMonth() + 1,
    period_year: new Date().getFullYear(),
    amount_type: 'default', // default (from unit) or custom
    custom_amount: 0,
    due_date: new Date(new Date().setDate(new Date().getDate() + 15)).toISOString().split('T')[0], // 15 days from now
  });

  // Pay Form State
  const [payAmount, setPayAmount] = useState(0);

  // Reverse Form State
  const [reverseReason, setReverseReason] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Load Sites
    const { data: sitesData } = await supabase
      .from('sites')
      .select('*')
      .eq('manager_id', user.id)
      .is('deleted_at', null);
    
    const loadedSites = (sitesData as Site[]) || [];
    setSites(loadedSites);

    const siteIds = loadedSites.map((s) => s.id);

    if (siteIds.length > 0) {
      // Load Blocks for filtering
      const { data: blocksData } = await supabase
        .from('blocks')
        .select('*')
        .in('site_id', siteIds)
        .is('deleted_at', null);
      setBlocks((blocksData as Block[]) || []);

      // Load Charges
      const { data: chargesData } = await supabase
        .from('charges')
        .select(`
          *,
          residents (full_name, phone),
          units (
            unit_number,
            dues_amount,
            blocks (
              name,
              sites (
                id,
                manager_id,
                name,
                address,
                city,
                district,
                total_units,
                dues_type,
                default_dues_amount,
                late_fee_type,
                late_fee_rate
              )
            )
          )
        `)
        .order('due_date', { ascending: false });

      // Enforce manager check on client side because nested joins might pull everything
      const filteredCharges = ((chargesData as any[]) || []).filter((c) => 
        c.units?.blocks?.sites?.manager_id === user.id
      );

      setCharges(filteredCharges as ChargeWithDetails[]);
    } else {
      setCharges([]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Bulk Billing
  const handleBulkBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!bulkForm.site_id) {
      setError('Lütfen bir site seçin.');
      return;
    }

    setActionLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Get units to bill
      let query = supabase
        .from('units')
        .select('id, dues_amount, block_id, blocks!inner(site_id)')
        .eq('blocks.site_id', bulkForm.site_id);

      if (bulkForm.block_id !== 'all') {
        query = query.eq('block_id', bulkForm.block_id);
      }

      const { data: unitsToBill, error: unitsError } = await query;
      if (unitsError) throw unitsError;

      if (!unitsToBill || unitsToBill.length === 0) {
        setError('Borçlandırılacak daire bulunamadı.');
        setActionLoading(false);
        return;
      }

      // 2. Get or create charge type
      let chargeTypeId = '';
      const { data: existingType } = await supabase
        .from('charge_types')
        .select('id')
        .eq('site_id', bulkForm.site_id)
        .eq('name', bulkForm.charge_name)
        .single();

      if (existingType) {
        chargeTypeId = existingType.id;
      } else {
        const { data: newType, error: typeError } = await supabase
          .from('charge_types')
          .insert({
            site_id: bulkForm.site_id,
            name: bulkForm.charge_name,
            is_recurring: true,
          })
          .select('id')
          .single();
        if (typeError) throw typeError;
        chargeTypeId = newType.id;
      }

      // 3. Generate charges for each unit
      const chargeInserts = [];
      for (const unit of unitsToBill) {
        // Find active resident for this unit
        const { data: resident } = await supabase
          .from('residents')
          .select('id')
          .eq('unit_id', unit.id)
          .eq('is_active', true)
          .single();

        if (resident) {
          const finalAmount = bulkForm.amount_type === 'default' ? Number(unit.dues_amount) : Number(bulkForm.custom_amount);
          chargeInserts.push({
            resident_id: resident.id,
            unit_id: unit.id,
            charge_type_id: chargeTypeId,
            period_month: Number(bulkForm.period_month),
            period_year: Number(bulkForm.period_year),
            amount: finalAmount,
            due_date: bulkForm.due_date,
            status: 'pending',
          });
        }
      }

      if (chargeInserts.length === 0) {
        setError('Seçili dairelerde kayıtlı aktif sakin bulunmamaktadır.');
        setActionLoading(false);
        return;
      }

      const { error: insertError } = await supabase.from('charges').insert(chargeInserts);
      if (insertError) throw insertError;

      // Log audit
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'bulk_billing_created',
        entity_type: 'site',
        entity_id: bulkForm.site_id,
        new_values: { type: bulkForm.charge_name, count: chargeInserts.length },
      });

      setSuccess(`Başarıyla ${chargeInserts.length} daire için borçlandırma oluşturuldu.`);
      setBulkModalOpen(false);
      await loadData();
    } catch (err: any) {
      setError('Borçlandırma yapılırken hata oluştu: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Pay Charge
  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalOpen) return;

    setActionLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newPaidAmount = Number(payModalOpen.paid_amount) + Number(payAmount);
      const isFullyPaid = newPaidAmount >= Number(payModalOpen.amount);

      const { error: dbError } = await supabase
        .from('charges')
        .update({
          paid_amount: newPaidAmount,
          paid_at: new Date().toISOString(),
          paid_by: user.id,
          status: isFullyPaid ? 'paid' : 'partially_paid',
        })
        .eq('id', payModalOpen.id);

      if (dbError) throw dbError;

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'payment_received',
        entity_type: 'charge',
        entity_id: payModalOpen.id,
        new_values: { amount: payAmount, final_status: isFullyPaid ? 'paid' : 'partially_paid' },
      });

      setPayModalOpen(null);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reverse Payment
  const handleReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reverseModalOpen || !reverseReason.trim()) return;

    setActionLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create payment reversal log
      const { error: revError } = await supabase.from('payment_reversals').insert({
        charge_id: reverseModalOpen.id,
        reversed_by: user.id,
        original_paid_amount: reverseModalOpen.paid_amount,
        reason: reverseReason,
      });

      if (revError) throw revError;

      // Reset charge payment values
      const { error: dbError } = await supabase
        .from('charges')
        .update({
          paid_amount: 0,
          paid_at: null,
          paid_by: null,
          status: 'pending',
        })
        .eq('id', reverseModalOpen.id);

      if (dbError) throw dbError;

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'payment_reversed',
        entity_type: 'charge',
        entity_id: reverseModalOpen.id,
        new_values: { reason: reverseReason },
      });

      setReverseModalOpen(null);
      setReverseReason('');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Filters logic
  const filteredCharges = charges.filter((c) => {
    const matchesSite = siteFilter === 'all' || c.units?.blocks?.sites?.id === siteFilter;
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesSearch =
      c.residents?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.units?.unit_number.includes(searchTerm);

    return matchesSite && matchesStatus && matchesSearch;
  });

  if (loading && charges.length === 0) {
    return (
      <div className="page-body">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-md)' }}></div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
        <div>
          <h1 className="heading-sm">Aidat ve Alacak Takibi</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>
            Daire bazlı aidat ve demirbaş ödemelerini yönetin, manuel tahsilat girin.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setBulkModalOpen(true)} disabled={sites.length === 0}>
          💰 Toplu Borçlandır
        </button>
      </div>

      <div className="page-body">
        {success && (
          <div className="auth-alert success" style={{ marginBottom: 'var(--space-lg)' }}>
            <span>✓</span>
            <span>{success}</span>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Sakin adı veya daire no ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ width: 180 }}>
            <select
              className="form-input"
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              aria-label="Site Filtresi"
            >
              <option value="all">Tüm Siteler</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={{ width: 150 }}>
            <select
              className="form-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Durum Filtresi"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="pending">Bekliyor</option>
              <option value="paid">Ödendi</option>
              <option value="overdue">Gecikmiş</option>
              <option value="partially_paid">Kısmen Ödendi</option>
              <option value="sent_to_legal">İcradaki Dosya</option>
            </select>
          </div>
        </div>

        {/* Charges Table */}
        {filteredCharges.length === 0 ? (
          <div className="empty-state">
            <div className="icon">💰</div>
            <h3>Alacak Kaydı Bulunmamaktadır</h3>
            <p>Seçtiğiniz kriterlere uygun alacak kaydı bulunmuyor.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Sakin / Daire</th>
                  <th>Site</th>
                  <th>Dönem</th>
                  <th>Borç Tutarı</th>
                  <th>Tahsil Edilen</th>
                  <th>Gecikme Faizi</th>
                  <th>Son Ödeme</th>
                  <th>Durum</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredCharges.map((charge) => {
                  const site = charge.units?.blocks?.sites;
                  const lateFee = charge.status === 'overdue' && site
                    ? calculateLateFee(charge.amount, charge.due_date, null, site)
                    : Number(charge.late_fee_amount);

                  return (
                    <tr key={charge.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{charge.residents?.full_name || 'Tanımsız Sakin'}</div>
                        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {charge.units?.blocks?.name} - Daire {charge.units?.unit_number}
                        </div>
                      </td>
                      <td className="text-sm">{site?.name || '-'}</td>
                      <td>{charge.period_month}/{charge.period_year}</td>
                      <td style={{ fontWeight: 600 }}>{charge.amount} ₺</td>
                      <td style={{ color: 'var(--success-light)' }}>{charge.paid_amount} ₺</td>
                      <td style={{ color: lateFee > 0 ? 'var(--warning-light)' : undefined }}>
                        {lateFee > 0 ? `+${lateFee} ₺` : '0 ₺'}
                      </td>
                      <td className="text-sm">{new Date(charge.due_date).toLocaleDateString('tr-TR')}</td>
                      <td>
                        <span className={`badge ${
                          charge.status === 'paid' ? 'badge-success' :
                          charge.status === 'overdue' ? 'badge-error' :
                          charge.status === 'partially_paid' ? 'badge-warning' : 'badge-neutral'
                        }`}>
                          {CHARGE_STATUS_LABELS[charge.status] || charge.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                          {charge.status !== 'paid' && charge.status !== 'sent_to_legal' && (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => {
                                setPayModalOpen(charge);
                                setPayAmount(Number(charge.amount) - Number(charge.paid_amount));
                              }}
                            >
                              Tahsil Et
                            </button>
                          )}
                          {(charge.status === 'paid' || charge.status === 'partially_paid') && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => setReverseModalOpen(charge)}
                            >
                              Geri Al
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk Billing Modal */}
      {bulkModalOpen && (
        <div className="modal-overlay" onClick={() => setBulkModalOpen(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleBulkBilling}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Toplu Borçlandırma Oluştur</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBulkModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {error && <div className="auth-alert error"><span>⚠</span><span>{error}</span></div>}

              <div className="form-group">
                <label className="form-label" htmlFor="bulk-site">Site Seçimi <span className="required">*</span></label>
                <select
                  id="bulk-site"
                  className="form-input"
                  value={bulkForm.site_id}
                  onChange={(e) => {
                    setBulkForm({ ...bulkForm, site_id: e.target.value, block_id: 'all' });
                  }}
                  required
                >
                  <option value="">Seçin...</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="bulk-block">Blok Seçimi</label>
                <select
                  id="bulk-block"
                  className="form-input"
                  value={bulkForm.block_id}
                  onChange={(e) => setBulkForm({ ...bulkForm, block_id: e.target.value })}
                  disabled={!bulkForm.site_id}
                >
                  <option value="all">Tüm Bloklar</option>
                  {blocks.filter(b => b.site_id === bulkForm.site_id).map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="bulk-month">Dönem Ayı</label>
                  <select
                    id="bulk-month"
                    className="form-input"
                    value={bulkForm.period_month}
                    onChange={(e) => setBulkForm({ ...bulkForm, period_month: Number(e.target.value) })}
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                      <option key={m} value={m}>{m} - {new Date(0, m - 1).toLocaleString('tr-TR', { month: 'long' })}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="bulk-year">Dönem Yılı</label>
                  <input
                    id="bulk-year"
                    type="number"
                    className="form-input"
                    value={bulkForm.period_year}
                    onChange={(e) => setBulkForm({ ...bulkForm, period_year: Number(e.target.value) })}
                    min={2020}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="bulk-name">Borç Başlığı (Örn: Aidat, Demirbaş Avansı)</label>
                <input
                  id="bulk-name"
                  type="text"
                  className="form-input"
                  value={bulkForm.charge_name}
                  onChange={(e) => setBulkForm({ ...bulkForm, charge_name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="bulk-amount-type">Tutar Tipi</label>
                  <select
                    id="bulk-amount-type"
                    className="form-input"
                    value={bulkForm.amount_type}
                    onChange={(e) => setBulkForm({ ...bulkForm, amount_type: e.target.value })}
                  >
                    <option value="default">Daire Varsayılan Aidatı</option>
                    <option value="custom">Özel Sabit Tutar</option>
                  </select>
                </div>
                {bulkForm.amount_type === 'custom' && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="bulk-custom-amount">Tutar (₺)</label>
                    <input
                      id="bulk-custom-amount"
                      type="number"
                      className="form-input"
                      value={bulkForm.custom_amount}
                      onChange={(e) => setBulkForm({ ...bulkForm, custom_amount: Number(e.target.value) })}
                      min={0}
                    />
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="bulk-due-date">Son Ödeme Tarihi <span className="required">*</span></label>
                <input
                  id="bulk-due-date"
                  type="date"
                  className="form-input"
                  value={bulkForm.due_date}
                  onChange={(e) => setBulkForm({ ...bulkForm, due_date: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setBulkModalOpen(false)}>İptal</button>
              <button type="submit" className="btn btn-primary" disabled={actionLoading}>Borçlandır</button>
            </div>
          </form>
        </div>
      )}

      {/* Pay Modal */}
      {payModalOpen && (
        <div className="modal-overlay" onClick={() => setPayModalOpen(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handlePay}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Ödeme Tahsil Et</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPayModalOpen(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div>
                <strong>Sakin:</strong> {payModalOpen.residents?.full_name} <br />
                <strong>Daire:</strong> {payModalOpen.units?.blocks?.name} - Daire {payModalOpen.units?.unit_number} <br />
                <strong>Kalan Borç:</strong> {Number(payModalOpen.amount) - Number(payModalOpen.paid_amount)} ₺
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pay-amount">Tahsil Edilen Tutar (₺) <span className="required">*</span></label>
                <input
                  id="pay-amount"
                  type="number"
                  className="form-input"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  max={Number(payModalOpen.amount) - Number(payModalOpen.paid_amount)}
                  min={1}
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setPayModalOpen(null)}>İptal</button>
              <button type="submit" className="btn btn-success" disabled={actionLoading}>Tahsilatı Kaydet</button>
            </div>
          </form>
        </div>
      )}

      {/* Reverse Modal */}
      {reverseModalOpen && (
        <div className="modal-overlay" onClick={() => setReverseModalOpen(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleReverse}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--error-light)' }}>Ödeme İptal / Geri Al</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReverseModalOpen(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div>
                Geri alınacak ödeme: <strong>{reverseModalOpen.paid_amount} ₺</strong> <br />
                Sakin: <strong>{reverseModalOpen.residents?.full_name}</strong>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reverse-reason">Geri Alma Gerekçesi <span className="required">*</span></label>
                <textarea
                  id="reverse-reason"
                  className="form-input"
                  placeholder="Bu ödemenin neden geri alındığını açıklayın..."
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  rows={3}
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setReverseModalOpen(null)}>İptal</button>
              <button type="submit" className="btn btn-danger" disabled={actionLoading || !reverseReason.trim()}>Geri Al</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
