'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Site, Block, Unit, Resident, Profile } from '@/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SiteDetailPage({ params }: PageProps) {
  const { id: siteId } = use(params);
  const supabase = createClient();

  const [site, setSite] = useState<Site | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'blocks' | 'units' | 'residents'>('summary');

  // Modal Open States
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [residentModalOpen, setResidentModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  // Form States
  const [blockForm, setBlockForm] = useState({ name: '', total_floors: 1 });
  const [unitForm, setUnitForm] = useState({
    block_id: '',
    unit_number: '',
    floor: 1,
    area_sqm: 100,
    share_ratio: 0.01,
    dues_amount: 0,
  });
  const [residentForm, setResidentForm] = useState({
    unit_id: '',
    full_name: '',
    tc_no: '',
    phone: '',
    email: '',
    is_owner: true,
  });

  // Handover state
  const [handoverModalOpen, setHandoverModalOpen] = useState(false);
  const [managers, setManagers] = useState<Profile[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');

  const loadManagers = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'site_manager')
      .eq('status', 'approved')
      .neq('id', user?.id || '');
    if (data) setManagers(data as Profile[]);
  }, [supabase]);

  const handleHandoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedManagerId) return;
    setActionLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: dbError } = await supabase.from('manager_handovers').insert({
        site_id: siteId,
        from_manager_id: user?.id,
        to_manager_id: selectedManagerId,
        notes: handoverNotes,
        status: 'pending',
      });
      if (dbError) throw dbError;

      alert('Devir talebi oluşturuldu. Sistem yöneticisi onayından sonra tamamlanacaktır.');
      setHandoverModalOpen(false);
      setHandoverNotes('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Load Site
    const { data: siteData } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .eq('manager_id', user.id)
      .is('deleted_at', null)
      .single();

    if (!siteData) {
      setSite(null);
      setLoading(false);
      return;
    }
    setSite(siteData as Site);

    // Load Blocks
    const { data: blocksData } = await supabase
      .from('blocks')
      .select('*')
      .eq('site_id', siteId)
      .is('deleted_at', null)
      .order('name', { ascending: true });
    
    const loadedBlocks = (blocksData as Block[]) || [];
    setBlocks(loadedBlocks);

    const blockIds = loadedBlocks.map((b) => b.id);
    if (blockIds.length > 0) {
      // Load Units
      const { data: unitsData } = await supabase
        .from('units')
        .select('*')
        .in('block_id', blockIds)
        .is('deleted_at', null)
        .order('unit_number', { ascending: true });
      
      const loadedUnits = (unitsData as Unit[]) || [];
      setUnits(loadedUnits);

      const unitIds = loadedUnits.map((u) => u.id);
      if (unitIds.length > 0) {
        // Load Residents
        const { data: residentsData } = await supabase
          .from('residents')
          .select('*')
          .in('unit_id', unitIds)
          .is('deleted_at', null)
          .eq('is_active', true)
          .order('full_name', { ascending: true });
        setResidents((residentsData as Resident[]) || []);
      } else {
        setResidents([]);
      }
    } else {
      setUnits([]);
      setResidents([]);
    }

    setLoading(false);
  }, [supabase, siteId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Add Block
  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!blockForm.name.trim()) return;

    setActionLoading(true);
    try {
      const { error: dbError } = await supabase.from('blocks').insert({
        site_id: siteId,
        name: blockForm.name,
        total_floors: blockForm.total_floors,
      });

      if (dbError) throw dbError;

      setBlockModalOpen(false);
      setBlockForm({ name: '', total_floors: 1 });
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Add Unit
  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!unitForm.block_id || !unitForm.unit_number.trim()) return;

    setActionLoading(true);
    try {
      const { error: dbError } = await supabase.from('units').insert({
        block_id: unitForm.block_id,
        unit_number: unitForm.unit_number,
        floor: unitForm.floor,
        area_sqm: unitForm.area_sqm,
        share_ratio: unitForm.share_ratio,
        dues_amount: unitForm.dues_amount || site?.default_dues_amount || 0,
      });

      if (dbError) throw dbError;

      setUnitModalOpen(false);
      setUnitForm({
        block_id: '',
        unit_number: '',
        floor: 1,
        area_sqm: 100,
        share_ratio: 0.01,
        dues_amount: 0,
      });
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Add Resident
  const handleAddResident = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!residentForm.unit_id || !residentForm.full_name.trim() || !residentForm.tc_no.trim()) return;

    setActionLoading(true);
    try {
      const { error: dbError } = await supabase.from('residents').insert({
        unit_id: residentForm.unit_id,
        full_name: residentForm.full_name,
        tc_no: residentForm.tc_no, // Encrypted or plain? User requested we save TC.
        phone: residentForm.phone,
        email: residentForm.email,
        is_owner: residentForm.is_owner,
      });

      if (dbError) throw dbError;

      setResidentModalOpen(false);
      setResidentForm({
        unit_id: '',
        full_name: '',
        tc_no: '',
        phone: '',
        email: '',
        is_owner: true,
      });
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-body">
        <div className="skeleton" style={{ height: 60, marginBottom: 'var(--space-xl)' }}></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-lg)' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-xl)' }}></div>
          ))}
        </div>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="page-body">
        <div className="empty-state">
          <div className="icon">🏢</div>
          <h3>Site Bulunamadı</h3>
          <p>Ulaşmaya çalıştığınız site kaydı bulunmamaktadır veya erişim yetkiniz yoktur.</p>
          <a href="/yonetici/siteler" className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }}>
            Siteler Sayfasına Dön
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
          <div>
            <h1 className="heading-sm">{site.name}</h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>
              📍 {site.address}, {site.district} / {site.city}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button className="btn btn-secondary" onClick={() => setBlockModalOpen(true)}>
              ➕ Blok Ekle
            </button>
            <button className="btn btn-secondary" onClick={() => setUnitModalOpen(true)} disabled={blocks.length === 0}>
              ➕ Daire Ekle
            </button>
            <button className="btn btn-primary" onClick={() => setResidentModalOpen(true)} disabled={units.length === 0}>
              ➕ Sakin Ekle
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ marginTop: 'var(--space-xl)' }}>
          <button className={`tab ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>
            📊 Özet / Bilgi
          </button>
          <button className={`tab ${activeTab === 'blocks' ? 'active' : ''}`} onClick={() => setActiveTab('blocks')}>
            🏢 Bloklar ({blocks.length})
          </button>
          <button className={`tab ${activeTab === 'units' ? 'active' : ''}`} onClick={() => setActiveTab('units')}>
            🔑 Daireler ({units.length})
          </button>
          <button className={`tab ${activeTab === 'residents' ? 'active' : ''}`} onClick={() => setActiveTab('residents')}>
            👥 Sakinler ({residents.length})
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Tab 1: Summary */}
        {activeTab === 'summary' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-lg)' }}>
              <div className="stat-card">
                <span className="stat-value" style={{ color: 'var(--primary-400)' }}>{blocks.length}</span>
                <span className="stat-label">Toplam Blok</span>
              </div>
              <div className="stat-card">
                <span className="stat-value" style={{ color: 'var(--accent)' }}>{units.length}</span>
                <span className="stat-label">Toplam Daire / Bağımsız Bölüm</span>
              </div>
              <div className="stat-card">
                <span className="stat-value" style={{ color: 'var(--success)' }}>{residents.length}</span>
                <span className="stat-label">Toplam Aktif Sakin</span>
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-md)' }}>Site Finansal Parametreleri</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', fontSize: '0.9375rem' }}>
                <div>Aidat Belirleme Modeli: <strong>{
                  site.dues_type === 'fixed' ? 'Sabit Tutar' : site.dues_type === 'area_based' ? 'Daire Metrekaresine (m²) Göre Oransal' : 'Arsa Payına Göre Oransal'
                }</strong></div>
                <div>Varsayılan Aylık Aidat Tutarı: <strong>{site.default_dues_amount} ₺</strong></div>
                <div>Gecikme Faizi Hesaplama Şekli: <strong>{
                  site.late_fee_type === 'legal_rate' ? 'Yasal Faiz Oranı (Yıllık %24)' : `Özel Belirlenmiş Oran (Aylık %${site.late_fee_rate})`
                }</strong></div>
              </div>
            </div>

            <div className="card" style={{ borderColor: 'var(--border-secondary)', background: 'rgba(99, 102, 241, 0.02)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>🔄 Yönetici Devir İşlemleri</h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                Bu sitenin yöneticiliğini başka bir onaylı yöneticiye devretmek istiyorsanız devir talebi oluşturabilirsiniz. 
                Talep, sistem yöneticisi onayladıktan sonra yürürlüğe girecektir.
              </p>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  loadManagers();
                  setHandoverModalOpen(true);
                }}
              >
                Yöneticiliği Devret
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Blocks */}
        {activeTab === 'blocks' && (
          <div>
            {blocks.length === 0 ? (
              <div className="empty-state">
                <div className="icon">🏢</div>
                <h3 style={{ marginBottom: 'var(--space-sm)' }}>Blok Tanımlanmamış</h3>
                <p>Sitede henüz blok yapısı bulunmamaktadır.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Blok Adı / Kodu</th>
                      <th>Toplam Kat</th>
                      <th>Daire Sayısı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blocks.map((block) => {
                      const blockUnitsCount = units.filter((u) => u.block_id === block.id).length;
                      return (
                        <tr key={block.id}>
                          <td style={{ fontWeight: 600 }}>{block.name}</td>
                          <td>{block.total_floors} Kat</td>
                          <td>{blockUnitsCount} Daire</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Units */}
        {activeTab === 'units' && (
          <div>
            {units.length === 0 ? (
              <div className="empty-state">
                <div className="icon">🔑</div>
                <h3 style={{ marginBottom: 'var(--space-sm)' }}>Daire Tanımlanmamış</h3>
                <p>Sitede henüz daire yapısı bulunmamaktadır.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Blok</th>
                      <th>Daire No</th>
                      <th>Bulunduğu Kat</th>
                      <th>Büyüklük (m²)</th>
                      <th>Arsa Payı</th>
                      <th>Aylık Aidat (₺)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((unit) => {
                      const block = blocks.find((b) => b.id === unit.block_id);
                      return (
                        <tr key={unit.id}>
                          <td>{block?.name || '-'}</td>
                          <td style={{ fontWeight: 600 }}>{unit.unit_number}</td>
                          <td>{unit.floor}. Kat</td>
                          <td>{unit.area_sqm ? `${unit.area_sqm} m²` : '-'}</td>
                          <td>{unit.share_ratio ? `${unit.share_ratio}` : '-'}</td>
                          <td style={{ fontWeight: 600, color: 'var(--primary-300)' }}>{unit.dues_amount} ₺</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Residents */}
        {activeTab === 'residents' && (
          <div>
            {residents.length === 0 ? (
              <div className="empty-state">
                <div className="icon">👥</div>
                <h3 style={{ marginBottom: 'var(--space-sm)' }}>Sakin Kaydı Yok</h3>
                <p>Dairelerde kalan ya da mülk sahibi olan sakin kaydı bulunmuyor.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ad Soyad</th>
                      <th>TC Kimlik No</th>
                      <th>Telefon</th>
                      <th>E-posta</th>
                      <th>Blok / Daire</th>
                      <th>Sakin Durumu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {residents.map((resident) => {
                      const unit = units.find((u) => u.id === resident.unit_id);
                      const block = blocks.find((b) => b?.id === unit?.block_id);
                      return (
                        <tr key={resident.id}>
                          <td style={{ fontWeight: 600 }}>{resident.full_name}</td>
                          <td>
                            {resident.tc_no ? `${resident.tc_no.slice(0, 3)}********` : '-'}
                          </td>
                          <td>{resident.phone ? `+90 ${resident.phone}` : '-'}</td>
                          <td>{resident.email || '-'}</td>
                          <td>{block?.name} - Daire {unit?.unit_number}</td>
                          <td>
                            <span className={`badge ${resident.is_owner ? 'badge-primary' : 'badge-neutral'}`}>
                              {resident.is_owner ? 'Kat Maliki' : 'Kiracı'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Block Modal */}
      {blockModalOpen && (
        <div className="modal-overlay" onClick={() => setBlockModalOpen(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleAddBlock}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Blok Ekle</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBlockModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {error && <div className="auth-alert error"><span>⚠</span><span>{error}</span></div>}
              <div className="form-group">
                <label className="form-label" htmlFor="block-name">Blok Adı / Kodu <span className="required">*</span></label>
                <input
                  id="block-name"
                  type="text"
                  className="form-input"
                  placeholder="Örn: A Blok veya B Blok"
                  value={blockForm.name}
                  onChange={(e) => setBlockForm({ ...blockForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="block-floors">Toplam Kat</label>
                <input
                  id="block-floors"
                  type="number"
                  className="form-input"
                  value={blockForm.total_floors}
                  onChange={(e) => setBlockForm({ ...blockForm, total_floors: Number(e.target.value) })}
                  min={1}
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setBlockModalOpen(false)}>İptal</button>
              <button type="submit" className="btn btn-primary" disabled={actionLoading}>Ekle</button>
            </div>
          </form>
        </div>
      )}

      {/* Unit Modal */}
      {unitModalOpen && (
        <div className="modal-overlay" onClick={() => setUnitModalOpen(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleAddUnit}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Daire Ekle</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setUnitModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {error && <div className="auth-alert error"><span>⚠</span><span>{error}</span></div>}
              <div className="form-group">
                <label className="form-label" htmlFor="unit-block">Bulunduğu Blok <span className="required">*</span></label>
                <select
                  id="unit-block"
                  className="form-input"
                  value={unitForm.block_id}
                  onChange={(e) => setUnitForm({ ...unitForm, block_id: e.target.value })}
                  required
                >
                  <option value="">Seçin...</option>
                  {blocks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="unit-number">Daire No <span className="required">*</span></label>
                  <input
                    id="unit-number"
                    type="text"
                    className="form-input"
                    placeholder="Örn: 1 veya 3B"
                    value={unitForm.unit_number}
                    onChange={(e) => setUnitForm({ ...unitForm, unit_number: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="unit-floor">Bulunduğu Kat</label>
                  <input
                    id="unit-floor"
                    type="number"
                    className="form-input"
                    value={unitForm.floor}
                    onChange={(e) => setUnitForm({ ...unitForm, floor: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="unit-area">Daire Alanı (m²)</label>
                  <input
                    id="unit-area"
                    type="number"
                    className="form-input"
                    value={unitForm.area_sqm}
                    onChange={(e) => setUnitForm({ ...unitForm, area_sqm: Number(e.target.value) })}
                    min={1}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="unit-share">Arsa Payı Oranı</label>
                  <input
                    id="unit-share"
                    type="number"
                    step="0.000001"
                    className="form-input"
                    value={unitForm.share_ratio}
                    onChange={(e) => setUnitForm({ ...unitForm, share_ratio: Number(e.target.value) })}
                    min={0}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="unit-dues">Aylık Özel Aidat Tutarı (₺ - Varsayılan: {site?.default_dues_amount} ₺)</label>
                <input
                  id="unit-dues"
                  type="number"
                  className="form-input"
                  placeholder="0 girilirse varsayılan tutar geçerli olur"
                  value={unitForm.dues_amount}
                  onChange={(e) => setUnitForm({ ...unitForm, dues_amount: Number(e.target.value) })}
                  min={0}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setUnitModalOpen(false)}>İptal</button>
              <button type="submit" className="btn btn-primary" disabled={actionLoading}>Ekle</button>
            </div>
          </form>
        </div>
      )}

      {/* Resident Modal */}
      {residentModalOpen && (
        <div className="modal-overlay" onClick={() => setResidentModalOpen(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleAddResident}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Daire Sakini Ekle</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setResidentModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {error && <div className="auth-alert error"><span>⚠</span><span>{error}</span></div>}
              <div className="form-group">
                <label className="form-label" htmlFor="resident-unit">İlişkili Daire <span className="required">*</span></label>
                <select
                  id="resident-unit"
                  className="form-input"
                  value={residentForm.unit_id}
                  onChange={(e) => setResidentForm({ ...residentForm, unit_id: e.target.value })}
                  required
                >
                  <option value="">Seçin...</option>
                  {units.map((u) => {
                    const block = blocks.find((b) => b.id === u.block_id);
                    return <option key={u.id} value={u.id}>{block?.name} - Daire {u.unit_number}</option>;
                  })}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="resident-name">Ad Soyad <span className="required">*</span></label>
                <input
                  id="resident-name"
                  type="text"
                  className="form-input"
                  placeholder="Sakin Adı Soyadı"
                  value={residentForm.full_name}
                  onChange={(e) => setResidentForm({ ...residentForm, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="resident-tc">TC Kimlik Numarası <span className="required">*</span></label>
                <input
                  id="resident-tc"
                  type="text"
                  maxLength={11}
                  className="form-input"
                  placeholder="11 haneli TC no"
                  value={residentForm.tc_no}
                  onChange={(e) => setResidentForm({ ...residentForm, tc_no: e.target.value.replace(/\D/g, '') })}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="resident-phone">Telefon Numarası</label>
                  <input
                    id="resident-phone"
                    type="tel"
                    className="form-input"
                    placeholder="5XX XXX XX XX"
                    value={residentForm.phone}
                    onChange={(e) => setResidentForm({ ...residentForm, phone: e.target.value.replace(/\D/g, '') })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="resident-email">E-posta Adresi</label>
                  <input
                    id="resident-email"
                    type="email"
                    className="form-input"
                    placeholder="ornek@mail.com"
                    value={residentForm.email}
                    onChange={(e) => setResidentForm({ ...residentForm, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Sakin Türü</label>
                <div className="manager-type-grid">
                  <div
                    className={`manager-type-card ${residentForm.is_owner ? 'selected' : ''}`}
                    onClick={() => setResidentForm({ ...residentForm, is_owner: true })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setResidentForm({ ...residentForm, is_owner: true })}
                  >
                    🏠 Kat Maliki (Ev Sahibi)
                  </div>
                  <div
                    className={`manager-type-card ${!residentForm.is_owner ? 'selected' : ''}`}
                    onClick={() => setResidentForm({ ...residentForm, is_owner: false })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setResidentForm({ ...residentForm, is_owner: false })}
                  >
                    👤 Kiracı
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setResidentModalOpen(false)}>İptal</button>
              <button type="submit" className="btn btn-primary" disabled={actionLoading}>Ekle</button>
            </div>
          </form>
        </div>
      )}

      {/* Handover Modal */}
      {handoverModalOpen && (
        <div className="modal-overlay" onClick={() => setHandoverModalOpen(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleHandoverSubmit}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Yöneticiliği Devret</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHandoverModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {error && <div className="auth-alert error"><span>⚠</span><span>{error}</span></div>}
              
              <div className="form-group">
                <label className="form-label" htmlFor="handover-manager">Devredilecek Yeni Yönetici <span className="required">*</span></label>
                <select
                  id="handover-manager"
                  className="form-input"
                  value={selectedManagerId}
                  onChange={(e) => setSelectedManagerId(e.target.value)}
                  required
                >
                  <option value="">Seçin...</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} {m.company_name ? `(${m.company_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="handover-notes">Devir Notları / Açıklama</label>
                <textarea
                  id="handover-notes"
                  className="form-input"
                  placeholder="Devir ile ilgili eklemek istediğiniz notlar..."
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setHandoverModalOpen(false)}>İptal</button>
              <button type="submit" className="btn btn-primary" disabled={actionLoading || !selectedManagerId}>
                Devir Talebi Oluştur
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
