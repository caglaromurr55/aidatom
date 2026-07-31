'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { USER_STATUS_LABELS, formatDateTime } from '@/lib/utils';
import type { Profile, UserRole, UserStatus, ManagerType } from '@/types';
import { 
  UserPlus, 
  UserCheck, 
  UserX, 
  ShieldCheck, 
  Search, 
  Edit3, 
  CheckCircle2, 
  AlertCircle,
  X
} from 'lucide-react';

export default function AdminKullanicilarPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  // Add User Form State
  const [addForm, setAddForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    password: 'Password123!',
    role: 'site_manager' as UserRole,
    manager_type: 'individual' as ManagerType,
    company_name: '',
  });

  // Edit User Form State
  const [editForm, setEditForm] = useState({
    role: 'site_manager' as UserRole,
    status: 'approved' as UserStatus,
  });

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

  // Handle Add New User by Patron
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setActionLoading('add');

    try {
      // Clean phone number
      const cleanPhone = addForm.phone.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        throw new Error('Geçerli bir telefon numarası giriniz (en az 10 hane).');
      }

      const generatedId = crypto.randomUUID();
      const generatedEmail = addForm.email.trim() || `${cleanPhone}@aidatom.com`;

      // 1. Insert into public.profiles
      const { error: profileError } = await supabase.from('profiles').insert({
        id: generatedId,
        full_name: addForm.full_name,
        phone: cleanPhone,
        email: generatedEmail,
        manager_type: addForm.manager_type,
        role: addForm.role,
        status: 'approved',
        company_name: addForm.manager_type === 'company' ? addForm.company_name : null,
      });

      if (profileError) {
        if (profileError.message.includes('profiles_phone_key')) {
          throw new Error('Bu telefon numarası ile kayıtlı bir kullanıcı zaten mevcut.');
        }
        throw profileError;
      }

      setSuccess(`Kullanıcı (${addForm.full_name}) başarıyla eklendi ve hesabı onaylandı.`);
      setAddModalOpen(false);
      setAddForm({
        full_name: '',
        phone: '',
        email: '',
        password: 'Password123!',
        role: 'site_manager',
        manager_type: 'individual',
        company_name: '',
      });
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Kullanıcı eklenirken bir hata oluştu.');
    } finally {
      setActionLoading(null);
    }
  };

  // Open Edit Role & Status Modal
  const openEditModal = (user: Profile) => {
    setSelectedUser(user);
    setEditForm({
      role: user.role,
      status: user.status,
    });
    setEditModalOpen(true);
  };

  // Handle Update User Role & Status
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setError('');
    setSuccess('');
    setActionLoading(selectedUser.id);

    try {
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          role: editForm.role,
          status: editForm.status,
        })
        .eq('id', selectedUser.id);

      if (updateErr) throw updateErr;

      setSuccess(`${selectedUser.full_name} kullanıcısının rolü (${getRoleLabel(editForm.role)}) ve durumu güncellendi.`);
      setEditModalOpen(false);
      setSelectedUser(null);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Kullanıcı güncellenirken bir hata oluştu.');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: string) => {
    setActionLoading(userId);
    const newStatus = currentStatus === 'suspended' ? 'approved' : 'suspended';

    const { error: err } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', userId);

    if (!err) {
      await loadUsers();
    }
    setActionLoading(null);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin': return 'Patron (Süper Admin)';
      case 'system_admin': return 'Sistem Yöneticisi';
      case 'site_manager': return 'Site Yöneticisi';
      case 'lawyer': return 'Sözleşmeli Avukat';
      case 'call_center': return 'Santral Görevlisi';
      default: return role;
    }
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
          <div key={i} className="card" style={{ height: 80, backgroundColor: 'var(--bg-secondary)', marginBottom: '1rem', opacity: 0.6 }}></div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="heading-md">Platform Üye & Rol Yönetimi</h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
              Sistemdeki tüm kullanıcıları yönetin, yeni yetkili/avukat/santral görevlisi ekleyin ve rolleri belirleyin.
            </p>
          </div>
          <div>
            <button className="btn btn-primary btn-sm" onClick={() => setAddModalOpen(true)}>
              <UserPlus size={16} /> Yeni Kullanıcı Ekle
            </button>
          </div>
        </div>
      </div>

      <div className="page-body">
        {success && (
          <div className="badge badge-success" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem', width: '100%', fontSize: '0.9rem' }}>
            <CheckCircle2 size={16} /> {success}
          </div>
        )}
        {error && (
          <div className="badge badge-error" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem', width: '100%', fontSize: '0.9rem' }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Filters */}
        <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Ad, telefon, e-posta veya şirket ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div style={{ width: 180 }}>
              <select
                className="form-input"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                aria-label="Rol Seçimi"
              >
                <option value="all">Tüm Roller</option>
                <option value="site_manager">Site Yöneticisi</option>
                <option value="lawyer">Sözleşmeli Avukat</option>
                <option value="call_center">Santral Görevlisi</option>
                <option value="system_admin">Sistem Adm.</option>
                <option value="super_admin">Süper Admin</option>
              </select>
            </div>
            <div style={{ width: 180 }}>
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
        </div>

        {/* Users Table */}
        {filteredUsers.length === 0 ? (
          <div className="empty-state">
            <div className="icon">
              <UserX size={32} />
            </div>
            <h3>Kullanıcı Bulunamadı</h3>
            <p>Filtrelerinize uygun üye bulunmamaktadır.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>Sistem Rolü</th>
                  <th>Yönetici Tipi</th>
                  <th>Durum</th>
                  <th>Kayıt Tarihi</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          backgroundColor: user.role === 'super_admin' ? '#8B5CF6' : user.role === 'call_center' ? 'var(--color-teal)' : 'var(--color-navy)',
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
                      <span className="badge badge-neutral" style={{ fontWeight: 600 }}>
                        {getRoleLabel(user.role)}
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
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            title="Rol & Durum Düzenle"
                            onClick={() => openEditModal(user)}
                          >
                            <Edit3 size={16} /> Düzenle
                          </button>

                          <button
                            className={`btn ${user.status === 'suspended' ? 'btn-success' : 'btn-danger'} btn-sm`}
                            onClick={() => toggleUserStatus(user.id, user.status)}
                            disabled={actionLoading === user.id}
                            style={{ minWidth: 95 }}
                          >
                            {actionLoading === user.id ? '...' : user.status === 'suspended' ? 'Aktifleştir' : 'Askıya Al'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Add New User */}
      {addModalOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 className="heading-sm" style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={20} style={{ color: 'var(--color-teal)' }} /> Yeni Kullanıcı Ekle
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setAddModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddUser}>
              <div className="form-group">
                <label className="form-label">Ad Soyad <span className="required">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Örn: Av. Mehmet Yılmaz"
                  value={addForm.full_name}
                  onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Telefon (Giriş için) <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="905551112233"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">E-Posta Adresi</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="ornek@aidatom.com"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Sistem Rolü <span className="required">*</span></label>
                  <select
                    className="form-input"
                    value={addForm.role}
                    onChange={(e) => setAddForm({ ...addForm, role: e.target.value as UserRole })}
                  >
                    <option value="site_manager">Site Yöneticisi</option>
                    <option value="lawyer">Sözleşmeli Avukat</option>
                    <option value="call_center">Santral Görevlisi</option>
                    <option value="system_admin">Sistem Yöneticisi</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Yönetici Tipi</label>
                  <select
                    className="form-input"
                    value={addForm.manager_type}
                    onChange={(e) => setAddForm({ ...addForm, manager_type: e.target.value as ManagerType })}
                  >
                    <option value="individual">Bireysel</option>
                    <option value="company">Şirket / Kurumsal</option>
                  </select>
                </div>
              </div>

              {addForm.manager_type === 'company' && (
                <div className="form-group">
                  <label className="form-label">Şirket Ünvanı</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ABC Profesyonel Site Yönetimi A.Ş."
                    value={addForm.company_name}
                    onChange={(e) => setAddForm({ ...addForm, company_name: e.target.value })}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAddModalOpen(false)}>İptal</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading === 'add'}>
                  {actionLoading === 'add' ? 'Ekleniyor...' : 'Kullanıcıyı Kaydet & Onayla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit User Role & Status */}
      {editModalOpen && selectedUser && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 450 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 className="heading-sm" style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} style={{ color: 'var(--color-teal)' }} /> Rol & Durum Düzenle
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '1rem', background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontWeight: 700 }}>{selectedUser.full_name}</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>📞 +{selectedUser.phone}</div>
            </div>

            <form onSubmit={handleUpdateUser}>
              <div className="form-group">
                <label className="form-label">Sistem Rolü</label>
                <select
                  className="form-input"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                >
                  <option value="site_manager">Site Yöneticisi</option>
                  <option value="lawyer">Sözleşmeli Avukat</option>
                  <option value="call_center">Santral Görevlisi</option>
                  <option value="system_admin">Sistem Yöneticisi</option>
                  <option value="super_admin">Patron (Süper Admin)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Hesap Durumu</label>
                <select
                  className="form-input"
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as UserStatus })}
                >
                  <option value="approved">Aktif / Onaylı</option>
                  <option value="suspended">Askıya Alınmış</option>
                  <option value="pending_review">Evrak İncelemede</option>
                  <option value="pending_documents">Evrak Bekliyor</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditModalOpen(false)}>İptal</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading === selectedUser.id}>
                  {actionLoading === selectedUser.id ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
