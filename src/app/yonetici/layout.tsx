'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';

export default function YoneticiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (prof) setProfile(prof as Profile);

    // Count unread notifications
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setUnreadNotifs(count || 0);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const navItems = [
    {
      section: 'Genel',
      items: [
        { href: '/yonetici', label: 'Özet Panel', icon: '📊' },
        { href: '/yonetici/siteler', label: 'Site / Apartman', icon: '🏢' },
      ],
    },
    {
      section: 'Finansal Operasyon',
      items: [
        { href: '/yonetici/alacaklar', label: 'Aidat & Alacaklar', icon: '💰' },
        { href: '/yonetici/gelir-gider', label: 'Kasa (Gelir / Gider)', icon: '💸' },
        { href: '/yonetici/excel-yukle', label: 'Excel Veri Yükleme', icon: '📋' },
      ],
    },
    {
      section: 'Hukuk & İletişim',
      items: [
        { href: '/yonetici/icraya-devret', label: 'İcraya Devret', icon: '⚖️' },
        { href: '/yonetici/sms', label: 'SMS Hatırlatma', icon: '📱' },
        { href: '/yonetici/raporlar', label: 'Raporlar & Analiz', icon: '📈' },
      ],
    },
  ];

  return (
    <div className="panel-layout">
      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 31, 61, 0.4)',
            zIndex: 99,
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <a href="/yonetici" className="sidebar-logo">
            <span className="logo-teal">AİDAT</span>
            <span className="logo-white">OM</span>
          </a>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '4px' }}>
            {profile?.manager_type === 'company' ? 'Profesyonel Yönetim Şirketi' : 'Site Yöneticisi'}
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((section) => (
            <div key={section.section}>
              <div className="sidebar-section-title">{section.section}</div>
              {section.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/yonetici' && pathname.startsWith(item.href));
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`sidebar-link ${isActive ? 'active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <div className="sidebar-link-inner">
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {profile?.full_name?.charAt(0) || 'Y'}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{profile?.full_name || 'Yönetici'}</span>
              <span className="sidebar-user-role">{profile?.company_name || profile?.phone || 'Site Yöneticisi'}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ color: 'rgba(255, 255, 255, 0.6)' }} title="Çıkış Yap">
            🚪
          </button>
        </div>
      </aside>

      {/* Main Wrapper */}
      <div className="main-wrapper">
        {/* Topbar Header */}
        <header className="topbar">
          <button
            className="topbar-mobile-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Menü"
          >
            ☰
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Operasyon Merkezi</span>
          </div>

          <div className="topbar-right">
            <button className="topbar-icon-btn" title="Bildirimler">
              🔔
              {unreadNotifs > 0 && <span className="topbar-badge-count">{unreadNotifs}</span>}
            </button>
            <div style={{ height: '24px', width: '1px', backgroundColor: 'var(--border-primary)' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {profile?.full_name || 'Yönetici'}
              </span>
              <span className="badge badge-primary">Aktif</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="page-container">
          {children}
        </main>
      </div>
    </div>
  );
}
