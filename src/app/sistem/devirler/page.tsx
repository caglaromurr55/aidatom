'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime } from '@/lib/utils';
import type { ManagerHandover } from '@/types';

interface HandoverWithDetails extends ManagerHandover {
  sites: { name: string } | null;
  from_manager: { full_name: string; company_name: string | null } | null;
  to_manager: { full_name: string; company_name: string | null } | null;
}

export default function SistemDevirlerPage() {
  const supabase = createClient();
  const [handovers, setHandovers] = useState<HandoverWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadHandovers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('manager_handovers')
      .select(`
        *,
        sites (name),
        from_manager:from_manager_id (full_name, company_name),
        to_manager:to_manager_id (full_name, company_name)
      `)
      .order('created_at', { ascending: false });

    if (data) {
      setHandovers(data as any[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadHandovers();
  }, [loadHandovers]);

  const handleApprove = async (handover: HandoverWithDetails) => {
    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Update site manager_id
      const { error: siteErr } = await supabase
        .from('sites')
        .update({ manager_id: handover.to_manager_id })
        .eq('id', handover.site_id);

      if (siteErr) throw siteErr;

      // 2. Update handover status
      const { error: handErr } = await supabase
        .from('manager_handovers')
        .update({
          status: 'approved',
          approved_by: user.id,
        })
        .eq('id', handover.id);

      if (handErr) throw handErr;

      // 3. Send notifications to both managers
      await supabase.from('notifications').insert([
        {
          user_id: handover.from_manager_id,
          title: 'Site Devir Talebi Onaylandı',
          message: `"${handover.sites?.name}" sitesinin yöneticilik devri onaylandı. Yetkiniz yeni yöneticiye aktarılmıştır.`,
          type: 'success',
        },
        {
          user_id: handover.to_manager_id,
          title: 'Yeni Site Devralındı',
          message: `"${handover.sites?.name}" sitesinin yöneticiliği size devredilmiştir. Panelinizi kontrol edebilirsiniz.`,
          type: 'success',
          link: '/yonetici/siteler',
        }
      ]);

      // 4. Log audit
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'site_handover_approved',
        entity_type: 'site',
        entity_id: handover.site_id,
        new_values: { from: handover.from_manager_id, to: handover.to_manager_id },
      });

      setSuccess('Site devir talebi başarıyla onaylandı.');
      await loadHandovers();
    } catch (err: any) {
      setError('İşlem sırasında hata oluştu: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (handoverId: string) => {
    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: handErr } = await supabase
        .from('manager_handovers')
        .update({ status: 'rejected' })
        .eq('id', handoverId);

      if (handErr) throw handErr;

      // Log audit
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'site_handover_rejected',
        entity_type: 'manager_handover',
        entity_id: handoverId,
      });

      setSuccess('Site devir talebi reddedildi.');
      await loadHandovers();
    } catch (err: any) {
      setError('İşlem sırasında hata oluştu: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && handovers.length === 0) {
    return (
      <div className="page-body">
        {[1, 2].map((i) => (
          <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-md)' }}></div>
        ))}
      </div>
    );
  }

  const pendingHandovers = handovers.filter((h) => h.status === 'pending');
  const pastHandovers = handovers.filter((h) => h.status !== 'pending');

  return (
    <>
      <div className="page-header">
        <h1 className="heading-sm">Yönetici Devir Talepleri</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>
          Yöneticilerin birbirlerine devretmek istediği site yönetim yetkilerini inceleyin ve onaylayın.
        </p>
      </div>

      <div className="page-body">
        {success && <div className="auth-alert success" style={{ marginBottom: 'var(--space-lg)' }}><span>✓</span><span>{success}</span></div>}
        {error && <div className="auth-alert error" style={{ marginBottom: 'var(--space-lg)' }}><span>⚠</span><span>{error}</span></div>}

        <h2 className="heading-sm" style={{ fontSize: '1rem', marginBottom: 'var(--space-md)' }}>Bekleyen Talepler ({pendingHandovers.length})</h2>
        
        {pendingHandovers.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--space-lg) 0', marginBottom: 'var(--space-2xl)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Bekleyen devir talebi bulunmamaktadır.</p>
          </div>
        ) : (
          <div className="table-wrapper animate-fade-in" style={{ marginBottom: 'var(--space-2xl)' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Site Adı</th>
                  <th>Mevcut Yönetici</th>
                  <th>Yeni Yönetici</th>
                  <th>Notlar</th>
                  <th>Talep Tarihi</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {pendingHandovers.map((h) => (
                  <tr key={h.id}>
                    <td style={{ fontWeight: 600 }}>{h.sites?.name}</td>
                    <td>
                      <div>{h.from_manager?.full_name}</div>
                      <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{h.from_manager?.company_name || 'Bireysel'}</div>
                    </td>
                    <td>
                      <div>{h.to_manager?.full_name}</div>
                      <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{h.to_manager?.company_name || 'Bireysel'}</div>
                    </td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h.notes || ''}>
                      {h.notes || '-'}
                    </td>
                    <td className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      {formatDateTime(h.created_at)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleApprove(h)}
                          disabled={actionLoading}
                        >
                          Onayla
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleReject(h.id)}
                          disabled={actionLoading}
                        >
                          Reddet
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="heading-sm" style={{ fontSize: '1rem', marginBottom: 'var(--space-md)' }}>Geçmiş Devirler ({pastHandovers.length})</h2>
        {pastHandovers.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Geçmiş devir kaydı bulunmamaktadır.</p>
        ) : (
          <div className="table-wrapper">
            <table className="table" style={{ fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th>Site Adı</th>
                  <th>Eski Yönetici</th>
                  <th>Yeni Yönetici</th>
                  <th>Durum</th>
                  <th>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {pastHandovers.map((h) => (
                  <tr key={h.id}>
                    <td style={{ fontWeight: 600 }}>{h.sites?.name}</td>
                    <td>{h.from_manager?.full_name}</td>
                    <td>{h.to_manager?.full_name}</td>
                    <td>
                      <span className={`badge ${h.status === 'approved' ? 'badge-success' : 'badge-error'}`}>
                        {h.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}
                      </span>
                    </td>
                    <td className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      {formatDateTime(h.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
