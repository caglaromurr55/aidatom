'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime } from '@/lib/utils';
import type { ContactRequest } from '@/types';

export default function IletisimTalepleriPage() {
  const supabase = createClient();
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ContactRequest | null>(null);

  const loadRequests = useCallback(async () => {
    const { data } = await supabase
      .from('contact_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setRequests(data as ContactRequest[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const markAsRead = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('contact_requests').update({
      is_read: true,
      read_by: user?.id,
    }).eq('id', id);
    await loadRequests();
  };

  if (loading) {
    return (
      <div className="page-body">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-md)' }}></div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="heading-sm">İletişim Talepleri</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>
          &quot;Sizi Arayalım&quot; formundan gelen talepler
        </p>
      </div>
      <div className="page-body">
        {requests.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📞</div>
            <h3>Henüz iletişim talebi yok</h3>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Durum</th>
                  <th>Ad Soyad</th>
                  <th>Telefon</th>
                  <th>E-posta</th>
                  <th>Mesaj</th>
                  <th>Tarih</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id} style={{ background: !req.is_read ? 'rgba(99, 102, 241, 0.03)' : undefined }}>
                    <td>
                      {req.is_read ? (
                        <span className="badge badge-neutral">Okundu</span>
                      ) : (
                        <span className="badge badge-primary">Yeni</span>
                      )}
                    </td>
                    <td style={{ fontWeight: !req.is_read ? 600 : 400 }}>{req.full_name}</td>
                    <td>{req.phone}</td>
                    <td>{req.email || '-'}</td>
                    <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {req.message}
                    </td>
                    <td className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      {formatDateTime(req.created_at)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setSelectedRequest(req)}
                        >
                          Detay
                        </button>
                        {!req.is_read && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => markAsRead(req.id)}
                          >
                            Okundu
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Detail Modal */}
        {selectedRequest && (
          <div className="modal-overlay" onClick={() => setSelectedRequest(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>İletişim Talebi Detayı</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedRequest(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                  <div>
                    <span className="form-label">Ad Soyad</span>
                    <p style={{ fontWeight: 600 }}>{selectedRequest.full_name}</p>
                  </div>
                  <div>
                    <span className="form-label">Telefon</span>
                    <p>{selectedRequest.phone}</p>
                  </div>
                  {selectedRequest.email && (
                    <div>
                      <span className="form-label">E-posta</span>
                      <p>{selectedRequest.email}</p>
                    </div>
                  )}
                  <div>
                    <span className="form-label">Mesaj</span>
                    <p style={{ lineHeight: 1.7 }}>{selectedRequest.message}</p>
                  </div>
                  <div>
                    <span className="form-label">Tarih</span>
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      {formatDateTime(selectedRequest.created_at)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                {!selectedRequest.is_read && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      markAsRead(selectedRequest.id);
                      setSelectedRequest(null);
                    }}
                  >
                    Okundu İşaretle
                  </button>
                )}
                <button className="btn btn-ghost" onClick={() => setSelectedRequest(null)}>Kapat</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
