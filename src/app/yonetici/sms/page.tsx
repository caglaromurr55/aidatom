'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime } from '@/lib/utils';
import type { Site, SmsTemplate, SmsLog } from '@/types';
import { Send, FileText, History, Building2, CheckCircle2, AlertCircle, Plus, Search, Smartphone, MessageSquare } from 'lucide-react';

interface OverdueResident {
  id: string;
  full_name: string;
  phone: string;
  totalDebt: number;
}

export default function SMSPage() {
  const supabase = createClient();
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [residents, setResidents] = useState<OverdueResident[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<'send' | 'templates' | 'logs'>('send');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Template Form State
  const [templateForm, setTemplateForm] = useState({ name: '', content: '' });

  // SMS Sending Form State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedResidentIds, setSelectedResidentIds] = useState<string[]>([]);
  const [customSmsText, setCustomSmsText] = useState<string>('');

  useEffect(() => {
    async function loadSites() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('sites')
        .select('*')
        .eq('manager_id', user.id)
        .is('deleted_at', null);
      if (data) {
        const loadedSites = data as Site[];
        setSites(loadedSites);
        if (loadedSites.length > 0) {
          setSelectedSiteId(loadedSites[0].id);
        }
      }
      setLoading(false);
    }
    loadSites();
  }, [supabase]);

  const loadSMSData = useCallback(async () => {
    if (!selectedSiteId) return;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Load Custom SMS Templates
      const { data: templatesData } = await supabase
        .from('sms_templates')
        .select('*')
        .order('created_at', { ascending: false });
      setTemplates((templatesData as SmsTemplate[]) || []);

      // 2. Load Overdue Residents for Site
      const { data: blocks } = await supabase
        .from('blocks')
        .select('id')
        .eq('site_id', selectedSiteId)
        .is('deleted_at', null);
      const blockIds = blocks?.map(b => b.id) || [];

      if (blockIds.length > 0) {
        const { data: units } = await supabase
          .from('units')
          .select('id')
          .in('block_id', blockIds)
          .is('deleted_at', null);
        const unitIds = units?.map(u => u.id) || [];

        if (unitIds.length > 0) {
          const { data: residentsData } = await supabase
            .from('residents')
            .select('id, full_name, phone')
            .in('unit_id', unitIds)
            .eq('is_active', true);
          const loadedResidents = (residentsData as any[]) || [];

          // Find overdue balances for residents
          const residentIds = loadedResidents.map(r => r.id);
          const { data: charges } = await supabase
            .from('charges')
            .select('resident_id, amount, paid_amount, status')
            .in('resident_id', residentIds)
            .eq('status', 'overdue');

          const overdueMap: Record<string, number> = {};
          charges?.forEach((c) => {
            const debt = Number(c.amount) - Number(c.paid_amount);
            overdueMap[c.resident_id] = (overdueMap[c.resident_id] || 0) + debt;
          });

          const overdueList: OverdueResident[] = loadedResidents
            .filter(r => (overdueMap[r.id] || 0) > 0)
            .map(r => ({
              id: r.id,
              full_name: r.full_name,
              phone: r.phone,
              totalDebt: overdueMap[r.id],
            }));

          setResidents(overdueList);
        } else {
          setResidents([]);
        }
      } else {
        setResidents([]);
      }

      // 3. Load SMS Logs
      const { data: logsData } = await supabase
        .from('sms_logs')
        .select(`
          *,
          residents (full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      setLogs((logsData as any[]) || []);

    } catch (err: any) {
      console.error('Error loading SMS data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSiteId, supabase]);

  useEffect(() => {
    loadSMSData();
  }, [loadSMSData]);

  // Replace tags in text
  const getParsedText = (rawContent: string, resident: OverdueResident) => {
    const currentSite = sites.find((s) => s.id === selectedSiteId);
    return rawContent
      .replace(/{resident_name}/g, resident.full_name)
      .replace(/{amount}/g, `${resident.totalDebt} ₺`)
      .replace(/{site_name}/g, currentSite?.name || 'Siteniz');
  };

  useEffect(() => {
    const selectedTpl = templates.find((t) => t.id === selectedTemplateId);
    if (selectedTpl) {
      setCustomSmsText(selectedTpl.content);
    }
  }, [selectedTemplateId, templates]);

  // Handle Add Template
  const handleAddTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.name.trim() || !templateForm.content.trim()) return;

    setActionLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: dbError } = await supabase.from('sms_templates').insert({
        name: templateForm.name,
        content: templateForm.content,
        created_by: user.id,
        is_system: false,
      });

      if (dbError) throw dbError;

      setSuccess('Şablon başarıyla oluşturuldu.');
      setTemplateForm({ name: '', content: '' });
      await loadSMSData();
      setActiveTab('send');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Send SMS
  const handleSendSMS = async () => {
    if (selectedResidentIds.length === 0 || !customSmsText.trim()) return;

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const smsInserts = [];

      for (const resId of selectedResidentIds) {
        const res = residents.find((r) => r.id === resId);
        if (!res) continue;

        const finalContent = getParsedText(customSmsText, res);
        
        smsInserts.push({
          template_id: selectedTemplateId || null,
          sent_to_phone: res.phone,
          sent_to_resident_id: res.id,
          content: finalContent,
          status: 'sent',
          sent_by: user.id,
        });
      }

      const { error: insertErr } = await supabase.from('sms_logs').insert(smsInserts);
      if (insertErr) throw insertErr;

      setSuccess(`${selectedResidentIds.length} kişiye SMS başarıyla gönderildi (Simülasyon).`);
      setSelectedResidentIds([]);
      await loadSMSData();
      setActiveTab('logs');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedResidentIds(residents.map((r) => r.id));
    } else {
      setSelectedResidentIds([]);
    }
  };

  const handleSelectResident = (resId: string, checked: boolean) => {
    if (checked) {
      setSelectedResidentIds([...selectedResidentIds, resId]);
    } else {
      setSelectedResidentIds(selectedResidentIds.filter((id) => id !== resId));
    }
  };

  if (loading && sites.length === 0) {
    return (
      <div>
        <div className="card" style={{ height: 180, backgroundColor: 'var(--bg-secondary)', opacity: 0.6 }}></div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="heading-md">SMS Bildirim Yönetimi</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            Ödemesi geciken sakinlere SMS hatırlatmaları gönderin veya hazır bildirim şablonlarını yönetin.
          </p>
        </div>
      </div>

      <div>
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

        {/* Site Filter */}
        <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building2 size={18} style={{ color: 'var(--color-teal)' }} /> Site Seçimi:
            </span>
            <div style={{ width: 260 }}>
              <select
                className="form-input"
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                aria-label="Site Seçimi"
              >
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="tabs" style={{ marginBottom: '1.5rem' }}>
          <button className={`tab ${activeTab === 'send' ? 'active' : ''}`} onClick={() => setActiveTab('send')}>
            <Send size={18} />
            <span>SMS Gönderimi</span>
          </button>
          <button className={`tab ${activeTab === 'templates' ? 'active' : ''}`} onClick={() => setActiveTab('templates')}>
            <FileText size={18} />
            <span>Şablonlar ({templates.length})</span>
          </button>
          <button className={`tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
            <History size={18} />
            <span>Gönderim Geçmişi ({logs.length})</span>
          </button>
        </div>

        {/* Tab 1: Send SMS */}
        {activeTab === 'send' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
            {/* Left: Overdue Residents list */}
            <div className="card">
              <h2 className="heading-sm" style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>
                Borçlu Sakinler ({residents.length})
              </h2>
              {residents.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Ödemesi geciken sakin bulunmamaktadır.</p>
              ) : (
                <div className="table-wrapper" style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <table className="table" style={{ fontSize: '0.875rem' }}>
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>
                          <input
                            type="checkbox"
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            checked={selectedResidentIds.length === residents.length && residents.length > 0}
                            aria-label="Tümünü Seç"
                          />
                        </th>
                        <th>Ad Soyad</th>
                        <th>Telefon</th>
                        <th>Borç Tutarı</th>
                      </tr>
                    </thead>
                    <tbody>
                      {residents.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedResidentIds.includes(r.id)}
                              onChange={(e) => handleSelectResident(r.id, e.target.checked)}
                              aria-label={`${r.full_name} seç`}
                            />
                          </td>
                          <td style={{ fontWeight: 600 }}>{r.full_name}</td>
                          <td>{r.phone}</td>
                          <td style={{ fontWeight: 700, color: 'var(--error)' }}>{r.totalDebt} ₺</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right: SMS Text Composer */}
            <div className="card">
              <h2 className="heading-sm" style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>
                Mesaj Oluştur
              </h2>

              <div className="form-group">
                <label className="form-label">Şablon Seçin (Opsiyonel)</label>
                <select
                  className="form-input"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                >
                  <option value="">-- Özel Mesaj Yazın --</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">SMS Metni <span className="required">*</span></label>
                <textarea
                  className="form-input"
                  rows={4}
                  value={customSmsText}
                  onChange={(e) => setCustomSmsText(e.target.value)}
                  placeholder="Sayın {resident_name}, {site_name} yönetimi olarak..."
                ></textarea>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  Kullanılabilir Etiketler: <code>{`{resident_name}`}</code>, <code>{`{amount}`}</code>, <code>{`{site_name}`}</code>
                </span>
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '1rem' }}
                onClick={handleSendSMS}
                disabled={actionLoading || selectedResidentIds.length === 0 || !customSmsText.trim()}
              >
                <Send size={18} />
                {actionLoading ? 'Gönderiliyor...' : `Seçili ${selectedResidentIds.length} Sakine SMS Gönder`}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: SMS Templates */}
        {activeTab === 'templates' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.5rem', alignItems: 'start' }}>
            <div className="card">
              <h2 className="heading-sm" style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>
                Yeni Şablon Ekle
              </h2>
              <form onSubmit={handleAddTemplate}>
                <div className="form-group">
                  <label className="form-label">Şablon Adı <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Örn: 1. Hatırlatma Mesajı"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Mesaj Şablonu <span className="required">*</span></label>
                  <textarea
                    className="form-input"
                    rows={4}
                    placeholder="Sayın {resident_name}, ödenmemiş {amount} borcunuz bulunmaktadır..."
                    value={templateForm.content}
                    onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                    required
                  ></textarea>
                </div>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  <Plus size={18} /> Şablonu Kaydet
                </button>
              </form>
            </div>

            <div className="card">
              <h2 className="heading-sm" style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>
                Kayıtlı Şablonlar
              </h2>
              {templates.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Henüz kayıtlı şablon bulunmamaktadır.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {templates.map((t) => (
                    <div key={t.id} style={{ border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                      <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{t.name}</div>
                      <div className="text-sm" style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                        {t.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: SMS Logs */}
        {activeTab === 'logs' && (
          <div className="card">
            <h2 className="heading-sm" style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>
              Gönderilen SMS Geçmişi
            </h2>
            {logs.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Henüz gönderilmiş SMS kaydı yok.</p>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Alıcı</th>
                      <th>Telefon</th>
                      <th>Gönderilen Metin</th>
                      <th>Tarih</th>
                      <th>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td style={{ fontWeight: 600 }}>{log.residents?.full_name || 'Bilinmeyen'}</td>
                        <td>{log.sent_to_phone}</td>
                        <td className="text-sm" style={{ maxWidth: 300 }}>{log.content}</td>
                        <td className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{formatDateTime(log.created_at)}</td>
                        <td><span className="badge badge-success">Gönderildi</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
