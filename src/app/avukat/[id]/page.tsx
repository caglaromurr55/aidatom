'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { LegalCase, LegalCaseAction, LegalCollection } from '@/types';
import { 
  Scale, 
  Wallet, 
  Plus, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  History, 
  Building2, 
  User, 
  Edit3, 
  X,
  CreditCard,
  DollarSign
} from 'lucide-react';

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
  const [collections, setCollections] = useState<LegalCollection[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Modals
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add Action form
  const [actionType, setActionType] = useState('icra_takip_basladi');
  const [actionDesc, setActionDesc] = useState('');

  // Update Status form
  const [caseStatus, setCaseStatus] = useState<string>('pending');

  // Edit Lawyer Fee & Court Expenses form
  const [feeForm, setFeeForm] = useState({
    attorney_fee: 0,
    court_expenses: 0,
  });

  // Add Collection form
  const [collectionForm, setCollectionForm] = useState({
    amount: 0,
    payment_method: 'bank_transfer',
    notes: '',
  });

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
    const typedCase = caseData as LegalCaseDetails;
    setLegalCase(typedCase);
    setCaseStatus(typedCase.status);
    setFeeForm({
      attorney_fee: Number(typedCase.attorney_fee || 0),
      court_expenses: Number(typedCase.court_expenses || 0),
    });

    // 2. Get linked charges
    const { data: linkedCharges } = await supabase
      .from('legal_case_charges')
      .select(`
        charge_id,
        charges (
          id,
          amount,
          paid_amount,
          period_month,
          period_year,
          due_date,
          late_fee_amount,
          status,
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

    // 4. Get legal collections history
    const { data: collectionsData } = await supabase
      .from('legal_collections')
      .select('*')
      .eq('legal_case_id', caseId)
      .order('collection_date', { ascending: false });
    setCollections((collectionsData as LegalCollection[]) || []);

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
      setSuccess('Hukuki işlem kaydı eklendi.');
      await loadCaseData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Update Lawyer Fee & Court Expenses
  const handleUpdateFees = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');

    try {
      const { error: dbError } = await supabase
        .from('legal_cases')
        .update({
          attorney_fee: feeForm.attorney_fee,
          court_expenses: feeForm.court_expenses,
        })
        .eq('id', caseId);

      if (dbError) throw dbError;

      setSuccess('Vekalet ücreti ve icra masrafları güncellendi.');
      setFeeModalOpen(false);
      await loadCaseData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'icra_takip_basladi': return 'İcra Takibi Başlatıldı';
      case 'odeme_emri_gonderildi': return 'Ödeme Emri Gönderildi';
      case 'haciz_talebi': return 'Haciz Talebi Yapıldı';
      case 'borclu_gorusme': return 'Borçlu ile Görüşüldü';
      case 'kismen_tahsilat': return 'Kısmi Tahsilat Anlaşması';
      case 'dava_acildi': return 'Dava Açıldı';
      default: return type;
    }
  };

  // Handle Waterfall Collection Execution
  const handleAddCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputAmount = Number(collectionForm.amount);
    if (!inputAmount || inputAmount <= 0) {
      setError('Lütfen geçerli bir tahsilat tutarı giriniz.');
      return;
    }

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !legalCase) return;

      const totalCaseDebt = Number(legalCase.total_debt) + Number(legalCase.total_late_fee) + Number(legalCase.court_expenses) + Number(legalCase.attorney_fee);
      const currentCollected = Number(legalCase.collected_amount || 0);
      const newCollectedTotal = currentCollected + inputAmount;

      // 1. Estimate lawyer fee portion ratio
      const attorneyFeeRatio = Number(legalCase.attorney_fee) > 0 ? (Number(legalCase.attorney_fee) / totalCaseDebt) : 0;
      const attorneyFeePortion = Number((inputAmount * attorneyFeeRatio).toFixed(2));

      // 2. Insert into legal_collections
      const { error: collErr } = await supabase.from('legal_collections').insert({
        legal_case_id: caseId,
        amount: inputAmount,
        attorney_fee_portion: attorneyFeePortion,
        collection_date: new Date().toISOString(),
        payment_method: collectionForm.payment_method,
        notes: collectionForm.notes || 'İcra Dairesi / Avukat Tahsilatı',
        created_by: user.id,
      });

      if (collErr) throw collErr;

      // 3. Update legal_cases collected_amount and status
      const isFullyCollected = newCollectedTotal >= totalCaseDebt;
      const newCaseStatus = isFullyCollected ? 'collected' : 'partially_collected';

      await supabase
        .from('legal_cases')
        .update({
          collected_amount: newCollectedTotal,
          status: newCaseStatus,
          closed_at: isFullyCollected ? new Date().toISOString() : null,
        })
        .eq('id', caseId);

      // 4. Linearly distribute collection across linked charges
      let remainingPaymentToDistribute = inputAmount;
      for (const charge of charges) {
        if (remainingPaymentToDistribute <= 0) break;

        const chargeTotal = Number(charge.amount);
        const currentChargePaid = Number(charge.paid_amount || 0);
        const chargeRemainingDebt = chargeTotal - currentChargePaid;

        if (chargeRemainingDebt > 0) {
          const payForThisCharge = Math.min(remainingPaymentToDistribute, chargeRemainingDebt);
          const newChargePaid = currentChargePaid + payForThisCharge;
          const isChargePaid = newChargePaid >= chargeTotal;

          await supabase
            .from('charges')
            .update({
              paid_amount: newChargePaid,
              status: isChargePaid ? 'paid' : 'partially_paid',
              paid_at: new Date().toISOString(),
              paid_by: user.id,
            })
            .eq('id', charge.id);

          remainingPaymentToDistribute -= payForThisCharge;
        }
      }

      // 5. Automatically insert Income (Gelir) into Site Cashbox
      await supabase.from('income_expense').insert({
        site_id: legalCase.site_id,
        type: 'income',
        category: 'İcra Alacak Tahsilatı',
        amount: inputAmount,
        description: `İcra Tahsilatı - Sakin: ${legalCase.residents?.full_name || 'Borçlu'} (Not: ${collectionForm.notes || 'Banka/İcra'})`,
        transaction_date: new Date().toISOString(),
        recorded_by: user.id,
      });

      setSuccess(`Tahsilat kaydı (${formatCurrency(inputAmount)}) başarıyla işlendi, borçlar ve site kasası güncellendi.`);
      setCollectionModalOpen(false);
      setCollectionForm({ amount: 0, payment_method: 'bank_transfer', notes: '' });
      await loadCaseData();

    } catch (err: any) {
      setError(err.message || 'Tahsilat işlenirken bir hata oluştu.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Update Status Only
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');

    try {
      const { error: dbError } = await supabase
        .from('legal_cases')
        .update({
          status: caseStatus as any,
          closed_at: caseStatus === 'closed' || caseStatus === 'collected' ? new Date().toISOString() : null,
        })
        .eq('id', caseId);

      if (dbError) throw dbError;

      setSuccess('Dosya durumu güncellendi.');
      setStatusModalOpen(false);
      await loadCaseData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-body">
        <div className="card" style={{ height: 180, opacity: 0.6, marginBottom: '1.5rem' }}></div>
      </div>
    );
  }

  if (!legalCase) {
    return (
      <div className="page-body">
        <div className="empty-state">
          <div className="icon">
            <Scale size={32} />
          </div>
          <h3>Dosya Bulunamadı</h3>
          <p>Böyle bir icra dosyası bulunmamaktadır.</p>
        </div>
      </div>
    );
  }

  const baseDebt = Number(legalCase.total_debt);
  const lateFee = Number(legalCase.total_late_fee);
  const courtExpenses = Number(legalCase.court_expenses || 0);
  const attorneyFee = Number(legalCase.attorney_fee || 0);
  const totalGrandDebt = baseDebt + lateFee + courtExpenses + attorneyFee;
  const collectedTotal = Number(legalCase.collected_amount || 0);
  const remainingTotal = Math.max(0, totalGrandDebt - collectedTotal);

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 className="heading-md">{legalCase.residents?.full_name} — İcra Takip Detayı</h1>
              <span className="badge badge-warning">{legalCase.status}</span>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building2 size={16} /> {legalCase.sites?.name} &nbsp;|&nbsp; 🏢 Daire: {legalCase.residents?.units?.unit_number} ({legalCase.residents?.units?.blocks?.name})
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setFeeModalOpen(true)}>
              <Edit3 size={16} /> Vekalet / Masraf Gir
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setCollectionModalOpen(true)}>
              <Plus size={16} /> Tahsilat Gir
            </button>
          </div>
        </div>
      </div>

      <div className="page-body">
        {success && (
          <div className="badge badge-success" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem', width: '100%', fontSize: '0.9rem' }}>
            <CheckCircle2 size={16} /> {success}
          </div>
        )}
        {error && (
          <div className="badge badge-error" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem', width: '100%', fontSize: '0.9rem' }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Financial Summary Cards */}
        <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card">
            <span className="stat-label">Asıl Aidat Borcu</span>
            <span className="stat-value">{formatCurrency(baseDebt)}</span>
          </div>

          <div className="stat-card">
            <span className="stat-label">Gecikme Zammı</span>
            <span className="stat-value" style={{ color: 'var(--warning)' }}>+{formatCurrency(lateFee)}</span>
          </div>

          <div className="stat-card">
            <span className="stat-label">Vekalet Ücreti & Masraf</span>
            <span className="stat-value" style={{ color: 'var(--color-navy)' }}>+{formatCurrency(attorneyFee + courtExpenses)}</span>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Hakediş: {formatCurrency(attorneyFee)}</span>
          </div>

          <div className="stat-card">
            <span className="stat-label">Tahsil Edilen Tutar</span>
            <span className="stat-value" style={{ color: 'var(--success)' }}>{formatCurrency(collectedTotal)}</span>
          </div>

          <div className="stat-card" style={{ borderColor: 'var(--color-teal)' }}>
            <span className="stat-label">Kalan Toplam Alacak</span>
            <span className="stat-value" style={{ color: 'var(--error)' }}>{formatCurrency(remainingTotal)}</span>
          </div>
        </div>

        {/* Main Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Left Column: Linked Charges & Collections History */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Linked Charges */}
            <div className="card">
              <h2 className="heading-sm" style={{ fontSize: '1.05rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wallet size={18} style={{ color: 'var(--color-teal)' }} /> Dosyaya Bağlı Borç Kalemleri
              </h2>
              {charges.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Bağlı borç bulunmuyor.</p>
              ) : (
                <div className="table-wrapper">
                  <table className="table" style={{ fontSize: '0.875rem' }}>
                    <thead>
                      <tr>
                        <th>Dönem / Tür</th>
                        <th>Vade</th>
                        <th>Tutar</th>
                        <th>Ödenen</th>
                        <th>Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {charges.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{c.charge_types?.name || 'Aidat'}</div>
                            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{c.period_month}/{c.period_year}</div>
                          </td>
                          <td className="text-xs">{new Date(c.due_date).toLocaleDateString('tr-TR')}</td>
                          <td style={{ fontWeight: 600 }}>{formatCurrency(c.amount)}</td>
                          <td style={{ color: 'var(--success)', fontWeight: 600 }}>{formatCurrency(c.paid_amount || 0)}</td>
                          <td>
                            <span className={`badge ${c.status === 'paid' ? 'badge-success' : c.status === 'partially_paid' ? 'badge-warning' : 'badge-error'}`}>
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Legal Collections History */}
            <div className="card">
              <h2 className="heading-sm" style={{ fontSize: '1.05rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={18} style={{ color: 'var(--color-teal)' }} /> Tahsilat Geçmişi ({collections.length})
              </h2>
              {collections.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Henüz yapılan bir tahsilat kaydı yok.</p>
              ) : (
                <div className="table-wrapper">
                  <table className="table" style={{ fontSize: '0.875rem' }}>
                    <thead>
                      <tr>
                        <th>Tahsilat Tarihi</th>
                        <th>Tutar</th>
                        <th>Vekalet Hakedişi</th>
                        <th>Ödeme Yolu</th>
                        <th>Notlar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collections.map((col) => (
                        <tr key={col.id}>
                          <td className="text-xs">{formatDateTime(col.collection_date)}</td>
                          <td style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(col.amount)}</td>
                          <td style={{ fontWeight: 600, color: 'var(--color-navy)' }}>{formatCurrency(col.attorney_fee_portion)}</td>
                          <td className="text-xs">{col.payment_method === 'bank_transfer' ? 'Banka Havalesi' : col.payment_method === 'cash' ? 'Nakit' : 'Kredi Kartı'}</td>
                          <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{col.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Actions History & Add Action */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 className="heading-sm" style={{ fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} style={{ color: 'var(--color-teal)' }} /> Hukuki İşlem Geçmişi
              </h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setActionModalOpen(true)}>
                <Plus size={14} /> İşlem Ekle
              </button>
            </div>

            {actions.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Henüz hukuki işlem kaydı bulunmuyor.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {actions.map((act) => (
                  <div key={act.id} style={{ borderLeft: '3px solid var(--color-teal)', paddingLeft: '0.875rem', paddingTop: '4px', paddingBottom: '4px' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{getActionLabel(act.action_type)}</div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{act.description}</div>
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '4px' }}>{formatDateTime(act.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Add Collection */}
      {collectionModalOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 className="heading-sm" style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wallet size={20} style={{ color: 'var(--color-teal)' }} /> İcra Tahsilatı Ekle
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setCollectionModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddCollection}>
              <div className="form-group">
                <label className="form-label">Tahsil Edilen Tutar (₺) <span className="required">*</span></label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  placeholder="0.00"
                  value={collectionForm.amount || ''}
                  onChange={(e) => setCollectionForm({ ...collectionForm, amount: Number(e.target.value) })}
                  required
                />
                <span className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  Kalan Toplam Borç: <strong>{formatCurrency(remainingTotal)}</strong>
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Ödeme Yöntemi</label>
                <select
                  className="form-input"
                  value={collectionForm.payment_method}
                  onChange={(e) => setCollectionForm({ ...collectionForm, payment_method: e.target.value })}
                >
                  <option value="bank_transfer">İcra Dairesi / Banka Havalesi</option>
                  <option value="cash">Elden / Nakit Tahsilat</option>
                  <option value="credit_card">Kredi Kartı / POS</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Tahsilat Notu & Makbuz</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Örn: 2026/123 Esas icra dairesi hesabından hesaba geçen tutar..."
                  value={collectionForm.notes}
                  onChange={(e) => setCollectionForm({ ...collectionForm, notes: e.target.value })}
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setCollectionModalOpen(false)}>İptal</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading || collectionForm.amount <= 0}>
                  {actionLoading ? 'İşleniyor...' : 'Tahsilatı Onayla & Kasaya İşle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Lawyer Fees */}
      {feeModalOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 450 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 className="heading-sm" style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={20} style={{ color: 'var(--color-teal)' }} /> Vekalet Ücreti & Masraf
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setFeeModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateFees}>
              <div className="form-group">
                <label className="form-label">Avukatlık Vekalet Ücreti (Hakediş ₺)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={feeForm.attorney_fee}
                  onChange={(e) => setFeeForm({ ...feeForm, attorney_fee: Number(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Dava / İcra Takip Masrafları (₺)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={feeForm.court_expenses}
                  onChange={(e) => setFeeForm({ ...feeForm, court_expenses: Number(e.target.value) })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setFeeModalOpen(false)}>İptal</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Kaydediliyor...' : 'Tutarları Güncelle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Action Log */}
      {actionModalOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 className="heading-sm" style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={20} style={{ color: 'var(--color-teal)' }} /> Hukuki İşlem Ekle
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setActionModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddAction}>
              <div className="form-group">
                <label className="form-label">İşlem Türü</label>
                <select
                  className="form-input"
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                >
                  <option value="icra_takip_basladi">İcra Takibi Başlatıldı</option>
                  <option value="odeme_emri_gonderildi">Ödeme Emri Gönderildi</option>
                  <option value="haciz_talebi">Haciz Talebi Yapıldı</option>
                  <option value="borclu_gorusme">Borçlu ile Görüşüldü</option>
                  <option value="kismen_tahsilat">Kısmi Tahsilat Anlaşması</option>
                  <option value="dava_acildi">Dava Açıldı</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Açıklama & Detay <span className="required">*</span></label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="İşlem detayını buraya yazın..."
                  value={actionDesc}
                  onChange={(e) => setActionDesc(e.target.value)}
                  required
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActionModalOpen(false)}>İptal</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading || !actionDesc.trim()}>
                  {actionLoading ? 'Ekleniyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
