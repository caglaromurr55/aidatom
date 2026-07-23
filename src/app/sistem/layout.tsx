'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';
import { 
  BarChart3, 
  FileCheck, 
  Users, 
  PhoneCall, 
  RefreshCw, 
  MessageSquareCode, 
  Settings, 
  Bell, 
  LogOut, 
  Menu 
} from 'lucide-react';

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
      section: 'Yönetim Merkezi',
      items: [
        { href: '/sistem', label: 'Dashboard', icon: BarChart3 },
        { href: '/sistem/evrak-kontrol', label: 'Evrak Kontrol', icon: FileCheck, badge: pendingApprovals },
        { href: '/sistem/kullanicilar', label: 'Kullanıcılar', icon: Users },
        { href: '/sistem/iletisim-talepleri', label: 'İletişim Talepleri', icon: PhoneCall, badge: unreadContacts },
        { href: '/sistem/devirler', label: 'Yönetici Devirleri', icon: RefreshCw, badge: pendingHandovers },
      ],
    },
  ];

  return (
    <div className="panel-layout">
      {/* Mobile Overlay */}
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
          <a href="/sistem" className="sidebar-logo">
            <span className="logo-teal">AİDAT</span>
            <span className="logo-white">OM</span>
          </a>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '4px' }}>
            Sistem Yönetim Paneli
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((section) => (
            <div key={section.section}>
              <div className="sidebar-section-title">{section.section}</div>
              {section.items.map((item) => {
                const IconComponent = item.icon;
                const isActive = pathname === item.href || (item.href !== '/sistem' && pathname.startsWith(item.href));
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`sidebar-link ${isActive ? 'active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <div className="sidebar-link-inner">
                      <IconComponent size={18} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge ? (
                      <span className="sidebar-badge">{item.badge}</span>
                    ) : null}
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar" style={{ backgroundColor: 'var(--warning)' }}>
              {profile?.full_name?.charAt(0) || 'S'}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{profile?.full_name || 'Sistem Yöneticisi'}</span>
              <span className="sidebar-user-role">Sistem Admin</span>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ color: 'rgba(255, 255, 255, 0.6)' }} title="Çıkış Yap">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* Main Wrapper */}
      <div className="main-wrapper">
        <header className="topbar">
          <button
            className="topbar-mobile-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Menü"
          >
            <Menu size={22} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Sistem Operasyon Paneli</span>
          </div>

          <div className="topbar-right">
            <button className="topbar-icon-btn" title="Bildirimler">
              <Bell size={18} />
              {unreadNotifs > 0 && <span className="topbar-badge-count">{unreadNotifs}</span>}
            </button>
            <div style={{ height: '24px', width: '1px', backgroundColor: 'var(--border-primary)' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {profile?.full_name || 'Sistem Admin'}
              </span>
              <span className="badge badge-warning">Admin</span>
            </div>
          </div>
        </header>

        <main className="page-container">
          {children}
        </main>
      </div>
    </div>
  );
}
