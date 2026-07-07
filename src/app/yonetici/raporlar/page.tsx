'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import type { Site } from '@/types';

interface ResidentReportRow {
  name: string;
  unit: string;
  totalBilled: number;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
}

interface CategoryReportRow {
  category: string;
  type: 'income' | 'expense';
  total: number;
}

export default function RaporlarPage() {
  const supabase = createClient();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'collection' | 'ledger'>('collection');

  // Report Data States
  const [residentReport, setResidentReport] = useState<ResidentReportRow[]>([]);
  const [categoryReport, setCategoryReport] = useState<CategoryReportRow[]>([]);
  const [collectionStats, setCollectionStats] = useState({
    totalBilled: 0,
    totalPaid: 0,
    totalPending: 0,
    totalOverdue: 0,
    rate: 0,
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

  const loadReportData = useCallback(async () => {
    if (!selectedSiteId) return;
    setLoading(true);

    try {
      // 1. Get Blocks
      const { data: blocks } = await supabase
        .from('blocks')
        .select('id, name')
        .eq('site_id', selectedSiteId)
        .is('deleted_at', null);
      const blockIds = blocks?.map(b => b.id) || [];

      if (blockIds.length === 0) {
        resetReportData();
        return;
      }

      // 2. Get Units
      const { data: units } = await supabase
        .from('units')
        .select('id, unit_number, block_id')
        .in('block_id', blockIds)
        .is('deleted_at', null);
      const unitIds = units?.map(u => u.id) || [];

      if (unitIds.length === 0) {
        resetReportData();
        return;
      }

      // 3. Get Residents
      const { data: residents } = await supabase
        .from('residents')
        .select('id, full_name, unit_id')
        .in('unit_id', unitIds)
        .eq('is_active', true);
      const residentIds = residents?.map(r => r.id) || [];

      if (residentIds.length === 0) {
        resetReportData();
        return;
      }

      // 4. Get Charges (Dues / Receivables)
      const { data: charges } = await supabase
        .from('charges')
        .select('*')
        .in('resident_id', residentIds);

      // Process Tab 1: Collection Report
      let billed = 0;
      let paid = 0;
      let pending = 0;
      let overdue = 0;

      const resReportMap: Record<string, ResidentReportRow> = {};
      const blocksList = blocks || [];
      const unitsList = units || [];
      const residentsList = residents || [];

      residentsList.forEach((r) => {
        const unit = unitsList.find((u) => u.id === r.unit_id);
        const block = blocksList.find((b) => b.id === unit?.block_id);
        resReportMap[r.id] = {
          name: r.full_name,
          unit: `${block?.name || ''} - Daire ${unit?.unit_number || ''}`,
          totalBilled: 0,
          totalPaid: 0,
          totalPending: 0,
          totalOverdue: 0,
        };
      });

      charges?.forEach((c) => {
        billed += Number(c.amount);
        paid += Number(c.paid_amount);

        const currentPending = Number(c.amount) - Number(c.paid_amount);
        if (c.status === 'overdue') {
          overdue += currentPending;
        } else if (c.status === 'pending' || c.status === 'partially_paid') {
          pending += currentPending;
        }

        // Resident mapping
        if (resReportMap[c.resident_id]) {
          resReportMap[c.resident_id].totalBilled += Number(c.amount);
          resReportMap[c.resident_id].totalPaid += Number(c.paid_amount);
          if (c.status === 'overdue') {
            resReportMap[c.resident_id].totalOverdue += currentPending;
          } else {
            resReportMap[c.resident_id].totalPending += currentPending;
          }
        }
      });

      setCollectionStats({
        totalBilled: billed,
        totalPaid: paid,
        totalPending: pending,
        totalOverdue: overdue,
        rate: billed > 0 ? Number(((paid / billed) * 100).toFixed(1)) : 0,
      });

      setResidentReport(Object.values(resReportMap));

      // Process Tab 2: Ledger Category Report
      const { data: txs } = await supabase
        .from('income_expenses')
        .select('type, category, amount')
        .eq('site_id', selectedSiteId);

      const catMap: Record<string, CategoryReportRow> = {};
      txs?.forEach((t) => {
        const key = `${t.type}_${t.category}`;
        if (!catMap[key]) {
          catMap[key] = {
            category: t.category,
            type: t.type,
            total: 0,
          };
        }
        catMap[key].total += Number(t.amount);
      });
      setCategoryReport(Object.values(catMap));

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase, selectedSiteId, sites]);

  const resetReportData = () => {
    setCollectionStats({ totalBilled: 0, totalPaid: 0, totalPending: 0, totalOverdue: 0, rate: 0 });
    setResidentReport([]);
    setCategoryReport([]);
    setLoading(false);
  };

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  if (loading && sites.length === 0) {
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
          <h1 className="heading-sm">Raporlar ve Analizler</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>
            Tahsilat başarı oranları, sakin borç dökümleri ve kasa analizlerini görüntüleyin.
          </p>
        </div>
      </div>

      <div className="page-body">
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

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 'var(--space-xl)' }}>
          <button className={`tab ${activeTab === 'collection' ? 'active' : ''}`} onClick={() => setActiveTab('collection')}>
            📈 Aidat Tahsilat Raporu
          </button>
          <button className={`tab ${activeTab === 'ledger' ? 'active' : ''}`} onClick={() => setActiveTab('ledger')}>
            📊 Gelir-Gider Dağılım Raporu
          </button>
        </div>

        {/* Tab 1: Collection Report */}
        {activeTab === 'collection' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-lg)' }}>
              <div className="stat-card">
                <span className="stat-value">{formatCurrency(collectionStats.totalBilled)}</span>
                <span className="stat-label">Toplam Tahakkuk</span>
              </div>
              <div className="stat-card">
                <span className="stat-value" style={{ color: 'var(--success)' }}>{formatCurrency(collectionStats.totalPaid)}</span>
                <span className="stat-label">Toplam Tahsil Edilen</span>
              </div>
              <div className="stat-card">
                <span className="stat-value" style={{ color: 'var(--error)' }}>{formatCurrency(collectionStats.totalOverdue)}</span>
                <span className="stat-label">Toplam Gecikmiş Borç</span>
              </div>
              <div className="stat-card">
                <span className="stat-value" style={{ color: 'var(--accent)' }}>%{collectionStats.rate}</span>
                <span className="stat-label">Tahsilat Başarı Oranı</span>
              </div>
            </div>

            {/* Resident report table */}
            <div className="card">
              <h2 className="heading-sm" style={{ fontSize: '1rem', marginBottom: 'var(--space-lg)' }}>Sakin Bazlı Borç ve Ödeme Durumu</h2>
              {residentReport.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Bu site için kayıtlı sakin borç dökümü bulunmuyor.</p>
              ) : (
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Sakin</th>
                        <th>Daire / Blok</th>
                        <th>Toplam Borçlanma</th>
                        <th>Ödenen</th>
                        <th>Geciken</th>
                        <th>Bekleyen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {residentReport.map((row, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{row.name}</td>
                          <td>{row.unit}</td>
                          <td>{row.totalBilled} ₺</td>
                          <td style={{ color: 'var(--success-light)' }}>{row.totalPaid} ₺</td>
                          <td style={{ color: row.totalOverdue > 0 ? 'var(--error-light)' : undefined, fontWeight: row.totalOverdue > 0 ? 600 : 400 }}>
                            {row.totalOverdue} ₺
                          </td>
                          <td>{row.totalPending} ₺</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Ledger Report */}
        {activeTab === 'ledger' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
            <div className="card">
              <h2 className="heading-sm" style={{ fontSize: '1rem', marginBottom: 'var(--space-lg)' }}>Kategori Bazlı Finansal Dağılım</h2>
              {categoryReport.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Henüz kaydedilmiş gelir/gider bulunmuyor.</p>
              ) : (
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Kategori</th>
                        <th>Tür</th>
                        <th>Toplam Tutar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryReport.map((row, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{row.category}</td>
                          <td>
                            {row.type === 'income' ? (
                              <span className="badge badge-success">Gelir Kasa Girişi</span>
                            ) : (
                              <span className="badge badge-error">Gider Kasa Çıkışı</span>
                            )}
                          </td>
                          <td style={{ 
                            fontWeight: 700, 
                            color: row.type === 'income' ? 'var(--success-light)' : 'var(--error-light)' 
                          }}>
                            {row.total} ₺
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
