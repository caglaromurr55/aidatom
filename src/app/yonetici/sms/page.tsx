'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime } from '@/lib/utils';
import type { Site, SmsTemplate, SmsLog } from '@/types';

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
            .select('resident_id, amount, paid_amount')
            .in('resident_id', residentIds)
            .or('status.eq.overdue,status.eq.partially_paid');

          const overdueMap: Record<string, number> = {};
          charges?.forEach((c) => {
            const pending = Number(c.amount) - Number(c.paid_amount);
            if (pending > 0) {
              overdueMap[c.resident_id] = (overdueMap[c.resident_id] || 0) + pending;
            }
          });

          const enrichedResidents: OverdueResident[] = loadedResidents
            .map((r) => ({
              id: r.id,
              full_name: r.full_name,
              phone: r.phone || '',
              totalDebt: overdueMap[r.id] || 0,
            }))
            .filter((r) => r.totalDebt > 0);

          setResidents(enrichedResidents);
        }
      }

      // 3. Load SMS logs
      const { data: logsData } = await supabase
        .from('sms_logs')
        .select(`
          *,
          residents (full_name)
        `)
        .eq('sent_by', user.id)
        .order('created_at', { ascending: false });
      
      setLogs((logsData as any[]) || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase, selectedSiteId]);

  useEffect(() => {
    loadSMSData();
  }, [loadSMSData]);

  // Preview content helper
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

      const currentSite = sites.find((s) => s.id === selectedSiteId);
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
          status: 'sent' as const, // Simulating direct successful send
          sent_by: user.id,
        });
      }

      const { error: dbError } = await supabase.from('sms_logs').insert(smsInserts);
      if (dbError) throw dbError;

      // Log audit
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'sms_notifications_sent',
        entity_type: 'site',
        entity_id: selectedSiteId,
        new_values: { count: smsInserts.length },
      });

      setSuccess(`Başarıyla ${smsInserts.length} sakine hatırlatma SMS'i gönderildi (simüle edildi).`);
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
      <div className="page-body">
        <div className="skeleton" style={{ height: 180, borderRadius: 'var(--radius-xl)' }}></div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
        <div>
          <h1 className="heading-sm">SMS Bildirim Yönetimi</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>
            Ödemesi geciken sakinlere SMS hatırlatmaları gönderin veya hazır bildirim şablonlarını yönetin.
          </p>
        </div>
      </div>

      <div className="page-body">
        {success && <div className="auth-alert success" style={{ marginBottom: 'var(--space-lg)' }}><span>✓</span><span>{success}</span></div>}
        {error && <div className="auth-alert error" style={{ marginBottom: 'var(--space-lg)' }}><span>⚠</span><span>{error}</span></div>}

        {/* Site Filter */}
        <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)', alignItems: 'center' }}>
          <span className="form-label" style={{ margin: 0 }}>Site Seçimi:</span>
          <div style={{ width: 220 }}>
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

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 'var(--space-xl)' }}>
          <button className={`tab ${activeTab === 'send' ? 'active' : ''}`} onClick={() => setActiveTab('send')}>
            📱 SMS Gönderimi
          </button>
          <button className={`tab ${activeTab === 'templates' ? 'active' : ''}`} onClick={() => setActiveTab('templates')}>
            💬 Şablonlar ({templates.length})
          </button>
          <button className={`tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
            📜 Gönderim Geçmişi ({logs.length})
          </button>
        </div>

        {/* Tab 1: Send SMS */}
        {activeTab === 'send' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--space-xl)', alignItems: 'start' }}>
            {/* Left: Overdue Residents list */}
            <div className="card">
              <h2 className="heading-sm" style={{ fontSize: '1rem', marginBottom: 'var(--space-lg)' }}>Borçlu Sakinler ({residents.length})</h2>
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
                            checked={selectedResidentIds.length === residents.length && residents.length > 0}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            aria-label="Tümünü Seç"
                          />
                        </th>
                        <th>Sakin</th>
                        <th>Telefon</th>
                        <th>Borç Tutarı</th>
                      </tr>
                    </thead>
                    <tbody>
                      {residents.map((res) => (
                        <tr key={res.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedResidentIds.includes(res.id)}
                              onChange={(e) => handleSelectResident(res.id, e.target.checked)}
                              aria-label={`${res.full_name} Seç`}
                            />
                          </td>
                          <td style={{ fontWeight: 600 }}>{res.full_name}</td>
                          <td>{res.phone ? `+90 ${res.phone}` : '-'}</td>
                          <td style={{ color: 'var(--error-light)', fontWeight: 600 }}>{res.totalDebt} ₺</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right: Template selection & Text Box */}
            <div className="card">
              <h2 className="heading-sm" style={{ fontSize: '1rem', marginBottom: 'var(--space-lg)' }}>SMS Metni Hazırla</h2>
              <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                <label className="form-label" htmlFor="select-template">Hazır Şablon Seçin</label>
                <select
                  id="select-template"
                  className="form-input"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                >
                  <option value="">Serbest Metin Girin...</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
                <label className="form-label" htmlFor="sms-text-area">Mesaj İçeriği</label>
                <textarea
                  id="sms-text-area"
                  className="form-input"
                  value={customSmsText}
                  onChange={(e) => setCustomSmsText(e.target.value)}
                  placeholder="SMS mesajınızı yazın..."
                  rows={5}
                />
                {/* Dynamic Parameter Badges */}
                <div style={{ marginTop: 'var(--space-sm)', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button type="button" className="badge badge-neutral" style={{ cursor: 'pointer' }} onClick={() => setCustomSmsText(prev => prev + '{resident_name}')}>
                    {`{resident_name}`}
                  </button>
                  <button type="button" className="badge badge-neutral" style={{ cursor: 'pointer' }} onClick={() => setCustomSmsText(prev => prev + '{amount}')}>
                    {`{amount}`}
                  </button>
                  <button type="button" className="badge badge-neutral" style={{ cursor: 'pointer' }} onClick={() => setCustomSmsText(prev => prev + '{site_name}')}>
                    {`{site_name}`}
                  </button>
                </div>
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={handleSendSMS}
                disabled={selectedResidentIds.length === 0 || !customSmsText.trim() || actionLoading}
              >
                {actionLoading ? 'SMS Gönderiliyor...' : `Seçilen ${selectedResidentIds.length} Kişiye Gönder ➔`}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: SMS Templates */}
        {activeTab === 'templates' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--space-xl)', alignItems: 'start' }}>
            <div className="card">
              <h2 className="heading-sm" style={{ fontSize: '1rem', marginBottom: 'var(--space-lg)' }}>Mevcut SMS Şablonları</h2>
              {templates.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Kayıtlı özel şablon bulunmuyor.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                  {templates.map((tpl) => (
                    <div key={tpl.id} style={{ padding: 'var(--space-md)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)' }}>
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>{tpl.name}</div>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)', fontStyle: 'italic', wordBreak: 'break-all' }}>
                        {tpl.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Template Card */}
            <form className="card" onSubmit={handleAddTemplate}>
              <h2 className="heading-sm" style={{ fontSize: '1rem', marginBottom: 'var(--space-lg)' }}>Yeni Şablon Ekle</h2>
              <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                <label className="form-label" htmlFor="tpl-name">Şablon Adı <span className="required">*</span></label>
                <input
                  id="tpl-name"
                  type="text"
                  className="form-input"
                  placeholder="Örn: Gecikme Uyarı Yazısı"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
                <label className="form-label" htmlFor="tpl-content">Şablon Mesajı <span className="required">*</span></label>
                <textarea
                  id="tpl-content"
                  className="form-input"
                  placeholder="Örn: Sayın {resident_name}, {site_name} sitenize ait {amount} aidat borcunuz bulunmaktadır..."
                  value={templateForm.content}
                  onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                  rows={4}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={actionLoading}>
                Şablonu Kaydet
              </button>
            </form>
          </div>
        )}

        {/* Tab 3: Sent SMS Logs */}
        {activeTab === 'logs' && (
          <div className="card">
            <h2 className="heading-sm" style={{ fontSize: '1rem', marginBottom: 'var(--space-lg)' }}>Gönderim Geçmişi</h2>
            {logs.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Henüz gönderilmiş SMS kaydı bulunmamaktadır.</p>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Sakin</th>
                      <th>Telefon</th>
                      <th>Mesaj</th>
                      <th>Durum</th>
                      <th>Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td style={{ fontWeight: 600 }}>{log.residents?.full_name || 'Silinmiş Sakin'}</td>
                        <td>+{log.sent_to_phone}</td>
                        <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.content}>
                          {log.content}
                        </td>
                        <td>
                          <span className="badge badge-success">Gönderildi</span>
                        </td>
                        <td className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                          {formatDateTime(log.created_at)}
                        </td>
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
