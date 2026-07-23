'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (prof) setProfile(prof as Profile);
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
      section: 'Platform Sahibi',
      items: [
        { href: '/admin', label: 'Genel Bakış', icon: '📊' },
        { href: '/admin/kullanicilar', label: 'Tüm Kullanıcılar', icon: '👥' },
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
          <a href="/admin" className="sidebar-logo">
            <span className="logo-teal">AİDAT</span>
            <span className="logo-white">OM</span>
          </a>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '4px' }}>
            Süper Admin Konsolu
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((section) => (
            <div key={section.section}>
              <div className="sidebar-section-title">{section.section}</div>
              {section.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
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
            <div className="sidebar-user-avatar" style={{ backgroundColor: '#8B5CF6' }}>
              {profile?.full_name?.charAt(0) || 'P'}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{profile?.full_name || 'Patron Süper Admin'}</span>
              <span className="sidebar-user-role">Platform Sahibi</span>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ color: 'rgba(255, 255, 255, 0.6)' }} title="Çıkış Yap">
            🚪
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
            ☰
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Süper Admin Konsolu</span>
          </div>

          <div className="topbar-right">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {profile?.full_name || 'Patron'}
              </span>
              <span className="badge badge-primary" style={{ backgroundColor: '#F3E8FF', color: '#6B21A8', borderColor: '#E9D5FF' }}>
                Süper Admin
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
