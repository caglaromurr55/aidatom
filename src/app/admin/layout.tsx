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

  const loadProfile = useCallback(async () => {
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
    loadProfile();
  }, [loadProfile]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const navItems = [
    {
      section: 'Platform Kontrolü',
      items: [
        { href: '/admin', label: 'Özet İstatistikler', icon: '📊' },
        { href: '/admin/kullanicilar', label: 'Üye Yöneticiler', icon: '👥' },
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
          <a href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800 }}>
            <div style={{ width: 32, height: 32, background: 'var(--gradient-primary)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', color: '#fff' }}>A</div>
            <span><span className="text-gradient">Aidat</span>om</span>
          </a>
          <div className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-xs)' }}>
            Süper Admin (Patron)
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
              {profile?.full_name?.charAt(0) || 'P'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="text-sm" style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.full_name || 'Patron'}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Süper Yetkili
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
        </div>

        {children}
      </main>
    </div>
  );
}
