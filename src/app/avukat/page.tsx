'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { LegalCase } from '@/types';

interface LegalCaseWithDetails extends LegalCase {
  residents: { full_name: string; phone: string; tc_no: string } | null;
  sites: { name: string } | null;
}

export default function LawyerDashboard() {
  const supabase = createClient();
  const [cases, setCases] = useState<LegalCaseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadCases = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('legal_cases')
      .select(`
        *,
        residents (full_name, phone, tc_no),
        sites (name)
      `)
      .order('referred_at', { ascending: false });

    if (data) {
      setCases(data as LegalCaseWithDetails[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const filteredCases = cases.filter((c) => {
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesSearch =
      c.residents?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.sites?.name.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="badge badge-warning">Onay Bekliyor</span>;
      case 'in_progress':
        return <span className="badge badge-primary">İcra Takibinde</span>;
      case 'collected':
        return <span className="badge badge-success">Tahsil Edildi</span>;
      case 'partially_collected':
        return <span className="badge badge-warning">Kısmi Tahsilat</span>;
      case 'closed':
        return <span className="badge badge-neutral">Kapatıldı</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  if (loading && cases.length === 0) {
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
      <div className="page-header">
        <h1 className="heading-sm">İcra Takip Dosyaları</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>
          Hukuk büronuza devredilmiş tüm icra dosyalarını yönetin ve hukuki işlem kayıtlarını girin.
        </p>
      </div>

      <div className="page-body">
        {/* Filters */}
        <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Borçlu sakin veya site adı ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ width: 180 }}>
            <select
              className="form-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Dosya Durumu"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="pending">Onay Bekleyen / Yeni</option>
              <option value="in_progress">İcra Takibinde</option>
              <option value="collected">Tahsil Edildi</option>
              <option value="partially_collected">Kısmi Tahsilat</option>
              <option value="closed">Kapatıldı</option>
            </select>
          </div>
        </div>

        {filteredCases.length === 0 ? (
          <div className="empty-state">
            <div className="icon">⚖️</div>
            <h3>İcra Dosyası Bulunamadı</h3>
            <p>Hukuk büronuza yönlendirilmiş aktif icra takip kaydı bulunmamaktadır.</p>
          </div>
        ) : (
          <div className="table-wrapper animate-fade-in">
            <table className="table">
              <thead>
                <tr>
                  <th>Borçlu Sakin / Site</th>
                  <th>TC Kimlik No</th>
                  <th>Devir Tarihi</th>
                  <th>Asıl Borç</th>
                  <th>Gecikme Faizi</th>
                  <th>Toplam Borç</th>
                  <th>Dosya Durumu</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((c) => {
                  const totalDebt = Number(c.total_debt) + Number(c.total_late_fee);
                  return (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.residents?.full_name || 'Tanımsız'}</div>
                        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          🏢 {c.sites?.name || '-'}
                        </div>
                      </td>
                      <td>{c.residents?.tc_no || '-'}</td>
                      <td className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                        {formatDateTime(c.referred_at)}
                      </td>
                      <td>{formatCurrency(c.total_debt)}</td>
                      <td style={{ color: 'var(--warning-light)' }}>+{formatCurrency(c.total_late_fee)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--error-light)' }}>{formatCurrency(totalDebt)}</td>
                      <td>{getStatusBadge(c.status)}</td>
                      <td>
                        <a href={`/avukat/${c.id}`} className="btn btn-primary btn-sm">
                          Yönet ➔
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
