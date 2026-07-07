'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';

export default function YoneticiDashboard() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    sitesCount: 0,
    unitsCount: 0,
    residentsCount: 0,
    totalDebt: 0,
    collectedAmount: 0,
    overdueAmount: 0,
    legalCount: 0,
  });
  const [recentAuditLogs, setRecentAuditLogs] = useState<any[]>([]);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get manager's sites
    const { data: sites } = await supabase
      .from('sites')
      .select('id')
      .eq('manager_id', user.id);

    const siteIds = sites?.map(s => s.id) || [];

    if (siteIds.length === 0) {
      setStats({
        sitesCount: 0,
        unitsCount: 0,
        residentsCount: 0,
        totalDebt: 0,
        collectedAmount: 0,
        overdueAmount: 0,
        legalCount: 0,
      });
      setLoading(false);
      return;
    }

    // Get total blocks, units, residents counts
    const { data: blocks } = await supabase
      .from('blocks')
      .select('id')
      .in('site_id', siteIds);
    const blockIds = blocks?.map(b => b.id) || [];

    let unitsCount = 0;
    let residentsCount = 0;
    let unitIds: string[] = [];

    if (blockIds.length > 0) {
      const { data: units } = await supabase
        .from('units')
        .select('id')
        .in('block_id', blockIds);
      unitsCount = units?.length || 0;
      unitIds = units?.map(u => u.id) || [];

      if (unitIds.length > 0) {
        const { count: resCount } = await supabase
          .from('residents')
          .select('*', { count: 'exact', head: true })
          .in('unit_id', unitIds)
          .eq('is_active', true);
        residentsCount = resCount || 0;
      }
    }

    // Calculate finances from charges table
    let totalDebt = 0;
    let collectedAmount = 0;
    let overdueAmount = 0;

    if (unitIds.length > 0) {
      const { data: charges } = await supabase
        .from('charges')
        .select('amount, paid_amount, status')
        .in('unit_id', unitIds);

      if (charges) {
        charges.forEach((c) => {
          totalDebt += Number(c.amount);
          collectedAmount += Number(c.paid_amount);
          if (c.status === 'overdue') {
            overdueAmount += (Number(c.amount) - Number(c.paid_amount));
          }
        });
      }
    }

    // Legal cases count
    const { count: legalCount } = await supabase
      .from('legal_cases')
      .select('*', { count: 'exact', head: true })
      .in('site_id', siteIds);

    // Recent audit logs
    const { data: logs } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    setStats({
      sitesCount: siteIds.length,
      unitsCount,
      residentsCount,
      totalDebt,
      collectedAmount,
      overdueAmount,
      legalCount: legalCount || 0,
    });

    if (logs) setRecentAuditLogs(logs);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (loading) {
    return (
      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-lg)' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-xl)' }}></div>
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    { label: 'Yönetilen Siteler', value: stats.sitesCount, color: 'var(--primary-400)', icon: '🏢' },
    { label: 'Toplam Daire', value: stats.unitsCount, color: 'var(--accent)', icon: '🔑' },
    { label: 'Aktif Sakin', value: stats.residentsCount, color: 'var(--success)', icon: '👥' },
    { label: 'İcradaki Dosya', value: stats.legalCount, color: 'var(--error)', icon: '⚖️' },
  ];

  return (
    <>
      <div className="page-header">
        <h1 className="heading-sm">Yönetici Özet Paneli</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>
          Sitelerinizin genel durumunu ve finansal özetini buradan takip edin.
        </p>
      </div>

      <div className="page-body">
        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-lg)', marginBottom: 'var(--space-2xl)' }}>
          {cards.map((card, i) => (
            <div key={i} className="stat-card animate-fade-in-up" style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '1.5rem' }}>{card.icon}</span>
                <span className="stat-value" style={{ color: card.color }}>{card.value}</span>
              </div>
              <span className="stat-label">{card.label}</span>
            </div>
          ))}
        </div>

        {/* Financial Highlights */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-xl)', marginBottom: 'var(--space-2xl)' }}>
          <div className="card">
            <h2 className="heading-sm" style={{ marginBottom: 'var(--space-lg)' }}>💰 Finansal Durum</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-primary)', paddingBottom: 'var(--space-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Toplam Tahakkuk</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(stats.totalDebt)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-primary)', paddingBottom: 'var(--space-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Tahsil Edilen</span>
                <span style={{ fontWeight: 600, color: 'var(--success-light)' }}>{formatCurrency(stats.collectedAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--space-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Geciken Alacak</span>
                <span style={{ fontWeight: 600, color: 'var(--error-light)' }}>{formatCurrency(stats.overdueAmount)}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="heading-sm" style={{ marginBottom: 'var(--space-lg)' }}>⚡ Hızlı Kısayollar</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <a href="/yonetici/siteler" className="btn btn-secondary btn-sm" style={{ height: 'fit-content' }}>🏢 Site Ekle</a>
              <a href="/yonetici/alacaklar" className="btn btn-secondary btn-sm" style={{ height: 'fit-content' }}>💰 Aidat Gir</a>
              <a href="/yonetici/excel-yukle" className="btn btn-secondary btn-sm" style={{ height: 'fit-content' }}>📋 Excel Yükle</a>
              <a href="/yonetici/icraya-devret" className="btn btn-secondary btn-sm" style={{ height: 'fit-content' }}>⚖️ İcraya Ver</a>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h2 className="heading-sm" style={{ marginBottom: 'var(--space-lg)' }}>📝 Son İşlemler (Loglar)</h2>
          {recentAuditLogs.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Henüz bir işlem kaydı bulunmuyor.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {recentAuditLogs.map((log) => (
                <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-primary)', paddingBottom: 'var(--space-sm)', fontSize: '0.9375rem' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{log.action}</span> &bull; {log.entity_type}
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {new Date(log.created_at).toLocaleString('tr-TR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
