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
    { label: 'Onay Bekleyen', value: stats.pendingApprovals, color: 'var(--warning)', icon: '⏳' },
    { label: 'Toplam Kullanıcı', value: stats.totalUsers, color: 'var(--primary-500)', icon: '👥' },
    { label: 'Aktif Kullanıcı', value: stats.approvedUsers, color: 'var(--success)', icon: '✅' },
    { label: 'Askıda', value: stats.suspendedUsers, color: 'var(--error)', icon: '🚫' },
    { label: 'Yeni İletişim', value: stats.unreadContacts, color: 'var(--accent)', icon: '📞' },
  ];

  return (
    <>
      <div className="page-header">
        <h1 className="heading-sm">Sistem Yönetimi</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>
          Kullanıcı başvurularını yönetin ve sistem durumunu takip edin.
        </p>
      </div>
      <div className="page-body">
        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-lg)', marginBottom: 'var(--space-2xl)' }}>
          {statCards.map((stat, i) => (
            <div key={i} className="stat-card animate-fade-in-up" style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '1.5rem' }}>{stat.icon}</span>
                <span className="stat-value" style={{ color: stat.color }}>{stat.value}</span>
              </div>
              <span className="stat-label">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <h2 className="heading-sm" style={{ marginBottom: 'var(--space-lg)' }}>Hızlı İşlemler</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-lg)' }}>
          <a href="/sistem/evrak-kontrol" className="card card-hover" style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
              <span style={{ fontSize: '1.5rem' }}>📋</span>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Evrak Kontrol</h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {stats.pendingApprovals} başvuru bekliyor
                </p>
              </div>
            </div>
          </a>
          <a href="/sistem/kullanicilar" className="card card-hover" style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
              <span style={{ fontSize: '1.5rem' }}>👥</span>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Kullanıcılar</h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Tüm kullanıcıları yönet
                </p>
              </div>
            </div>
          </a>
          <a href="/sistem/iletisim-talepleri" className="card card-hover" style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
              <span style={{ fontSize: '1.5rem' }}>📞</span>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>İletişim Talepleri</h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {stats.unreadContacts} okunmamış talep
                </p>
              </div>
            </div>
          </a>
        </div>
      </div>
    </>
  );
}
