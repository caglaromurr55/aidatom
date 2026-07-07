'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { LegalCase, LegalCaseAction, Charge } from '@/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface LegalCaseDetails extends LegalCase {
  residents: {
    full_name: string;
    phone: string;
    tc_no: string;
    units: {
      unit_number: string;
      blocks: { name: string };
    };
  } | null;
  sites: { name: string } | null;
}

export default function LawyerCaseDetailPage({ params }: PageProps) {
  const { id: caseId } = use(params);
  const supabase = createClient();

  const [legalCase, setLegalCase] = useState<LegalCaseDetails | null>(null);
  const [charges, setCharges] = useState<any[]>([]);
  const [actions, setActions] = useState<LegalCaseAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Modals / Form states
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [error, setError] = useState('');

  // Add Action form
  const [actionType, setActionType] = useState('icra_takip_basladi');
  const [actionDesc, setActionDesc] = useState('');

  // Update Status form
  const [caseStatus, setCaseStatus] = useState<string>('pending');
  const [collectedAmount, setCollectedAmount] = useState(0);

  const loadCaseData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Get legal case
    const { data: caseData } = await supabase
      .from('legal_cases')
      .select(`
        *,
        residents (
          full_name,
          phone,
          tc_no,
          units (
            unit_number,
            blocks (name)
          )
        ),
        sites (name)
      `)
      .eq('id', caseId)
      .single();

    if (!caseData) {
      setLegalCase(null);
      setLoading(false);
      return;
    }
    setLegalCase(caseData as LegalCaseDetails);
    setCaseStatus(caseData.status);
    setCollectedAmount(Number(caseData.collected_amount));

    // 2. Get linked charges
    const { data: linkedCharges } = await supabase
      .from('legal_case_charges')
      .select(`
        charge_id,
        charges (
          id,
          amount,
          period_month,
          period_year,
          due_date,
          late_fee_amount,
          charge_types (name)
        )
      `)
      .eq('legal_case_id', caseId);

    const extractedCharges = linkedCharges?.map((lc) => lc.charges) || [];
    setCharges(extractedCharges);

    // 3. Get legal case actions
    const { data: actionsData } = await supabase
      .from('legal_case_actions')
      .select('*')
      .eq('legal_case_id', caseId)
      .order('created_at', { ascending: false });
    
    setActions((actionsData as LegalCaseAction[]) || []);
    setLoading(false);
  }, [supabase, caseId]);

  useEffect(() => {
    loadCaseData();
  }, [loadCaseData]);

  // Handle Add Action Log
  const handleAddAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionDesc.trim()) return;

    setActionLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: dbError } = await supabase.from('legal_case_actions').insert({
        legal_case_id: caseId,
        action_by: user.id,
        action_type: actionType,
        description: actionDesc,
      });

      if (dbError) throw dbError;

      // Update case status automatically depending on action
      let newStatus = legalCase?.status || 'pending';
      if (actionType === 'icra_takip_basladi' && legalCase?.status === 'pending') {
        newStatus = 'in_progress';
        await supabase.from('legal_cases').update({ status: 'in_progress' }).eq('id', caseId);
      }

      // Log audit
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'legal_action_added',
        entity_type: 'legal_case_action',
        entity_id: caseId,
        new_values: { type: actionType, desc: actionDesc, new_status: newStatus },
      });

      setActionModalOpen(false);
      setActionDesc('');
      await loadCaseData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Update Status & Collected Amount
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: dbError } = await supabase
        .from('legal_cases')
        .update({
          status: caseStatus as any,
          collected_amount: collectedAmount,
          closed_at: caseStatus === 'closed' ? new Date().toISOString() : null,
        })
        .eq('id', caseId);

      if (dbError) throw dbError;

      // If fully collected, update nested charges to paid
      if (caseStatus === 'collected' || caseStatus === 'closed') {
        const chargeIds = charges.map((c) => c.id);
        if (chargeIds.length > 0) {
          await supabase
            .from('charges')
            .update({ status: 'paid', paid_amount: collectedAmount })
            .in('id', chargeIds);
        }
      }

      // Log audit
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'legal_case_status_updated',
        entity_type: 'legal_case',
        entity_id: caseId,
        new_values: { status: caseStatus, collected: collectedAmount },
      });

      setStatusModalOpen(false);
      await loadCaseData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'icra_takip_basladi': return '⚖️ İcra Takibi Başlatıldı';
      case 'odeme_emri_gonderildi': return '✉️ Ödeme Emri Gönderildi';
      case 'haciz_talebi': return '🚫 Haciz Talebi Yapıldı';
      case 'borclu_gorusme': return '📞 Borçlu ile Görüşüldü';
      case 'kismen_tahsilat': return '💵 Kısmi Tahsilat Yapıldı';
      case 'dava_acildi': return '🏛️ Dava Açıldı';
      default: return `📝 İşlem: ${type}`;
    }
  };

  if (loading) {
    return (
      <div className="page-body">
        <div className="skeleton" style={{ height: 60, marginBottom: 'var(--space-xl)' }}></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)' }}>
          <div className="skeleton" style={{ height: 300 }}></div>
          <div className="skeleton" style={{ height: 300 }}></div>
        </div>
      </div>
    );
  }

  if (!legalCase) {
    return (
      <div className="page-body">
        <div className="empty-state">
          <div className="icon">⚖️</div>
          <h3>Dosya Bulunamadı</h3>
          <p>Böyle bir icra dosyası bulunmamaktadır.</p>
        </div>
      </div>
    );
  }

  const totalDebt = Number(legalCase.total_debt) + Number(legalCase.total_late_fee);

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
        <div>
          <h1 className="heading-sm">İcra Takip Dosyası: {legalCase.residents?.full_name}</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>
            🏢 {legalCase.sites?.name} &nbsp;|&nbsp; Daire {legalCase.residents?.units?.unit_number} ({legalCase.residents?.units?.blocks?.name})
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button className="btn btn-secondary" onClick={() => setStatusModalOpen(true)}>
            ⚙️ Durum & Tahsilat Güncelle
          </button>
          <button className="btn btn-primary" onClick={() => setActionModalOpen(true)}>
            📝 Yeni İşlem Kaydı
          </button>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--space-xl)', alignItems: 'start' }}>
          
          {/* Left Column: Details & Charges */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
            {/* Case Details */}
            <div className="card">
              <h2 className="heading-sm" style={{ fontSize: '1.125rem', marginBottom: 'var(--space-lg)' }}>Dosya Bilgileri</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', fontSize: '0.9375rem' }}>
                <div>
                  <span style={{ color: 'var(--text-tertiary)' }}>Borçlu Adı Soyadı:</span> <br />
                  <strong>{legalCase.residents?.full_name}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-tertiary)' }}>TC Kimlik Numarası:</span> <br />
                  <strong>{legalCase.residents?.tc_no}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-tertiary)' }}>Telefon:</span> <br />
                  <strong>{legalCase.residents?.phone ? `+90 ${legalCase.residents.phone}` : '-'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-tertiary)' }}>Devir Tarihi:</span> <br />
                  <strong>{new Date(legalCase.referred_at).toLocaleString('tr-TR')}</strong>
                </div>
              </div>

              <div style={{
                marginTop: 'var(--space-xl)',
                padding: 'var(--space-md)',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-primary)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                textAlign: 'center',
              }}>
                <div>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>ASIL ALACAK</span> <br />
                  <span style={{ fontWeight: 600 }}>{formatCurrency(legalCase.total_debt)}</span>
                </div>
                <div>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>GECİKME FAİZİ</span> <br />
                  <span style={{ fontWeight: 600, color: 'var(--warning-light)' }}>+{formatCurrency(legalCase.total_late_fee)}</span>
                </div>
                <div>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>TOPLAM BORÇ</span> <br />
                  <span style={{ fontWeight: 700, color: 'var(--error-light)' }}>{formatCurrency(totalDebt)}</span>
                </div>
              </div>
            </div>

            {/* Referred Charges */}
            <div className="card">
              <h2 className="heading-sm" style={{ fontSize: '1.125rem', marginBottom: 'var(--space-md)' }}>Borç Detayları</h2>
              <div className="table-wrapper">
                <table className="table" style={{ fontSize: '0.875rem' }}>
                  <thead>
                    <tr>
                      <th>Dönem</th>
                      <th>Kalem</th>
                      <th>Asıl Borç</th>
                      <th>Gecikme Faizi</th>
                      <th>Son Ödeme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {charges.map((c) => (
                      <tr key={c.id}>
                        <td>{c.period_month}/{c.period_year}</td>
                        <td>{c.charge_types?.name || 'Aidat'}</td>
                        <td style={{ fontWeight: 600 }}>{c.amount} ₺</td>
                        <td style={{ color: 'var(--warning-light)' }}>{c.late_fee_amount} ₺</td>
                        <td>{new Date(c.due_date).toLocaleDateString('tr-TR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Actions Timeline */}
          <div className="card">
            <h2 className="heading-sm" style={{ fontSize: '1.125rem', marginBottom: 'var(--space-lg)' }}>Hukuki İşlem Geçmişi</h2>
            {actions.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--space-lg) 0' }}>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Henüz girilmiş bir işlem kaydı yok.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', position: 'relative' }}>
                {actions.map((act) => (
                  <div key={act.id} style={{ display: 'flex', gap: 'var(--space-md)', borderBottom: '1px solid var(--border-primary)', paddingBottom: 'var(--space-md)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '4px' }}>
                        {getActionLabel(act.action_type)}
                      </div>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {act.description}
                      </p>
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '8px', display: 'block' }}>
                        📅 {formatDateTime(act.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Action Modal */}
      {actionModalOpen && (
        <div className="modal-overlay" onClick={() => setActionModalOpen(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleAddAction}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Yeni İşlem Kaydı Gir</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActionModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {error && <div className="auth-alert error"><span>⚠</span><span>{error}</span></div>}
              
              <div className="form-group">
                <label className="form-label" htmlFor="action-type">İşlem Türü</label>
                <select
                  id="action-type"
                  className="form-input"
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                >
                  <option value="icra_takip_basladi">⚖️ İcra Takibi Başlatıldı</option>
                  <option value="odeme_emri_gonderildi">✉️ Ödeme Emri Gönderildi tebliğ edildi</option>
                  <option value="haciz_talebi">🚫 Haciz Talebi Yapıldı</option>
                  <option value="borclu_gorusme">📞 Borçlu ile Görüşüldü</option>
                  <option value="kismen_tahsilat">💵 Kısmi Tahsilat Yapıldı</option>
                  <option value="dava_acildi">🏛️ Dava Açıldı</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="action-desc">Açıklama / Notlar <span className="required">*</span></label>
                <textarea
                  id="action-desc"
                  className="form-input"
                  placeholder="Yapılan işlem detaylarını veya borçlu ile görüşme notlarını buraya girin..."
                  value={actionDesc}
                  onChange={(e) => setActionDesc(e.target.value)}
                  rows={4}
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setActionModalOpen(false)}>İptal</button>
              <button type="submit" className="btn btn-primary" disabled={actionLoading || !actionDesc.trim()}>Kaydet</button>
            </div>
          </form>
        </div>
      )}

      {/* Update Status & Collection Modal */}
      {statusModalOpen && (
        <div className="modal-overlay" onClick={() => setStatusModalOpen(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleUpdateStatus}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Dosya Durumu & Tahsilat</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatusModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {error && <div className="auth-alert error"><span>⚠</span><span>{error}</span></div>}

              <div className="form-group">
                <label className="form-label" htmlFor="case-status">Dosya Güncel Durumu</label>
                <select
                  id="case-status"
                  className="form-input"
                  value={caseStatus}
                  onChange={(e) => setCaseStatus(e.target.value)}
                >
                  <option value="pending">Onay Bekliyor / Yeni</option>
                  <option value="in_progress">İcra Takibinde</option>
                  <option value="collected">Tamamı Tahsil Edildi</option>
                  <option value="partially_collected">Kısmen Tahsil Edildi</option>
                  <option value="closed">Dosya Kapatıldı</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="collected-amount">Toplam Tahsil Edilen Tutar (₺)</label>
                <input
                  id="collected-amount"
                  type="number"
                  className="form-input"
                  value={collectedAmount}
                  onChange={(e) => setCollectedAmount(Number(e.target.value))}
                  min={0}
                />
                <p className="form-hint">
                  Dosyadan şimdiye kadar tahsil edilmiş toplam miktar.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setStatusModalOpen(false)}>İptal</button>
              <button type="submit" className="btn btn-primary" disabled={actionLoading}>Güncelle</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
