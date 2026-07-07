'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';

export default function SistemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [unreadContacts, setUnreadContacts] = useState(0);
  const [pendingHandovers, setPendingHandovers] = useState(0);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (prof) setProfile(prof as Profile);

    // Count pending approvals
    const { count: pendingCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_review');
    setPendingApprovals(pendingCount || 0);

    // Count unread notifications
    const { count: notifCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setUnreadNotifs(notifCount || 0);

    // Count unread contact requests
    const { count: contactCount } = await supabase
      .from('contact_requests')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);
    setUnreadContacts(contactCount || 0);

    // Count pending handovers
    const { count: handoverCount } = await supabase
      .from('manager_handovers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    setPendingHandovers(handoverCount || 0);
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
      section: 'Yönetim',
      items: [
        { href: '/sistem', label: 'Dashboard', icon: '📊' },
        { href: '/sistem/evrak-kontrol', label: 'Evrak Kontrol', icon: '📋', badge: pendingApprovals },
        { href: '/sistem/kullanicilar', label: 'Kullanıcılar', icon: '👥' },
        { href: '/sistem/iletisim-talepleri', label: 'İletişim Talepleri', icon: '📞', badge: unreadContacts },
        { href: '/sistem/devirler', label: 'Yönetici Devirleri', icon: '🔄', badge: pendingHandovers },
      ],
    },
    {
      section: 'Ayarlar',
      items: [
        { href: '/sistem/sms-sablonlari', label: 'SMS Şablonları', icon: '💬' },
        { href: '/sistem/sistem-ayarlari', label: 'Sistem Ayarları', icon: '⚙️' },
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
          <a href="/sistem" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800 }}>
            <div style={{ width: 32, height: 32, background: 'var(--gradient-primary)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', color: '#fff' }}>A</div>
            <span><span className="text-gradient">Aidat</span>om</span>
          </a>
          <div className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-xs)' }}>
            Sistem Yöneticisi
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((section) => (
            <div key={section.section}>
              <div className="sidebar-section-title">{section.section}</div>
              {section.items.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="icon">{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge ? (
                    <span className="badge badge-error" style={{ fontSize: '0.6875rem', padding: '2px 8px' }}>
                      {item.badge}
                    </span>
                  ) : null}
                </a>
              ))}
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
              {profile?.full_name?.charAt(0) || 'S'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="text-sm" style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.full_name || 'Sistem Yöneticisi'}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {profile?.phone ? `+${profile.phone}` : ''}
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
