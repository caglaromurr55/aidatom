'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE, DOCUMENT_LABELS } from '@/lib/utils';
import type { Document, DocumentType, ManagerType } from '@/types';

/* ── Document Upload Config ── */
interface DocConfig {
  type: DocumentType;
  label: string;
  description: string;
  hasDownload: boolean;
  downloadLabel?: string;
  conditional?: 'individual' | 'company';
}

const ALL_DOCUMENTS: DocConfig[] = [
  {
    type: 'karar_defteri',
    label: 'Karar Defteri Yazısı',
    description: 'Yönetici atama kararını gösteren karar defteri sayfası.',
    hasDownload: true,
    downloadLabel: 'Karar Defteri Örneği İndir',
  },
  {
    type: 'kimlik',
    label: 'Kimlik Fotokopisi',
    description: 'Geçerli kimlik belgenizin ön ve arka yüzü.',
    hasDownload: false,
    conditional: 'individual',
  },
  {
    type: 'vergi_levhasi',
    label: 'Vergi Levhası',
    description: 'Şirketinizin güncel vergi levhası.',
    hasDownload: false,
    conditional: 'company',
  },
  {
    type: 'imza_sirkuleri',
    label: 'İmza Sirküleri',
    description: 'Noterden onaylı imza sirküleri belgesi.',
    hasDownload: false,
  },
  {
    type: 'vekaletname',
    label: 'Vekaletname',
    description: 'İcra işlemleri için avukata verilen vekaletname.',
    hasDownload: false,
  },
  {
    type: 'sozlesme',
    label: 'Sözleşme',
    description: 'Aidatom platform kullanım sözleşmesi. İndirip imzalayarak yükleyin.',
    hasDownload: true,
    downloadLabel: 'Sözleşmeyi İndir',
  },
];

export default function DocumentUploadPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<DocumentType | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [managerType, setManagerType] = useState<ManagerType>('individual');
  const [userId, setUserId] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const requiredDocs = ALL_DOCUMENTS.filter((doc) => {
    if (doc.conditional === 'individual' && managerType === 'company') return false;
    if (doc.conditional === 'company' && managerType === 'individual') return false;
    return true;
  });

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('manager_type')
      .eq('id', user.id)
      .single();
    
    if (profile) {
      setManagerType(profile.manager_type as ManagerType);
    }

    const { data: docs } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_current', true)
      .order('created_at', { ascending: false });

    if (docs) {
      setDocuments(docs as Document[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getDocForType = (type: DocumentType): Document | undefined => {
    return documents.find((d) => d.document_type === type);
  };

  const allUploaded = requiredDocs.every((doc) => {
    const uploaded = getDocForType(doc.type);
    return uploaded && uploaded.status !== 'rejected';
  });

  const uploadedCount = requiredDocs.filter((doc) => {
    const uploaded = getDocForType(doc.type);
    return uploaded && uploaded.status !== 'rejected';
  }).length;

  const handleFileUpload = async (docType: DocumentType, file: File) => {
    setError('');
    
    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setError('Geçersiz dosya formatı. Sadece PDF, JPG ve PNG dosyaları kabul edilmektedir.');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError('Dosya boyutu 10 MB\'ı aşamaz.');
      return;
    }

    if (!userId) return;

    setUploading(docType);

    try {
      // Mark old versions as not current
      const existingDoc = getDocForType(docType);
      if (existingDoc) {
        await supabase
          .from('documents')
          .update({ is_current: false })
          .eq('user_id', userId)
          .eq('document_type', docType);
      }

      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${docType}_v${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Create document record
      const newVersion = existingDoc ? existingDoc.version + 1 : 1;

      const { error: dbError } = await supabase.from('documents').insert({
        user_id: userId,
        document_type: docType,
        file_path: fileName,
        original_filename: file.name,
        file_size: file.size,
        mime_type: file.type,
        status: 'uploaded',
        version: newVersion,
        is_current: true,
      });

      if (dbError) throw dbError;

      setSuccessMsg(`${DOCUMENT_LABELS[docType]} başarıyla yüklendi.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      
      // Reload documents
      await loadData();
    } catch (err) {
      setError('Dosya yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
      console.error('Upload error:', err);
    } finally {
      setUploading(null);
    }
  };

  const handleSubmitForReview = async () => {
    if (!userId || !allUploaded) return;

    setSubmitLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ status: 'pending_review' })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Redirect to waiting page
      window.location.href = '/beklemede';
    } catch {
      setError('İşlem sırasında bir hata oluştu.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const downloadTemplate = (type: DocumentType) => {
    let content = '';
    let filename = '';
    
    if (type === 'karar_defteri') {
      content = `AİDATOM APARTMAN/SİTE YÖNETİMİ KARAR DEFTERİ ÖRNEĞİ\n\n` +
                `Karar Tarihi: ${new Date().toLocaleDateString('tr-TR')}\n` +
                `Karar No: 1\n` +
                `Toplantı Konusu: Yönetici Ataması ve Yetkilendirme\n\n` +
                `Gündem ve Karar:\n` +
                `Apartman/Site kat malikleri kurulumuz toplanarak oy birliği ile yönetici seçimi gerçekleştirmiştir.\n` +
                `Yeni dönem için site yöneticisi olarak seçilmiştir. Kendisine Aidatom.com platformu üzerinden\n` +
                `sitenin yönetim işlemlerini yürütmesi, aidat alacak takibi yapması, gecikme faizi işletmesi,\n` +
                `SMS gönderimleri yapması ve gerekli hallerde alacakları icra dairesine devretmesi hususlarında\n` +
                `tüm yetkiler verilmiştir.\n\n` +
                `Kat Malikleri İmzaları:\n` +
                `1. Ad Soyad (İmza)\n` +
                `2. Ad Soyad (İmza)\n` +
                `3. Ad Soyad (İmza)\n`;
      filename = 'karar_defteri_ornegi.txt';
    } else if (type === 'sozlesme') {
      content = `AİDATOM PLATFORM KULLANIM SÖZLEŞMESİ\n\n` +
                `1. TARAFLAR\n` +
                `İşbu sözleşme, Aidatom.com (Platform) ile Platformu kullanan Yönetici/Yönetim Şirketi arasında akdedilmiştir.\n\n` +
                `2. KONU\n` +
                `Yönetici, sorumluluğu altındaki sitelerin sakin borç/tahsilat takibi, gecikme faizi hesaplamaları,\n` +
                `SMS bilgilendirmeleri ve icra takip hazırlığı işlemlerinde Platform hizmetlerinden yararlanacaktır.\n\n` +
                `3. HAK VE YÜKÜMLÜLÜKLER\n` +
                `- Yönetici, sisteme girdiği tüm verilerin doğruluğundan ve KVKK uyumluluğundan sorumludur.\n` +
                `- Platform, verilerin güvenliğinden ve sistemin kesintisiz çalışmasından sorumludur.\n` +
                `- İcra takibine devredilen borç kalemleri ve sakin bilgileri, entegre hukuk modülü ile avukata aktarılır.\n\n` +
                `Yönetici Adı Soyadı:\n` +
                `İmza:\n`;
      filename = 'aidatom_kullanim_sozlesmesi.txt';
    }
    
    if (content) {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'var(--bg-primary)' 
      }}>
        <div className="spinner spinner-lg"></div>
      </div>
    );
  }

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
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800 }}>
          <span style={{ color: '#0FA3A3' }}>AİDAT</span>
          <span style={{ color: '#0F1F3D' }}>OM</span>
        </a>
        <button onClick={handleLogout} className="btn btn-ghost btn-sm">
          Çıkış Yap
        </button>
      </header>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-2xl) var(--space-xl)' }}>
        <div className="animate-fade-in-up">
          <h1 className="heading-md" style={{ marginBottom: 'var(--space-sm)' }}>Belge Yükleme</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-xl)' }}>
            Hesabınızın onaylanabilmesi için aşağıdaki belgeleri yüklemeniz gerekmektedir. 
            Her belgeyi ayrı ayrı yükleyebilirsiniz. İlerlemeniz otomatik olarak kaydedilir.
          </p>

          {/* Progress Bar */}
          <div style={{ marginBottom: 'var(--space-2xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                İlerleme: {uploadedCount} / {requiredDocs.length} belge yüklendi
              </span>
              <span className="text-sm" style={{ color: 'var(--primary-400)', fontWeight: 600 }}>
                %{Math.round((uploadedCount / requiredDocs.length) * 100)}
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${(uploadedCount / requiredDocs.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <div className="auth-alert error" style={{ marginBottom: 'var(--space-lg)' }}>
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="auth-alert success" style={{ marginBottom: 'var(--space-lg)' }}>
              <span>✓</span>
              <span>{successMsg}</span>
            </div>
          )}

          {/* Document Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {requiredDocs.map((docConfig, index) => {
              const uploaded = getDocForType(docConfig.type);
              const isUploading = uploading === docConfig.type;
              const isRejected = uploaded?.status === 'rejected';
              const isApproved = uploaded?.status === 'approved';
              const isUploaded = uploaded && !isRejected;

              return (
                <div
                  key={docConfig.type}
                  className="card animate-fade-in-up"
                  style={{ 
                    animationDelay: `${index * 80}ms`,
                    animationFillMode: 'both',
                    borderColor: isRejected 
                      ? 'var(--error)' 
                      : isApproved 
                        ? 'var(--success)' 
                        : isUploaded 
                          ? 'var(--primary-500)' 
                          : undefined 
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                        <span style={{ fontSize: '1.25rem' }}>
                          {isApproved ? '✅' : isUploaded ? '📄' : isRejected ? '❌' : '📎'}
                        </span>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{docConfig.label}</h3>
                        {isUploaded && !isRejected && (
                          <span className="badge badge-primary">Yüklendi</span>
                        )}
                        {isApproved && (
                          <span className="badge badge-success">Onaylandı</span>
                        )}
                        {isRejected && (
                          <span className="badge badge-error">Reddedildi</span>
                        )}
                      </div>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {docConfig.description}
                      </p>

                      {/* Rejection Reason */}
                      {isRejected && uploaded?.rejection_reason && (
                        <div style={{
                          marginTop: 'var(--space-sm)',
                          padding: 'var(--space-sm) var(--space-md)',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.8125rem',
                          color: 'var(--error-light)',
                        }}>
                          <strong>Red nedeni:</strong> {uploaded.rejection_reason}
                        </div>
                      )}

                      {/* Uploaded file info */}
                      {isUploaded && (
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-sm)' }}>
                          {uploaded.original_filename} ({(uploaded.file_size / 1024).toFixed(0)} KB)
                        </p>
                      )}

                      {/* Download template */}
                      {docConfig.hasDownload && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ marginTop: 'var(--space-sm)', color: 'var(--primary-400)' }}
                          onClick={() => downloadTemplate(docConfig.type)}
                        >
                          ⬇ {docConfig.downloadLabel}
                        </button>
                      )}
                    </div>

                    {/* Upload Button */}
                    <div>
                      {isUploading ? (
                        <div className="btn btn-secondary btn-sm" style={{ pointerEvents: 'none' }}>
                          <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></span>
                          Yükleniyor...
                        </div>
                      ) : (
                        <label className={`btn ${isUploaded && !isRejected ? 'btn-ghost' : 'btn-secondary'} btn-sm`} style={{ cursor: 'pointer' }}>
                          {isUploaded && !isRejected ? 'Değiştir' : isRejected ? 'Tekrar Yükle' : 'Dosya Seç'}
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(docConfig.type, file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submit Button */}
          <div style={{ marginTop: 'var(--space-2xl)', textAlign: 'center' }}>
            <button
              className="btn btn-primary btn-lg"
              style={{ minWidth: 280 }}
              disabled={!allUploaded || submitLoading}
              onClick={handleSubmitForReview}
            >
              {submitLoading ? (
                <>
                  <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></span>
                  Gönderiliyor...
                </>
              ) : (
                <>
                  Kontrole Gönder
                  {!allUploaded && (
                    <span style={{ fontSize: '0.8125rem', opacity: 0.7 }}>
                      ({requiredDocs.length - uploadedCount} belge kaldı)
                    </span>
                  )}
                </>
              )}
            </button>
            {!allUploaded && (
              <p className="text-sm" style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-md)' }}>
                Tüm belgeleri yükledikten sonra kontrole gönderebilirsiniz.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
