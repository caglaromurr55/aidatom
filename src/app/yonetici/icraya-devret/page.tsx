'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { calculateLateFee } from '@/lib/late-fee-calculator';
import { formatCurrency } from '@/lib/utils';
import type { Site, Charge } from '@/types';

interface OverdueGroup {
  resident_id: string;
  resident_name: string;
  phone: string;
  block_name: string;
  unit_number: string;
  charges: Charge[];
  totalOriginal: number;
  totalLateFee: number;
}

export default function IcrayaDevretPage() {
  const supabase = createClient();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [overdueGroups, setOverdueGroups] = useState<OverdueGroup[]>([]);
  const [selectedResidentIds, setSelectedResidentIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Details Modal
  const [detailsGroup, setDetailsGroup] = useState<OverdueGroup | null>(null);

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

  const loadOverdueCharges = useCallback(async () => {
    if (!selectedSiteId) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Get site settings for late fee
      const currentSite = sites.find((s) => s.id === selectedSiteId);
      if (!currentSite) return;

      // 1. Get blocks for the site
      const { data: blocks } = await supabase
        .from('blocks')
        .select('id, name')
        .eq('site_id', selectedSiteId)
        .is('deleted_at', null);
      const blockIds = blocks?.map(b => b.id) || [];

      if (blockIds.length === 0) {
        setOverdueGroups([]);
        setLoading(false);
        return;
      }

      // 2. Get units for those blocks
      const { data: units } = await supabase
        .from('units')
        .select('id, unit_number, block_id')
        .in('block_id', blockIds)
        .is('deleted_at', null);
      const unitIds = units?.map(u => u.id) || [];

      if (unitIds.length === 0) {
        setOverdueGroups([]);
        setLoading(false);
        return;
      }

      // 3. Get residents for those units
      const { data: residents } = await supabase
        .from('residents')
        .select('id, full_name, phone, unit_id')
        .in('unit_id', unitIds)
        .eq('is_active', true);
      const residentIds = residents?.map(r => r.id) || [];

      if (residentIds.length === 0) {
        setOverdueGroups([]);
        setLoading(false);
        return;
      }

      // 4. Get overdue or pending past due charges
      const currentDate = new Date().toISOString().split('T')[0];
      const { data: charges } = await supabase
        .from('charges')
        .select('*')
        .in('resident_id', residentIds)
        .or(`status.eq.overdue,and(status.eq.pending,due_date.lt.${currentDate})`);

      if (!charges || charges.length === 0) {
        setOverdueGroups([]);
        setLoading(false);
        return;
      }

      // 5. Group by resident
      const groupsMap: Record<string, OverdueGroup> = {};
      const blocksList = blocks || [];
      const unitsList = units || [];
      const residentsList = residents || [];

      charges.forEach((c: Charge) => {
        const resident = residentsList.find((r) => r.id === c.resident_id);
        const unit = unitsList.find((u) => u.id === c.unit_id);
        const block = blocksList.find((b) => b.id === unit?.block_id);

        if (!resident || !unit || !block) return;

        const lateFee = calculateLateFee(c.amount, c.due_date, null, currentSite);

        if (!groupsMap[c.resident_id]) {
          groupsMap[c.resident_id] = {
            resident_id: c.resident_id,
            resident_name: resident.full_name,
            phone: resident.phone || '-',
            block_name: block.name,
            unit_number: unit.unit_number,
            charges: [],
            totalOriginal: 0,
            totalLateFee: 0,
          };
        }

        groupsMap[c.resident_id].charges.push(c);
        groupsMap[c.resident_id].totalOriginal += (Number(c.amount) - Number(c.paid_amount));
        groupsMap[c.resident_id].totalLateFee += lateFee;
      });

      setOverdueGroups(Object.values(groupsMap));
    } catch (err: any) {
      setError('Veriler yüklenirken hata oluştu: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase, selectedSiteId, sites]);

  useEffect(() => {
    loadOverdueCharges();
  }, [loadOverdueCharges]);

  // Handle Refer to Legal (İcraya Devret)
  const handleReferToLegal = async () => {
    if (selectedResidentIds.length === 0) return;
    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let count = 0;

      for (const resId of selectedResidentIds) {
        const group = overdueGroups.find((g) => g.resident_id === resId);
        if (!group) continue;

        // 1. Create legal case
        const { data: newCase, error: caseErr } = await supabase
          .from('legal_cases')
          .insert({
            resident_id: resId,
            site_id: selectedSiteId,
            referred_by: user.id,
            total_debt: group.totalOriginal,
            total_late_fee: group.totalLateFee,
            status: 'pending',
          })
          .select('id')
          .single();

        if (caseErr) throw caseErr;

        // 2. Link charges to legal case
        const links = group.charges.map((c) => ({
          legal_case_id: newCase.id,
          charge_id: c.id,
        }));
        const { error: linkErr } = await supabase.from('legal_case_charges').insert(links);
        if (linkErr) throw linkErr;

        // 3. Update charges status to 'sent_to_legal'
        const chargeIds = group.charges.map((c) => c.id);
        const { error: updateErr } = await supabase
          .from('charges')
          .update({ status: 'sent_to_legal', late_fee_amount: group.totalLateFee })
          .in('id', chargeIds);
        if (updateErr) throw updateErr;

        // 4. Log audit
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'referred_to_legal',
          entity_type: 'legal_case',
          entity_id: newCase.id,
          new_values: { resident: group.resident_name, amount: group.totalOriginal + group.totalLateFee },
        });

        count++;
      }

      setSuccess(`Başarıyla ${count} sakin için icra dosyası oluşturuldu ve avukat ekranına devredildi.`);
      setSelectedResidentIds([]);
      await loadOverdueCharges();
    } catch (err: any) {
      setError('İcra devir işlemi sırasında hata oluştu: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedResidentIds(overdueGroups.map((g) => g.resident_id));
    } else {
      setSelectedResidentIds([]);
    }
  };

  const handleSelectResident = (resId: string, checked: boolean) => {
    if (checked) {
      setSelectedResidentIds([...selectedResidentIds, resId]);
    } else {
      setSelectedResidentIds(selectedResidentIds.filter((id) => id !== resId));
    }
  };

  if (loading && overdueGroups.length === 0 && sites.length === 0) {
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
          <h1 className="heading-sm">İcraya Devretme Paneli</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>
            Ödemesi geciken sakinleri toplu olarak icra sürecine ve hukuk bürosuna devredin.
          </p>
        </div>
        <button
          className="btn btn-danger"
          onClick={handleReferToLegal}
          disabled={selectedResidentIds.length === 0 || actionLoading}
        >
          ⚖️ Seçilenleri İcraya Devret ({selectedResidentIds.length})
        </button>
      </div>

      <div className="page-body">
        {success && <div className="auth-alert success" style={{ marginBottom: 'var(--space-lg)' }}><span>✓</span><span>{success}</span></div>}
        {error && <div className="auth-alert error" style={{ marginBottom: 'var(--space-lg)' }}><span>⚠</span><span>{error}</span></div>}

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

        {overdueGroups.length === 0 ? (
          <div className="empty-state">
            <div className="icon">⚖️</div>
            <h3>Gecikmiş Borcu Olan Sakin Yok</h3>
            <p>Seçili sitede icra sınırına gelmiş veya gecikmiş borç kaydı bulunmamaktadır.</p>
          </div>
        ) : (
          <div className="table-wrapper animate-fade-in">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={selectedResidentIds.length === overdueGroups.length && overdueGroups.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      aria-label="Tümünü Seç"
                    />
                  </th>
                  <th>Daire Sakini / Daire</th>
                  <th>Geciken Ay Sayısı</th>
                  <th>Asıl Alacak</th>
                  <th>Hesaplanan Gecikme Faizi</th>
                  <th>Toplam Borç</th>
                  <th>Detay</th>
                </tr>
              </thead>
              <tbody>
                {overdueGroups.map((group) => {
                  const isChecked = selectedResidentIds.includes(group.resident_id);
                  const totalDebt = group.totalOriginal + group.totalLateFee;

                  return (
                    <tr key={group.resident_id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleSelectResident(group.resident_id, e.target.checked)}
                          aria-label={`${group.resident_name} Seç`}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{group.resident_name}</div>
                        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {group.block_name} - Daire {group.unit_number} &nbsp;|&nbsp; 📞 {group.phone}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-warning">{group.charges.length} Ay</span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{formatCurrency(group.totalOriginal)}</td>
                      <td style={{ color: 'var(--warning-light)' }}>+{formatCurrency(group.totalLateFee)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--error-light)' }}>{formatCurrency(totalDebt)}</td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setDetailsGroup(group)}
                          style={{ color: 'var(--primary-400)' }}
                        >
                          İncele
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Details Modal */}
        {detailsGroup && (
          <div className="modal-overlay" onClick={() => setDetailsGroup(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
              <div className="modal-header">
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>İcra Devir Detayları</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setDetailsGroup(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div style={{ marginBottom: 'var(--space-lg)' }}>
                  <strong>Sakin:</strong> {detailsGroup.resident_name} <br />
                  <strong>Daire:</strong> {detailsGroup.block_name} - Daire {detailsGroup.unit_number} <br />
                  <strong>Telefon:</strong> {detailsGroup.phone}
                </div>

                <h4 className="text-sm" style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)', textTransform: 'uppercase' }}>
                  Geciken Borç Kalemleri
                </h4>

                <div className="table-wrapper" style={{ maxHeight: 250, overflowY: 'auto' }}>
                  <table className="table" style={{ fontSize: '0.875rem' }}>
                    <thead>
                      <tr>
                        <th>Dönem</th>
                        <th>Açıklama</th>
                        <th>Kalan Tutar</th>
                        <th>Son Ödeme</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailsGroup.charges.map((c) => (
                        <tr key={c.id}>
                          <td>{c.period_month}/{c.period_year}</td>
                          <td>Aidat / Demirbaş</td>
                          <td style={{ fontWeight: 600 }}>{Number(c.amount) - Number(c.paid_amount)} ₺</td>
                          <td>{new Date(c.due_date).toLocaleDateString('tr-TR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{
                  marginTop: 'var(--space-lg)',
                  padding: 'var(--space-md)',
                  background: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.9375rem',
                }}>
                  <span>Toplam Asıl Alacak: <strong>{formatCurrency(detailsGroup.totalOriginal)}</strong></span>
                  <span style={{ color: 'var(--warning-light)' }}>Hesaplanan Gecikme Faizi: <strong>{formatCurrency(detailsGroup.totalLateFee)}</strong></span>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setDetailsGroup(null)}>Kapat</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
