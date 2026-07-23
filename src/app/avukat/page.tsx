'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { LegalCase } from '@/types';
import { Scale, Search, Building2, ChevronRight, FileText } from 'lucide-react';

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
      <div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="card" style={{ height: 80, backgroundColor: 'var(--bg-secondary)', marginBottom: '1rem', opacity: 0.6 }}></div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="heading-md">İcra Takip Dosyaları</h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
              Hukuk büronuza devredilmiş tüm icra dosyalarını yönetin ve hukuki işlem kayıtlarını girin.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Borçlu sakin veya site adı ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ width: 200 }}>
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
      </div>

      {filteredCases.length === 0 ? (
        <div className="empty-state">
          <div className="icon">
            <Scale size={32} />
          </div>
          <h3>İcra Dosyası Bulunamadı</h3>
          <p>Hukuk büronuza yönlendirilmiş aktif icra takip kaydı bulunmamaktadır.</p>
        </div>
      ) : (
        <div className="table-wrapper">
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
                      <div className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Building2 size={12} /> {c.sites?.name || '-'}
                      </div>
                    </td>
                    <td>{c.residents?.tc_no || '-'}</td>
                    <td className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {formatDateTime(c.referred_at)}
                    </td>
                    <td>{formatCurrency(c.total_debt)}</td>
                    <td style={{ color: 'var(--warning-text)' }}>+{formatCurrency(c.total_late_fee)}</td>
                    <td style={{ fontWeight: 700, color: 'var(--error)' }}>{formatCurrency(totalDebt)}</td>
                    <td>{getStatusBadge(c.status)}</td>
                    <td>
                      <a href={`/avukat/${c.id}`} className="btn btn-primary btn-sm">
                        İncele <ChevronRight size={14} />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
