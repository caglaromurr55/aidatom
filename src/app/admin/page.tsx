'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';

export default function AdminDashboard() {
  const supabase = createClient();
  const [stats, setStats] = useState({
    managersCount: 0,
    sitesCount: 0,
    totalLegalDebt: 0,
    totalLegalCollected: 0,
    legalRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentCases, setRecentCases] = useState<any[]>([]);

  const loadStats = useCallback(async () => {
    setLoading(true);
    
    // Count site managers
    const { count: managers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'site_manager');

    // Count total sites
    const { count: sites } = await supabase
      .from('sites')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    // Sum legal cases amounts
    const { data: legalCases } = await supabase
      .from('legal_cases')
      .select('total_debt, total_late_fee, collected_amount');

    let debtSum = 0;
    let collectedSum = 0;

    legalCases?.forEach((lc) => {
      debtSum += (Number(lc.total_debt) + Number(lc.total_late_fee));
      collectedSum += Number(lc.collected_amount);
    });

    // Recent referred cases
    const { data: recent } = await supabase
      .from('legal_cases')
      .select(`
        id,
        total_debt,
        total_late_fee,
        status,
        referred_at,
        residents (full_name),
        sites (name)
      `)
      .order('referred_at', { ascending: false })
      .limit(5);

    setStats({
      managersCount: managers || 0,
      sitesCount: sites || 0,
      totalLegalDebt: debtSum,
      totalLegalCollected: collectedSum,
      legalRate: debtSum > 0 ? Number(((collectedSum / debtSum) * 100).toFixed(1)) : 0,
    });

    if (recent) setRecentCases(recent);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card" style={{ height: 110, backgroundColor: 'var(--bg-secondary)', opacity: 0.6 }}></div>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Üye Yöneticiler', value: stats.managersCount, color: 'var(--color-navy)', icon: '👥' },
    { label: 'Toplam Site', value: stats.sitesCount, color: 'var(--color-teal)', icon: '🏢' },
    { label: 'İcradaki Toplam Borç', value: formatCurrency(stats.totalLegalDebt), color: 'var(--error)', icon: '⚖️' },
    { label: 'Tahsil Edilen Tutar', value: formatCurrency(stats.totalLegalCollected), color: 'var(--success)', icon: '💵' },
    { label: 'İcra Başarı Oranı', value: `%${stats.legalRate}`, color: 'var(--info)', icon: '📈' },
  ];

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="heading-md">Platform Genel Bakış (Süper Admin)</h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
              Aidatom platformundaki tüm aktif sitelerin, üyelerin ve hukuki operasyonların genel özeti.
            </p>
          </div>
          <div>
            <a href="/admin/kullanicilar" className="btn btn-navy btn-sm">
              👥 Tüm Kullanıcı Listesi
            </a>
          </div>
        </div>
      </div>

      {/* Stat Grid */}
      <div className="stat-grid">
        {statCards.map((stat, i) => (
          <div key={i} className="stat-card">
            <div className="stat-card-top">
              <div className="stat-icon">{stat.icon}</div>
              <span className="stat-value" style={{ color: stat.color, fontSize: typeof stat.value === 'string' && stat.value.length > 8 ? '1.35rem' : '1.75rem' }}>
                {stat.value}
              </span>
            </div>
            <span className="stat-label">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Recent Legal Handovers */}
      <div className="card">
        <h2 className="heading-sm" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚖️</span> Hukuk Departmanına Devredilen Son Dosyalar
        </h2>

        {recentCases.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Henüz hukuka devredilmiş bir icra dosyası bulunmamaktadır.</p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Borçlu Sakin</th>
                  <th>Bağlı Site</th>
                  <th>Toplam Borç Tutar</th>
                  <th>Devir Tarihi</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {recentCases.map((c) => {
                  const totalDebt = Number(c.total_debt) + Number(c.total_late_fee);
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.residents?.full_name || 'Tanımsız'}</td>
                      <td>🏢 {c.sites?.name || '-'}</td>
                      <td style={{ fontWeight: 700, color: 'var(--error)' }}>{formatCurrency(totalDebt)}</td>
                      <td className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {new Date(c.referred_at).toLocaleDateString('tr-TR')}
                      </td>
                      <td>
                        <span className="badge badge-warning">{c.status}</span>
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
