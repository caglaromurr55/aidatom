'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';
import { PhoneCall, PhoneForwarded, History, LogOut, Menu, Bell, ShieldCheck } from 'lucide-react';

export default function SantralLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadContacts, setUnreadContacts] = useState(0);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (prof) setProfile(prof as Profile);

    // Unread contact requests
    const { count } = await supabase
      .from('contact_requests')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);
    setUnreadContacts(count || 0);
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
      section: 'Santral Operasyon',
      items: [
        { href: '/santral', label: 'Santral Paneli', icon: PhoneCall, badge: unreadContacts },
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
          <a href="/santral" className="sidebar-logo">
            <img src="/logo-white.svg" alt="Aidatom" style={{ height: '36px', width: 'auto' }} />
          </a>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '4px' }}>
            Santral & Çağrı Merkezi Paneli
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((section) => (
            <div key={section.section}>
              <div className="sidebar-section-title">{section.section}</div>
              {section.items.map((item) => {
                const IconComponent = item.icon;
                const isActive = pathname === item.href;
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
            <div className="sidebar-user-avatar" style={{ backgroundColor: 'var(--color-teal)' }}>
              {profile?.full_name?.charAt(0) || 'C'}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{profile?.full_name || 'Santral Görevlisi'}</span>
              <span className="sidebar-user-role">Çağrı Operatörü</span>
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
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Santral & Müşteri İletişim Operasyonu
            </span>
          </div>

          <div className="topbar-right">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {profile?.full_name || 'Santral Görevlisi'}
              </span>
              <span className="badge badge-primary" style={{ backgroundColor: 'var(--color-teal)', color: '#fff' }}>
                Santral Online
              </span>
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
