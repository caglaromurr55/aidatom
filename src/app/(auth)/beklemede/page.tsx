'use client';

import { createClient } from '@/lib/supabase/client';

export default function PendingReviewPage() {
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header style={{
        padding: 'var(--space-md) var(--space-xl)',
        borderBottom: '1px solid var(--border-primary)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800 }}>
          <div style={{ width: 36, height: 36, background: 'var(--gradient-primary)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', color: '#fff' }}>A</div>
          <span><span className="text-gradient">Aidat</span>om</span>
        </a>
        <button onClick={handleLogout} className="btn btn-ghost btn-sm">
          Çıkış Yap
        </button>
      </header>

      {/* Content */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 65px)',
        padding: 'var(--space-xl)',
      }}>
        <div className="card animate-fade-in-up" style={{ maxWidth: 520, textAlign: 'center', padding: 'var(--space-3xl)' }}>
          {/* Animated Icon */}
          <div style={{ 
            fontSize: '4rem', 
            marginBottom: 'var(--space-xl)',
            animation: 'float 3s ease-in-out infinite',
          }}>
            🔍
          </div>

          <h1 className="heading-md" style={{ marginBottom: 'var(--space-md)' }}>
            Belgeleriniz İnceleniyor
          </h1>

          <p style={{ 
            color: 'var(--text-secondary)', 
            lineHeight: 1.7, 
            marginBottom: 'var(--space-xl)',
            fontSize: '1.0625rem',
          }}>
            Yüklediğiniz belgeler ekibimiz tarafından incelenmektedir. 
            Onay süreci genellikle <strong style={{ color: 'var(--text-primary)' }}>1-2 iş günü</strong> içinde tamamlanır.
          </p>

          <div style={{
            padding: 'var(--space-lg)',
            background: 'rgba(99, 102, 241, 0.05)',
            border: '1px solid rgba(99, 102, 241, 0.15)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--space-xl)',
          }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Onay tamamlandığında <strong style={{ color: 'var(--primary-400)' }}>e-posta</strong> ile bilgilendirileceksiniz.
              Ayrıca bir sonraki girişinizde otomatik olarak yönetim panelinize yönlendirileceksiniz.
            </p>
          </div>

          {/* Status Steps */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ 
                width: 24, height: 24, borderRadius: '50%', 
                background: 'var(--success)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700,
              }}>✓</span>
              <span className="text-sm" style={{ color: 'var(--success)' }}>Kayıt</span>
            </div>
            <div style={{ width: 30, height: 2, background: 'var(--success)' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ 
                width: 24, height: 24, borderRadius: '50%', 
                background: 'var(--success)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700,
              }}>✓</span>
              <span className="text-sm" style={{ color: 'var(--success)' }}>Belgeler</span>
            </div>
            <div style={{ width: 30, height: 2, background: 'var(--border-secondary)' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="animate-pulse" style={{ 
                width: 24, height: 24, borderRadius: '50%', 
                background: 'var(--primary-600)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700,
              }}>3</span>
              <span className="text-sm" style={{ color: 'var(--primary-400)', fontWeight: 600 }}>İnceleme</span>
            </div>
            <div style={{ width: 30, height: 2, background: 'var(--border-secondary)' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ 
                width: 24, height: 24, borderRadius: '50%', 
                border: '2px solid var(--border-secondary)', color: 'var(--text-tertiary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700,
              }}>4</span>
              <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Onay</span>
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-2xl)' }}>
            <a href="/" className="btn btn-secondary">
              Ana Sayfaya Dön
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
