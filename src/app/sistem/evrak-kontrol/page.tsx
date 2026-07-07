'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DOCUMENT_LABELS, USER_STATUS_LABELS, formatDateTime } from '@/lib/utils';
import type { Profile, Document } from '@/types';

interface PendingUser extends Profile {
  documents: Document[];
}

export default function EvrakKontrolPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null);
  const [rejectDocId, setRejectDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadPendingUsers = useCallback(async () => {
    const { data: pendingProfiles } = await supabase
      .from('profiles')
      .select('*')
      .eq('status', 'pending_review')
      .order('created_at', { ascending: true });

    if (!pendingProfiles || pendingProfiles.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const userIds = pendingProfiles.map((p) => p.id);
    const { data: docs } = await supabase
      .from('documents')
      .select('*')
      .in('user_id', userIds)
      .eq('is_current', true)
      .order('created_at', { ascending: true });

    const enrichedUsers: PendingUser[] = pendingProfiles.map((profile) => ({
      ...(profile as Profile),
      documents: (docs?.filter((d) => d.user_id === profile.id) as Document[]) || [],
    }));

    setUsers(enrichedUsers);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadPendingUsers();
  }, [loadPendingUsers]);

  const handleApproveDoc = async (docId: string) => {
    setActionLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from('documents').update({
      status: 'approved',
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', docId);

    await loadPendingUsers();
    if (selectedUser) {
      const updated = users.find(u => u.id === selectedUser.id);
      if (updated) setSelectedUser(updated);
    }
    setActionLoading(false);
  };

  const handleRejectDoc = async () => {
    if (!rejectDocId || !rejectReason.trim()) return;
    setActionLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('documents').update({
      status: 'rejected',
      rejection_reason: rejectReason,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', rejectDocId);

    // Set user status back to pending_documents
    const doc = selectedUser?.documents.find(d => d.id === rejectDocId);
    if (doc) {
      await supabase.from('profiles').update({ status: 'rejected' }).eq('id', doc.user_id);
    }

    setRejectDocId(null);
    setRejectReason('');
    await loadPendingUsers();
    setSelectedUser(null);
    setActionLoading(false);
  };

  const handleApproveUser = async (userId: string) => {
    setActionLoading(true);

    await supabase.from('profiles').update({ status: 'approved' }).eq('id', userId);

    // Send notification
    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Hesabınız Onaylandı!',
      message: 'Belgeleriniz incelendi ve hesabınız onaylandı. Artık Aidatom\'u kullanmaya başlayabilirsiniz.',
      type: 'success',
      link: '/yonetici',
    });

    await loadPendingUsers();
    setSelectedUser(null);
    setActionLoading(false);
  };

  const getDocSignedUrl = async (filePath: string) => {
    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
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
        <h1 className="heading-sm">Evrak Kontrol</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>
          {users.length} başvuru onay bekliyor
        </p>
      </div>
      <div className="page-body">
        {users.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📋</div>
            <h3 style={{ marginBottom: 'var(--space-sm)' }}>Bekleyen Başvuru Yok</h3>
            <p>Tüm başvurular incelendi. Yeni başvurular geldiğinde burada görünecek.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: selectedUser ? '1fr 1.5fr' : '1fr', gap: 'var(--space-xl)' }}>
            {/* User List */}
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="card card-hover"
                    style={{
                      cursor: 'pointer',
                      borderColor: selectedUser?.id === user.id ? 'var(--primary-500)' : undefined,
                      background: selectedUser?.id === user.id ? 'rgba(99, 102, 241, 0.05)' : undefined,
                    }}
                    onClick={() => setSelectedUser(user)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: '50%',
                        background: 'var(--gradient-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, color: '#fff', fontSize: '0.9375rem',
                        flexShrink: 0,
                      }}>
                        {user.full_name.charAt(0)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{user.full_name}</div>
                        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {user.manager_type === 'company' ? `🏢 ${user.company_name}` : '👤 Bireysel Yönetici'}
                        </div>
                      </div>
                      <span className="badge badge-warning">{user.documents.length} belge</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Document Detail */}
            {selectedUser && (
              <div className="card animate-fade-in" style={{ alignSelf: 'flex-start', position: 'sticky', top: 80 }}>
                <div style={{ marginBottom: 'var(--space-xl)' }}>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 'var(--space-xs)' }}>
                    {selectedUser.full_name}
                  </h2>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    📞 +{selectedUser.phone} &nbsp;|&nbsp; ✉️ {selectedUser.email}
                  </div>
                  {selectedUser.company_name && (
                    <div className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                      🏢 {selectedUser.company_name} &nbsp;|&nbsp; Vergi No: {selectedUser.tax_number}
                    </div>
                  )}
                  <div className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>
                    Kayıt: {formatDateTime(selectedUser.created_at)}
                  </div>
                </div>

                <h3 className="text-sm" style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Yüklenen Belgeler
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                  {selectedUser.documents.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        padding: 'var(--space-md)',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-lg)',
                        border: `1px solid ${doc.status === 'approved' ? 'var(--success)' : doc.status === 'rejected' ? 'var(--error)' : 'var(--border-primary)'}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-sm)', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                            {DOCUMENT_LABELS[doc.document_type] || doc.document_type}
                          </span>
                          <span className={`badge ${doc.status === 'approved' ? 'badge-success' : doc.status === 'rejected' ? 'badge-error' : 'badge-warning'}`} style={{ marginLeft: 8 }}>
                            {doc.status === 'approved' ? 'Onaylandı' : doc.status === 'rejected' ? 'Reddedildi' : 'Bekliyor'}
                          </span>
                        </div>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => getDocSignedUrl(doc.file_path)}
                          style={{ color: 'var(--primary-400)' }}
                        >
                          👁 Görüntüle
                        </button>
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {doc.original_filename} — {(doc.file_size / 1024).toFixed(0)} KB — v{doc.version}
                      </div>

                      {/* Action buttons */}
                      {doc.status === 'uploaded' && (
                        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleApproveDoc(doc.id)}
                            disabled={actionLoading}
                          >
                            ✓ Onayla
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setRejectDocId(doc.id)}
                            disabled={actionLoading}
                          >
                            ✕ Reddet
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Approve User Button */}
                {selectedUser.documents.length > 0 && selectedUser.documents.every(d => d.status === 'approved') && (
                  <div style={{ marginTop: 'var(--space-xl)', textAlign: 'center' }}>
                    <button
                      className="btn btn-primary btn-lg"
                      style={{ width: '100%' }}
                      onClick={() => handleApproveUser(selectedUser.id)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></span> İşleniyor...</>
                      ) : (
                        '✓ Kullanıcıyı Onayla'
                      )}
                    </button>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-sm)' }}>
                      Kullanıcıya e-posta ve bildirim gönderilecek.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Reject Modal */}
        {rejectDocId && (
          <div className="modal-overlay" onClick={() => setRejectDocId(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Belge Reddi</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setRejectDocId(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label" htmlFor="reject-reason">
                    Red Nedeni <span className="required">*</span>
                  </label>
                  <textarea
                    id="reject-reason"
                    className="form-input"
                    placeholder="Bu belgenin neden reddedildiğini açıklayın..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                  />
                  <p className="form-hint">
                    Bu açıklama kullanıcıya gösterilecektir.
                  </p>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setRejectDocId(null)}>İptal</button>
                <button
                  className="btn btn-danger"
                  onClick={handleRejectDoc}
                  disabled={!rejectReason.trim() || actionLoading}
                >
                  {actionLoading ? 'İşleniyor...' : 'Belgeyi Reddet'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
