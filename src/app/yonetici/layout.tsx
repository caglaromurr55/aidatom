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
      section: 'Finansal',
      items: [
        { href: '/yonetici/alacaklar', label: 'Aidat & Alacaklar', icon: '💰' },
        { href: '/yonetici/gelir-gider', label: 'Gelir / Gider', icon: '💸' },
        { href: '/yonetici/excel-yukle', label: 'Excel Veri Yükleme', icon: '📋' },
      ],
    },
    {
      section: 'Hukuk & İletişim',
      items: [
        { href: '/yonetici/icraya-devret', label: 'İcraya Devret', icon: '⚖️' },
        { href: '/yonetici/sms', label: 'SMS Gönderimi', icon: '📱' },
        { href: '/yonetici/raporlar', label: 'Raporlar', icon: '📈' },
      ],
    },
  ];

  return (
    <div className="panel-layout">
      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay active"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <a href="/yonetici" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800 }}>
            <div style={{ width: 32, height: 32, background: 'var(--gradient-primary)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', color: '#fff' }}>A</div>
            <span><span className="text-gradient">Aidat</span>om</span>
          </a>
          <div className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-xs)' }}>
            {profile?.manager_type === 'company' ? 'Profesyonel Yönetim Şirketi' : 'Site Yöneticisi'}
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((section) => (
            <div key={section.section}>
              <div className="sidebar-section-title">{section.section}</div>
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`sidebar-link ${isActive ? 'active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span className="icon">{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
            <div style={{ 
              width: 36, height: 36, borderRadius: '50%', 
              background: 'var(--gradient-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.875rem', fontWeight: 700, color: '#fff',
              flexShrink: 0,
            }}>
              {profile?.full_name?.charAt(0) || 'Y'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="text-sm" style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.full_name || 'Yönetici'}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {profile?.company_name || (profile?.phone ? `+${profile.phone}` : '')}
              </div>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ width: '100%' }}>
            🚪 Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Top Bar */}
        <div style={{
          padding: 'var(--space-md) var(--space-xl)',
          borderBottom: '1px solid var(--border-primary)',
          background: 'var(--bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <button
            className="mobile-menu-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Menü"
          >
            ☰
          </button>
          <div style={{ flex: 1 }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <button className="btn btn-icon btn-ghost" style={{ position: 'relative' }}>
              🔔
              {unreadNotifs > 0 && <span className="notification-dot"></span>}
            </button>
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}
