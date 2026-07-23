'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SistemDashboard() {
  const supabase = createClient();
  const [stats, setStats] = useState({
    pendingApprovals: 0,
    totalUsers: 0,
    approvedUsers: 0,
    suspendedUsers: 0,
    unreadContacts: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    const [pending, total, approved, suspended, contacts] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'site_manager'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'approved').eq('role', 'site_manager'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'suspended'),
      supabase.from('contact_requests').select('*', { count: 'exact', head: true }).eq('is_read', false),
    ]);

    setStats({
      pendingApprovals: pending.count || 0,
      totalUsers: total.count || 0,
      approvedUsers: approved.count || 0,
      suspendedUsers: suspended.count || 0,
      unreadContacts: contacts.count || 0,
    });
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
    { label: 'Onay Bekleyen Başvuru', value: stats.pendingApprovals, color: 'var(--warning)', icon: '⏳' },
    { label: 'Toplam Kayıtlı Yönetici', value: stats.totalUsers, color: 'var(--color-navy)', icon: '👥' },
    { label: 'Aktif Onaylı Kullanıcı', value: stats.approvedUsers, color: 'var(--success)', icon: '✅' },
    { label: 'Askıya Alınanlar', value: stats.suspendedUsers, color: 'var(--error)', icon: '🚫' },
    { label: 'Yeni İletişim Talebi', value: stats.unreadContacts, color: 'var(--color-teal)', icon: '📞' },
  ];

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="heading-md">Sistem Operasyon Paneli</h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
              Kullanıcı başvurularını inceleyin, evrak onaylarını verin ve platform durumunu takip edin.
            </p>
          </div>
          <div>
            <a href="/sistem/evrak-kontrol" className="btn btn-primary btn-sm">
              📋 Onay Bekleyen Evraklar ({stats.pendingApprovals})
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
              <span className="stat-value" style={{ color: stat.color }}>{stat.value}</span>
            </div>
            <span className="stat-label">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Quick Navigation Cards */}
      <h2 className="heading-sm" style={{ marginBottom: '1.25rem' }}>Yönetim Alanları</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        <a href="/sistem/evrak-kontrol" className="card card-hover" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="stat-icon" style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)' }}>📋</div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Evrak Kontrol & Onay</h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                {stats.pendingApprovals} yeni yönetici başvurusu onay bekliyor
              </p>
            </div>
          </div>
        </a>

        <a href="/sistem/kullanicilar" className="card card-hover" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="stat-icon" style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info-text)' }}>👥</div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Kullanıcı Yönetimi</h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                Sistemdeki {stats.totalUsers} yöneticinin durumunu yönetin
              </p>
            </div>
          </div>
        </a>

        <a href="/sistem/iletisim-talepleri" className="card card-hover" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="stat-icon" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-text)' }}>📞</div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>İletişim & Ön Analiz Talepleri</h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                {stats.unreadContacts} yeni arama/bilgi talebi mevcut
              </p>
            </div>
          </div>
        </a>

        <a href="/sistem/devirler" className="card card-hover" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="stat-icon" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--color-navy)' }}>🔄</div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Yönetici Devir Onayları</h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                Siteler arası yönetici devir taleplerini onaylayın
              </p>
            </div>
          </div>
        </a>
      </div>
    </>
  );
}
