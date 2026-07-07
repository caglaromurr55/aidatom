'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { USER_STATUS_LABELS, formatDateTime } from '@/lib/utils';
import type { Profile } from '@/types';

export default function AdminKullanicilarPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      setUsers(data as Profile[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const toggleUserStatus = async (userId: string, currentStatus: string) => {
    setActionLoading(userId);
    const newStatus = currentStatus === 'suspended' ? 'approved' : 'suspended';
    
    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', userId);

    if (!error) {
      await loadUsers();
    }
    setActionLoading(null);
  };

  const filteredUsers = users.filter((user) => {
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    const matchesSearch =
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone.includes(searchTerm) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.company_name && user.company_name.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesRole && matchesStatus && matchesSearch;
  });

  if (loading && users.length === 0) {
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
        <h1 className="heading-sm">Platform Üye Yönetimi</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>
          Platform genelindeki tüm site yöneticilerini ve avukatları askıya alın veya aktifleştirin.
        </p>
      </div>

      <div className="page-body">
        {/* Filters */}
        <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Ad, telefon, e-posta veya şirket ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ width: 160 }}>
            <select
              className="form-input"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Rol Seçimi"
            >
              <option value="all">Tüm Roller</option>
              <option value="site_manager">Site Yöneticisi</option>
              <option value="lawyer">Avukat</option>
              <option value="system_admin">Sistem Adm.</option>
            </select>
          </div>
          <div style={{ width: 160 }}>
            <select
              className="form-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Durum Seçimi"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="approved">Aktif / Onaylı</option>
              <option value="suspended">Askıya Alınmış</option>
              <option value="pending_review">Onay Bekleyen</option>
              <option value="pending_documents">Evrak Bekleyen</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        {filteredUsers.length === 0 ? (
          <div className="empty-state">
            <div className="icon">👥</div>
            <h3>Kullanıcı Bulunamadı</h3>
            <p>Filtrelerinize uygun üye bulunmamaktadır.</p>
          </div>
        ) : (
          <div className="table-wrapper animate-fade-in">
            <table className="table">
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>Rol</th>
                  <th>Yönetici Şekli</th>
                  <th>Durum</th>
                  <th>Kayıt Tarihi</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: 'var(--gradient-primary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, color: '#fff', fontSize: '0.875rem'
                        }}>
                          {user.full_name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{user.full_name}</div>
                          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            📞 +{user.phone} &nbsp;|&nbsp; ✉️ {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ textTransform: 'none' }}>
                        {user.role === 'site_manager' ? 'Site Yöneticisi' : user.role === 'lawyer' ? 'Avukat' : 'Sistem Admin'}
                      </span>
                    </td>
                    <td>
                      {user.manager_type === 'company' ? (
                        <div>
                          <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>🏢 Şirket</div>
                          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{user.company_name}</div>
                        </div>
                      ) : (
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>👤 Bireysel</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${
                        user.status === 'approved' ? 'badge-success' :
                        user.status === 'suspended' ? 'badge-error' :
                        user.status === 'pending_review' ? 'badge-warning' : 'badge-neutral'
                      }`}>
                        {USER_STATUS_LABELS[user.status] || user.status}
                      </span>
                    </td>
                    <td className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      {formatDateTime(user.created_at)}
                    </td>
                    <td>
                      {user.role !== 'super_admin' && (
                        <button
                          className={`btn ${user.status === 'suspended' ? 'btn-success' : 'btn-danger'} btn-sm`}
                          onClick={() => toggleUserStatus(user.id, user.status)}
                          disabled={actionLoading === user.id}
                          style={{ minWidth: 110 }}
                        >
                          {actionLoading === user.id ? 'İşleniyor...' : user.status === 'suspended' ? 'Aktifleştir' : 'Askıya Al'}
                        </button>
                      )}
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
