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
      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-lg)' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-xl)' }}></div>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Üye Yöneticiler', value: stats.managersCount, color: 'var(--primary-400)', icon: '👥' },
    { label: 'Toplam Site', value: stats.sitesCount, color: 'var(--accent)', icon: '🏢' },
    { label: 'İcradaki Borç', value: formatCurrency(stats.totalLegalDebt), color: 'var(--error)', icon: '⚖️' },
    { label: 'Tahsil Edilen', value: formatCurrency(stats.totalLegalCollected), color: 'var(--success)', icon: '💵' },
    { label: 'İcra Başarı Oranı', value: `%${stats.legalRate}`, color: 'var(--success-light)', icon: '📈' },
  ];

  return (
    <>
      <div className="page-header">
        <h1 className="heading-sm">Süper Admin (Patron) Özet Paneli</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>
          Platform genelindeki toplam üyelik, site ve icra tahsilat hacimlerini takip edin.
        </p>
      </div>

      <div className="page-body">
        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-lg)', marginBottom: 'var(--space-2xl)' }}>
          {statCards.map((stat, i) => (
            <div key={i} className="stat-card animate-fade-in-up" style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '1.5rem' }}>{stat.icon}</span>
                <span className="stat-value" style={{ color: stat.color, fontSize: '1.5rem' }}>{stat.value}</span>
              </div>
              <span className="stat-label">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Recent Referral Cases */}
        <div className="card animate-fade-in">
          <h2 className="heading-sm" style={{ fontSize: '1.125rem', marginBottom: 'var(--space-lg)' }}>⚖️ Son İcraya Devredilen Dosyalar</h2>
          {recentCases.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Henüz icraya devredilmiş bir dosya bulunmuyor.</p>
          ) : (
            <div className="table-wrapper">
              <table className="table" style={{ fontSize: '0.875rem' }}>
                <thead>
                  <tr>
                    <th>Sakin</th>
                    <th>Site</th>
                    <th>Devredilen Borç</th>
                    <th>Devir Tarihi</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCases.map((c) => {
                    const total = Number(c.total_debt) + Number(c.total_late_fee);
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.residents?.full_name || 'Tanımsız'}</td>
                        <td>{c.sites?.name || '-'}</td>
                        <td style={{ fontWeight: 700, color: 'var(--error-light)' }}>{formatCurrency(total)}</td>
                        <td>{new Date(c.referred_at).toLocaleDateString('tr-TR')}</td>
                        <td>
                          <span className={`badge ${
                            c.status === 'collected' ? 'badge-success' :
                            c.status === 'pending' ? 'badge-warning' : 'badge-primary'
                          }`}>
                            {c.status === 'pending' ? 'Yeni / İşlemsiz' : c.status === 'collected' ? 'Tahsil Edildi' : 'İşlemde'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
