'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { ContactRequest, CallLog, Resident } from '@/types';
import { 
  PhoneCall, 
  PhoneForwarded, 
  History, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  MessageSquare, 
  Search, 
  X,
  PhoneOff,
  Clock,
  CheckSquare
} from 'lucide-react';

interface OverdueResidentWithSite extends Resident {
  totalDebt: number;
  siteName: string;
  unitNumber: string;
}

export default function SantralDashboard() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'contacts' | 'debtors' | 'logs'>('contacts');
  
  const [contacts, setContacts] = useState<ContactRequest[]>([]);
  const [debtors, setDebtors] = useState<OverdueResidentWithSite[]>([]);
  const [callLogs, setCallLogs] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Call Simulation Modal State
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callingState, setCallingState] = useState<'initiating' | 'connected' | 'ended'>('initiating');
  const [targetContact, setTargetContact] = useState<{
    phone: string;
    name: string;
    residentId?: string;
    contactRequestId?: string;
    contextText?: string;
  } | null>(null);

  const [callStatus, setCallStatus] = useState<'reached' | 'promise_given' | 'not_reached' | 'wrong_number' | 'busy'>('reached');
  const [callNotes, setCallNotes] = useState('');

  const loadSantralData = useCallback(async () => {
    setLoading(true);

    try {
      // 1. Load Contact Requests
      const { data: contactsData } = await supabase
        .from('contact_requests')
        .select('*')
        .order('created_at', { ascending: false });
      setContacts((contactsData as ContactRequest[]) || []);

      // 2. Load Overdue Debtors across sites
      const { data: residentsData } = await supabase
        .from('residents')
        .select(`
          id,
          unit_id,
          full_name,
          phone,
          tc_no,
          is_active,
          units (
            unit_number,
            blocks (
              site_id,
              sites (name)
            )
          )
        `)
        .eq('is_active', true);

      const loadedResidents = (residentsData as any[]) || [];
      const residentIds = loadedResidents.map(r => r.id);

      if (residentIds.length > 0) {
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

        const overdueList: OverdueResidentWithSite[] = loadedResidents
          .filter(r => (overdueMap[r.id] || 0) > 0)
          .map(r => ({
            id: r.id,
            unit_id: r.unit_id,
            full_name: r.full_name,
            tc_no: r.tc_no,
            phone: r.phone,
            email: r.email,
            is_owner: r.is_owner,
            move_in_date: r.move_in_date,
            move_out_date: r.move_out_date,
            is_active: r.is_active,
            created_at: r.created_at,
            updated_at: r.updated_at,
            deleted_at: r.deleted_at,
            totalDebt: overdueMap[r.id],
            siteName: r.units?.blocks?.sites?.name || 'Site',
            unitNumber: r.units?.unit_number || '-',
          }));

        setDebtors(overdueList);
      } else {
        setDebtors([]);
      }

      // 3. Load Call Logs
      const { data: logsData } = await supabase
        .from('call_logs')
        .select(`
          *,
          profiles (full_name)
        `)
        .order('call_date', { ascending: false });
      setCallLogs((logsData as any[]) || []);

    } catch (err: any) {
      console.error('Error loading Santral data:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadSantralData();
  }, [loadSantralData]);

  // Start Call Simulation Modal
  const initiateCall = (phone: string, name: string, residentId?: string, contactRequestId?: string, contextText?: string) => {
    setTargetContact({ phone, name, residentId, contactRequestId, contextText });
    setCallingState('initiating');
    setCallStatus('reached');
    setCallNotes('');
    setCallModalOpen(true);

    // Simulate WebRTC connection delay
    setTimeout(() => {
      setCallingState('connected');
    }, 1500);
  };

  // Submit Call Outcome & Save Log
  const handleSaveCallLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetContact || !callNotes.trim()) return;

    setActionLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Insert into call_logs
      const { error: logErr } = await supabase.from('call_logs').insert({
        resident_id: targetContact.residentId || null,
        contact_request_id: targetContact.contactRequestId || null,
        called_by: user.id,
        phone: targetContact.phone,
        call_status: callStatus,
        notes: callNotes,
        call_date: new Date().toISOString(),
      });

      if (logErr) throw logErr;

      // 2. If called from contact request, mark contact request as read/handled
      if (targetContact.contactRequestId) {
        await supabase
          .from('contact_requests')
          .update({ is_read: true, read_by: user.id })
          .eq('id', targetContact.contactRequestId);
      }

      setSuccess(`Arama kaydı (${targetContact.name}) başarıyla tamamlandı ve sisteme işlendi.`);
      setCallModalOpen(false);
      setTargetContact(null);
      await loadSantralData();
    } catch (err: any) {
      setError(err.message || 'Arama kaydı kaydedilirken hata oluştu.');
    } finally {
      setActionLoading(false);
    }
  };

  const getCallStatusBadge = (status: string) => {
    switch (status) {
      case 'promise_given':
        return <span className="badge badge-success">Ödeme Sözü Alındı</span>;
      case 'reached':
        return <span className="badge badge-primary">Görüşüldü</span>;
      case 'not_reached':
        return <span className="badge badge-warning">Ulaşılamadı</span>;
      case 'busy':
        return <span className="badge badge-warning">Meşgul</span>;
      case 'wrong_number':
        return <span className="badge badge-error">Yanlış Numara</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  if (loading && contacts.length === 0) {
    return (
      <div>
        <div className="card" style={{ height: 180, backgroundColor: 'var(--bg-secondary)', opacity: 0.6 }}></div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="heading-md">Santral & Çağrı Operasyon Paneli</h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
              Gelen web taleplerini arayın, borçlu sakinler ile görüşüp ödeme sözü notları alın.
            </p>
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

        {/* Tabs Bar */}
        <div className="tabs" style={{ marginBottom: '1.5rem' }}>
          <button className={`tab ${activeTab === 'contacts' ? 'active' : ''}`} onClick={() => setActiveTab('contacts')}>
            <PhoneCall size={18} />
            <span>Web İletişim Talepleri ({contacts.filter(c => !c.is_read).length})</span>
          </button>
          <button className={`tab ${activeTab === 'debtors' ? 'active' : ''}`} onClick={() => setActiveTab('debtors')}>
            <PhoneForwarded size={18} />
            <span>Borçlu Sakin Arama Listesi ({debtors.length})</span>
          </button>
          <button className={`tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
            <History size={18} />
            <span>Arama Geçmişi & Notlar ({callLogs.length})</span>
          </button>
        </div>

        {/* Tab 1: Web Contact Requests */}
        {activeTab === 'contacts' && (
          <div className="card">
            <h2 className="heading-sm" style={{ fontSize: '1.05rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PhoneCall size={20} style={{ color: 'var(--color-teal)' }} /> Siteden Gelen İletişim ve Ön Analiz Talepleri
            </h2>
            {contacts.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Henüz başvuru bulunmuyor.</p>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ad Soyad</th>
                      <th>Telefon</th>
                      <th>E-Posta</th>
                      <th>Mesaj / Analiz Notu</th>
                      <th>Tarih</th>
                      <th>Durum</th>
                      <th>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.full_name}</td>
                        <td style={{ fontWeight: 600, color: 'var(--color-navy)' }}>{c.phone}</td>
                        <td className="text-sm">{c.email || '-'}</td>
                        <td className="text-xs" style={{ maxWidth: 300 }}>{c.message}</td>
                        <td className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{formatDateTime(c.created_at)}</td>
                        <td>
                          {c.is_read ? (
                            <span className="badge badge-success">Görüşüldü</span>
                          ) : (
                            <span className="badge badge-warning">Arama Bekliyor</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => initiateCall(c.phone, c.full_name, undefined, c.id, c.message)}
                          >
                            <PhoneCall size={14} /> Arama Başlat
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Overdue Debtors List */}
        {activeTab === 'debtors' && (
          <div className="card">
            <h2 className="heading-sm" style={{ fontSize: '1.05rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PhoneForwarded size={20} style={{ color: 'var(--color-teal)' }} /> Ödemesi Gecikmiş Sakinler
            </h2>
            {debtors.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Arama gerektiren borçlu sakin bulunmamaktadır.</p>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ad Soyad / Malik</th>
                      <th>Bağlı Site</th>
                      <th>Daire No</th>
                      <th>Telefon</th>
                      <th>Geciken Aidat Borcu</th>
                      <th>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debtors.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.full_name}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Building2 size={14} style={{ color: 'var(--text-tertiary)' }} />
                            {r.siteName}
                          </div>
                        </td>
                        <td>Daire {r.unitNumber}</td>
                        <td style={{ fontWeight: 600 }}>{r.phone || '-'}</td>
                        <td style={{ fontWeight: 700, color: 'var(--error)' }}>{formatCurrency(r.totalDebt)}</td>
                        <td>
                          <button
                            className="btn btn-teal-solid btn-sm"
                            onClick={() => initiateCall(r.phone || '905550000000', r.full_name, r.id, undefined, `${r.siteName} Daire ${r.unitNumber} - Borç: ${formatCurrency(r.totalDebt)}`)}
                            disabled={!r.phone}
                          >
                            <PhoneCall size={14} /> Sistemden Ara
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Call Logs History */}
        {activeTab === 'logs' && (
          <div className="card">
            <h2 className="heading-sm" style={{ fontSize: '1.05rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={20} style={{ color: 'var(--color-teal)' }} /> Yapılan Arama Kayıtları ({callLogs.length})
            </h2>
            {callLogs.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Henüz arama kaydı girilmedi.</p>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Arama Tarihi</th>
                      <th>Aranan Telefon</th>
                      <th>Arama Sonucu</th>
                      <th>Görüşme Notları</th>
                      <th>Arayan Görevli</th>
                    </tr>
                  </thead>
                  <tbody>
                    {callLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="text-xs">{formatDateTime(log.call_date)}</td>
                        <td style={{ fontWeight: 600 }}>{log.phone}</td>
                        <td>{getCallStatusBadge(log.call_status)}</td>
                        <td className="text-sm">{log.notes}</td>
                        <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{log.profiles?.full_name || 'Santral Görevlisi'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Simulated Call Triggering */}
      {callModalOpen && targetContact && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                backgroundColor: callingState === 'initiating' ? 'var(--warning-bg)' : 'var(--success-bg)',
                color: callingState === 'initiating' ? 'var(--warning-text)' : 'var(--success-text)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '1rem',
                animation: callingState === 'initiating' ? 'pulse 1.5s infinite' : 'none'
              }}>
                <PhoneCall size={32} />
              </div>

              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{targetContact.name}</h3>
              <div style={{ color: 'var(--color-teal)', fontWeight: 600, fontSize: '1.1rem', marginTop: '4px' }}>
                +{targetContact.phone}
              </div>
              {targetContact.contextText && (
                <div className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>
                  {targetContact.contextText}
                </div>
              )}

              <div style={{ marginTop: '0.75rem' }}>
                {callingState === 'initiating' ? (
                  <span className="badge badge-warning">WebRTC / Hat Bağlanıyor...</span>
                ) : (
                  <span className="badge badge-success">Arama Bağlandı (Canlı Görüşme)</span>
                )}
              </div>
            </div>

            <form onSubmit={handleSaveCallLog} style={{ marginTop: '1rem', borderTop: '1px solid var(--border-primary)', paddingTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Arama Sonucu / Durum <span className="required">*</span></label>
                <select
                  className="form-input"
                  value={callStatus}
                  onChange={(e) => setCallStatus(e.target.value as any)}
                >
                  <option value="promise_given">🤝 Ödeme Sözü Alındı</option>
                  <option value="reached">💬 Görüşüldü (Bilgi Verildi)</option>
                  <option value="not_reached">📵 Ulaşılamadı / Açmadı</option>
                  <option value="busy">⏳ Meşgul</option>
                  <option value="wrong_number">❌ Yanlış Numara</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Görüşme Notları <span className="required">*</span></label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Görüşülen kişi ödemeyi haftaya Cuma günü yapacağını belirtti..."
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  required
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCallModalOpen(false)}
                >
                  Aramayı İptal Et
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={actionLoading || !callNotes.trim()}
                >
                  {actionLoading ? 'Kaydediliyor...' : 'Aramayı Sonlandır & Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
