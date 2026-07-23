'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { Building2, KeyRound, Users, Scale, Wallet, Plus, FileSpreadsheet, CreditCard, History } from 'lucide-react';

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
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card" style={{ height: 110, backgroundColor: 'var(--bg-secondary)', opacity: 0.6 }}></div>
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    { label: 'Yönetilen Siteler', value: stats.sitesCount, color: 'var(--color-navy)', icon: Building2 },
    { label: 'Toplam Daire', value: stats.unitsCount, color: 'var(--color-teal)', icon: KeyRound },
    { label: 'Aktif Sakin', value: stats.residentsCount, color: 'var(--success)', icon: Users },
    { label: 'İcradaki Dosya', value: stats.legalCount, color: 'var(--error)', icon: Scale },
  ];

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="heading-md">Yönetici Operasyon Paneli</h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
              Sitelerinizin genel durumunu ve finansal özetini buradan takip edin.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <a href="/yonetici/siteler" className="btn btn-primary btn-sm">
              <Plus size={16} /> Yeni Site Ekle
            </a>
          </div>
        </div>
      </div>

      {/* Stat Grid */}
      <div className="stat-grid">
        {cards.map((card, i) => {
          const IconComp = card.icon;
          return (
            <div key={i} className="stat-card">
              <div className="stat-card-top">
                <div className="stat-icon">
                  <IconComp size={22} />
                </div>
                <span className="stat-value" style={{ color: card.color }}>{card.value}</span>
              </div>
              <span className="stat-label">{card.label}</span>
            </div>
          );
        })}
      </div>

      {/* Financial Overview & Quick Shortcuts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card">
          <h2 className="heading-sm" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet size={20} style={{ color: 'var(--color-teal)' }} /> Finansal Özet
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-primary)', paddingBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>Toplam Tahakkuk</span>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-display)' }}>{formatCurrency(stats.totalDebt)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-primary)', paddingBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>Tahsil Edilen Tutarlar</span>
              <span style={{ fontWeight: 700, color: 'var(--success)', fontFamily: 'var(--font-display)' }}>{formatCurrency(stats.collectedAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.25rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>Geciken Borç Alacağı</span>
              <span style={{ fontWeight: 700, color: 'var(--error)', fontFamily: 'var(--font-display)' }}>{formatCurrency(stats.overdueAmount)}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="heading-sm" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={20} style={{ color: 'var(--color-teal)' }} /> Hızlı İşlem Kısayolları
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <a href="/yonetici/siteler" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
              <Building2 size={16} /> Site Yönetimi
            </a>
            <a href="/yonetici/alacaklar" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
              <Wallet size={16} /> Aidat & Alacak
            </a>
            <a href="/yonetici/excel-yukle" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
              <FileSpreadsheet size={16} /> Excel Yükle
            </a>
            <a href="/yonetici/icraya-devret" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
              <Scale size={16} /> İcraya Devret
            </a>
          </div>
        </div>
      </div>

      {/* Recent Audit Logs */}
      <div className="card">
        <h2 className="heading-sm" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <History size={20} style={{ color: 'var(--color-teal)' }} /> Son Sistem İşlem Kayıtları
        </h2>
        {recentAuditLogs.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Henüz bir işlem kaydı bulunmuyor.</p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>İşlem Detayı</th>
                  <th>Varlık Tipi</th>
                  <th>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {recentAuditLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontWeight: 600 }}>{log.action}</td>
                    <td><span className="badge badge-neutral">{log.entity_type}</span></td>
                    <td className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(log.created_at).toLocaleString('tr-TR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
