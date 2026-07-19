'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import './landing.css';

/* ── FAQ Data ── */
const faqData = [
  {
    question: 'AİDATOM bir site yönetim yazılımı mıdır?',
    answer: 'Hayır. AİDATOM, mevcut yönetim sistemlerinin yerine geçmekten çok aidat alacak takip ve iletişim süreçlerini yöneten profesyonel bir operasyon merkezidir.'
  },
  {
    question: 'AİDATOM tahsilatı garanti eder mi?',
    answer: 'Hayır. Her dosya kendi mali, operasyonel ve hukuki koşulları içinde değerlendirilir. AİDATOM sürecin düzenli, kayıtlı ve kontrollü şekilde yürütülmesini sağlar.'
  },
  {
    question: 'Hukuki işlem doğrudan başlatılır mı?',
    answer: 'Hayır. Hukuki sürece hazırlanması önerilen dosyalar yönetici onayına sunulur. İşlemler gerekli yetkilendirmeler doğrultusunda yürütülür.'
  },
  {
    question: 'Tahsil edilen tutarlar nereye aktarılır?',
    answer: 'Ödeme ve tahsilat modeli sözleşme ve yetkilendirme yapısına göre belirlenir. Esas amaç, tahsilatların ilgili yönetimin belirlediği hesaba yönlendirilmesidir.'
  },
  {
    question: 'Mevcut site yönetim programı değişmek zorunda mı?',
    answer: 'Hayır. AİDATOM, mevcut sisteminizle birlikte çalışabilecek bir operasyon modeli olarak kurgulanmalıdır.'
  }
];

export default function LandingPage() {
  const supabase = createClient();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // General contact / callback form state
  const [contactForm, setContactForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    message: '',
  });
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);

  // Pre-Analysis Form State
  const [analysisForm, setAnalysisForm] = useState({
    projectName: '',
    location: '',
    unitsCount: '',
    debtorsCount: '',
    totalDebt: '',
    avgDelay: '1-3 ay',
    hasCalling: 'Hayır',
    hasSms: 'Hayır',
    contactName: '',
    phone: '',
    email: '',
    kvkk: false,
  });
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);

  // Mock Admin Panel Active Tab State
  const [activePanelTab, setActivePanelTab] = useState<'summary' | 'debtors' | 'calling' | 'approvals'>('summary');
  const [approvedFiles, setApprovedFiles] = useState<string[]>([]); // To simulate approval action

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactLoading(true);

    try {
      const { error } = await supabase.from('contact_requests').insert({
        full_name: contactForm.full_name,
        phone: contactForm.phone,
        email: contactForm.email,
        message: `[Uzmanla Görüşme Talebi] ${contactForm.message}`,
      });
      if (error) throw error;
      setContactSubmitted(true);
      setContactForm({ full_name: '', phone: '', email: '', message: '' });
      setTimeout(() => setContactSubmitted(false), 5000);
    } catch (err) {
      alert('Talebiniz kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setContactLoading(false);
    }
  };

  const handleAnalysisSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!analysisForm.kvkk) {
      alert('Lütfen KVKK aydınlatma metnini onaylayın.');
      return;
    }
    setAnalysisLoading(true);

    // Calculate metrics
    const units = Number(analysisForm.unitsCount) || 1;
    const debtors = Number(analysisForm.debtorsCount) || 0;
    const debtRatio = (debtors / units) * 100;
    const totalDebtAmount = Number(analysisForm.totalDebt) || 0;

    let riskLevel = 'Düşük';
    let riskColor = 'success';
    if (debtRatio > 35 || analysisForm.avgDelay === '6-12 ay' || analysisForm.avgDelay === '12+ ay' || totalDebtAmount > 100000) {
      riskLevel = 'Yüksek Risk';
      riskColor = 'error';
    } else if (debtRatio > 15 || totalDebtAmount > 30000) {
      riskLevel = 'Orta Risk';
      riskColor = 'warning';
    }

    let communicationStatus = 'Düzenli';
    if (analysisForm.hasCalling === 'Hayır' && analysisForm.hasSms === 'Hayır') {
      communicationStatus = 'Yetersiz (Planlı İletişim Yok)';
    } else if (analysisForm.hasCalling === 'Hayır' || analysisForm.hasSms === 'Hayır') {
      communicationStatus = 'Geliştirilmeli (Kısmi İletişim var)';
    }

    let followUpSufficiency = 'Yeterli';
    if (riskLevel === 'Yüksek Risk' || analysisForm.hasCalling === 'Hayır') {
      followUpSufficiency = 'Zayıf (Maddi Kayıp Riski)';
    } else if (analysisForm.hasCalling === 'Evet' && analysisForm.hasSms === 'Evet') {
      followUpSufficiency = 'Yeterli (Takip Altında)';
    } else {
      followUpSufficiency = 'Geliştirilmeli';
    }

    let legalUrgency = 'Standart Takip';
    if (analysisForm.avgDelay === '6-12 ay' || analysisForm.avgDelay === '12+ ay' || totalDebtAmount > 75000) {
      legalUrgency = 'Acil Önlem Gerekli';
    } else if (analysisForm.avgDelay === '3-6 ay' || totalDebtAmount > 20000) {
      legalUrgency = 'Önerilir';
    }

    let reportingLevel = 'İleri';
    if (analysisForm.hasCalling === 'Hayır' && analysisForm.hasSms === 'Hayır') {
      reportingLevel = 'Eksik / Raporlanamıyor';
    } else if (analysisForm.hasCalling === 'Hayır' || analysisForm.hasSms === 'Hayır') {
      reportingLevel = 'Başlangıç Seviyesi';
    }

    const structuredMessage = `
[ÜCRETSİZ ÖN ANALİZ TALEBİ]
Site/Proje Adı: ${analysisForm.projectName}
Lokasyon: ${analysisForm.location}
Bağımsız Bölüm Sayısı: ${analysisForm.unitsCount}
Borçlu Malik Sayısı: ${analysisForm.debtorsCount}
Toplam Aidat Alacağı: ${analysisForm.totalDebt} ₺
Ortalama Gecikme: ${analysisForm.avgDelay}
Düzenli Arama Var mı: ${analysisForm.hasCalling}
SMS/Yazılı Bilgilendirme: ${analysisForm.hasSms}
KVKK Onayı: Evet
    `.trim();

    try {
      const { error } = await supabase.from('contact_requests').insert({
        full_name: analysisForm.contactName,
        phone: analysisForm.phone,
        email: analysisForm.email,
        message: structuredMessage,
      });
      if (error) throw error;

      setTimeout(() => {
        setAnalysisResult({
          riskLevel,
          riskColor,
          communicationStatus,
          followUpSufficiency,
          legalUrgency,
          reportingLevel,
        });
        setAnalysisLoading(false);
      }, 1000);
    } catch (err) {
      alert('Analiz gönderilirken hata oluştu. Lütfen tekrar deneyin.');
      setAnalysisLoading(false);
    }
  };

  const resetAnalysis = () => {
    setAnalysisResult(null);
    setAnalysisForm({
      projectName: '',
      location: '',
      unitsCount: '',
      debtorsCount: '',
      totalDebt: '',
      avgDelay: '1-3 ay',
      hasCalling: 'Hayır',
      hasSms: 'Hayır',
      contactName: '',
      phone: '',
      email: '',
      kvkk: false,
    });
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileNavOpen(false);
  };

  const simulateApproveFile = (id: string) => {
    if (approvedFiles.includes(id)) return;
    setApprovedFiles((prev) => [...prev, id]);
    alert('Dosya hukuk bürosuna devredilmek üzere onaylandı.');
  };

  return (
    <div className="landing-body">
      {/* ── 1. Üst Menü (Navbar) ── */}
      <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
        <div className="navbar-inner">
          <a href="#" className="navbar-logo" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <span className="logo-teal">AİDAT</span>OM
          </a>

          <div className="navbar-links">
            <button className="navbar-link" onClick={() => scrollToSection('nedir')}>AİDATOM Nedir?</button>
            <button className="navbar-link" onClick={() => scrollToSection('nasil-calisir')}>Nasıl Çalışır?</button>
            <button className="navbar-link" onClick={() => scrollToSection('kimler-icin')}>Kimler İçin?</button>
            <button className="navbar-link" onClick={() => scrollToSection('panel')}>Yönetici Paneli</button>
            <button className="navbar-link" onClick={() => scrollToSection('sss')}>Sık Sorulan Sorular</button>
            <button className="navbar-link" onClick={() => scrollToSection('iletisim')}>İletişim</button>
          </div>

          <div className="navbar-actions">
            <a href="/giris" className="btn-yonetici-girisi">
              Yönetici Girişi
            </a>
            <button className="btn-analiz" onClick={() => scrollToSection('analiz')}>
              Ücretsiz Ön Analiz
            </button>
            <button
              className="navbar-mobile-toggle"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Menüyü aç"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobil Menü ── */}
      <div className={`mobile-nav ${mobileNavOpen ? 'open' : ''}`}>
        <button className="mobile-nav-close" onClick={() => setMobileNavOpen(false)}>✕</button>
        <button onClick={() => scrollToSection('nedir')}>AİDATOM Nedir?</button>
        <button onClick={() => scrollToSection('nasil-calisir')}>Nasıl Çalışır?</button>
        <button onClick={() => scrollToSection('kimler-icin')}>Kimler İçin?</button>
        <button onClick={() => scrollToSection('panel')}>Yönetici Paneli</button>
        <button onClick={() => scrollToSection('sss')}>Sık Sorulan Sorular</button>
        <button onClick={() => scrollToSection('iletisim')}>İletişim</button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', width: '100%', marginTop: 'var(--space-lg)' }}>
          <a href="/giris" className="btn-yonetici-girisi" style={{ textAlign: 'center', width: '100%', display: 'block' }}>Yönetici Girişi</a>
          <button className="btn-analiz" onClick={() => scrollToSection('analiz')} style={{ width: '100%' }}>Ücretsiz Ön Analiz</button>
        </div>
      </div>

      {/* ── 2. Hero Alanı ── */}
      <section className="hero">
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-badge">
              PROFESYONEL AİDAT OPERASYON MERKEZİ
            </div>
            <h1 className="hero-title">
              Aidat alacak takibini profesyonel operasyona dönüştürün.
            </h1>
            <p className="hero-desc">
              AİDATOM; borçlu malik iletişimi, düzenli arama ve bilgilendirme, yönetici onayı, hukuki süreç hazırlığı ve raporlama işlemlerini uzman ekip ve teknoloji desteğiyle tek merkezden yönetir.
            </p>
            <div className="hero-actions">
              <button className="btn btn-teal-solid btn-hero" onClick={() => scrollToSection('analiz')}>
                Ücretsiz Ön Analiz Al
              </button>
              <button className="btn btn-navy-outline btn-hero" onClick={() => scrollToSection('nasil-calisir')}>
                Operasyon Modelini İncele
              </button>
            </div>
            <div className="hero-trust">
              <span>✓ KVKK Uyumlu Süreç</span>
              <span>✓ Yönetici Onaylı İşlem</span>
              <span>✓ Kayıtlı İletişim</span>
              <span>✓ Şeffaf Raporlama</span>
            </div>
          </div>

          <div className="hero-visual">
            <div className="visual-panel">
              <div className="panel-header">
                <span className="panel-badge">Canlı Takip Paneli</span>
                <span className="panel-title">AİDATOM Operasyon İzleme</span>
              </div>
              <p className="panel-info-msg">
                Yalnızca yazılım değil; uzman ekip, iletişim operasyonu ve raporlama altyapısı.
              </p>
              
              <div className="panel-preview-grid">
                <div className="preview-card">
                  <span className="preview-label">Toplam Açık Alacak</span>
                  <span className="preview-value">348.450 ₺</span>
                </div>
                <div className="preview-card">
                  <span className="preview-label">Borçlu Malik Sayısı</span>
                  <span className="preview-value">24</span>
                </div>
                <div className="preview-card">
                  <span className="preview-label">Tahsilat Durumu</span>
                  <span className="preview-value text-teal">%87.2</span>
                </div>
                <div className="preview-card">
                  <span className="preview-label">Arama Operasyonu</span>
                  <span className="preview-value">118 Görüşme</span>
                </div>
                <div className="preview-card">
                  <span className="preview-label">Onay Bekleyenler</span>
                  <span className="preview-value text-warning">4 Dosya</span>
                </div>
                <div className="preview-card">
                  <span className="preview-label">Risk Analizi</span>
                  <span className="preview-value text-error">Orta / Yüksek</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. AİDATOM Nedir? ── */}
      <section className="section-light" id="nedir">
        <div className="section-container">
          <div className="section-header">
            <span className="section-overline">AİDATOM NEDİR?</span>
            <h2 className="section-title">Yazılım değil, çalışan bir operasyon merkezidir.</h2>
            <p className="section-subtitle">
              AİDATOM, site yönetim yazılımınızın yerine geçmez. Mevcut yönetim sisteminizde oluşan aidat alacaklarının düzenli olarak takip edilmesini, borçlu maliklerle planlı iletişim kurulmasını, sürecin raporlanmasını ve gerekli dosyaların yönetici onayıyla hukuki işleme hazırlanmasını sağlar.
            </p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">👥</div>
              <h3>Uzman Operasyon Ekibi</h3>
              <p>Borçlu malik listeleri belirlenen operasyon planına göre düzenli olarak takip edilir.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📞</div>
              <h3>İletişim Operasyonu</h3>
              <p>Arama, SMS ve yazılı bilgilendirme süreçleri kayıtlı ve kontrollü şekilde yürütülür.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚖️</div>
              <h3>Hukuki Sürece Hazırlık</h3>
              <p>Gerekli belge ve dosyalar yönetici onayı alınarak hukuki değerlendirmeye hazırlanır.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Raporlama ve Analiz</h3>
              <p>Yapılan işlemler, güncel durumlar ve operasyon sonuçları yönetime düzenli olarak raporlanır.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Altı Aşamalı Operasyon Modeli ── */}
      <section className="section-light" id="nasil-calisir" style={{ borderTop: '1px solid var(--border-secondary)' }}>
        <div className="section-container">
          <div className="section-header">
            <span className="section-overline">OPERASYON MODELİ</span>
            <h2 className="section-title">Sürecinizi altı kontrollü adımda yönetiyoruz.</h2>
          </div>

          <div className="steps-grid">
            <div className="step-card">
              <span className="step-num">01</span>
              <h3>Veri Alma</h3>
              <p>Güncel borçlu malik, iletişim ve alacak verileri güvenli şekilde sisteme aktarılır.</p>
            </div>
            <div className="step-card">
              <span className="step-num">02</span>
              <h3>Analiz ve Planlama</h3>
              <p>Dosyalar; borç tutarı, gecikme süresi ve işlem durumuna göre sınıflandırılır.</p>
            </div>
            <div className="step-card">
              <span className="step-num">03</span>
              <h3>Arama ve Bilgilendirme</h3>
              <p>Borçlu maliklerle belirlenen iletişim planına uygun şekilde görüşmeler gerçekleştirilir.</p>
            </div>
            <div className="step-card">
              <span className="step-num">04</span>
              <h3>Yönetici Onayı</h3>
              <p>Hukuki sürece hazırlanması önerilen dosyalar yönetici değerlendirmesine sunulur.</p>
            </div>
            <div className="step-card">
              <span className="step-num">05</span>
              <h3>Hukuki Hazırlık</h3>
              <p>Onaylanan dosyaların belge ve yetkilendirme kontrolleri tamamlanır.</p>
            </div>
            <div className="step-card">
              <span className="step-num">06</span>
              <h3>Takip ve Raporlama</h3>
              <p>Tüm operasyon kayıt altına alınır ve yönetime anlaşılır raporlar sunulur.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Kimler İçin? ── */}
      <section className="section-light" id="kimler-icin" style={{ background: '#FFFFFF', borderTop: '1px solid var(--border-secondary)', borderBottom: '1px solid var(--border-secondary)' }}>
        <div className="section-container">
          <div className="section-header">
            <span className="section-overline">KİMLER İÇİN?</span>
            <h2 className="section-title">Farklı ölçekteki tüm yapılar için uyarlanabilir yapı.</h2>
          </div>

          <div className="audience-grid">
            <div className="audience-card">
              <h3>Site ve Apartman Yönetimleri</h3>
              <p>Aidat alacak takibini düzenli hale getirmek ve yöneticinin operasyonel yükünü azaltmak isteyen yönetimler için.</p>
              <button className="btn btn-navy-outline btn-sm" onClick={() => scrollToSection('analiz')}>
                Site Yönetimi Çözümünü İncele
              </button>
            </div>
            <div className="audience-card">
              <h3>Profesyonel Yönetim Firmaları</h3>
              <p>Birden fazla projedeki tahsilat ve iletişim operasyonlarını standartlaştırmak isteyen firmalar için.</p>
              <button className="btn btn-navy-outline btn-sm" onClick={() => scrollToSection('analiz')}>
                Kurumsal Çözümü İncele
              </button>
            </div>
            <div className="audience-card">
              <h3>Toplu Konut ve Büyük Projeler</h3>
              <p>Yüksek bağımsız bölüm sayısına sahip projelerde kontrollü ve raporlanabilir alacak takibi için.</p>
              <button className="btn btn-navy-outline btn-sm" onClick={() => scrollToSection('analiz')}>
                Proje Çözümünü İncele
              </button>
            </div>
            <div className="audience-card">
              <h3>Yapı Kooperatifleri</h3>
              <p>Üye ödemelerini, gecikmeleri ve iletişim süreçlerini merkezi bir operasyon yapısıyla yönetmek için.</p>
              <button className="btn btn-navy-outline btn-sm" onClick={() => scrollToSection('analiz')}>
                Kooperatif Çözümünü İncele
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Ön Analiz Alanı (Interactive Tool) ── */}
      <section className="section-light" id="analiz">
        <div className="section-container">
          <div className="section-header">
            <span className="section-overline">ÖN ANALİZ ARACI</span>
            <h2 className="section-title">Sitenizin tahsilat sürecini 60 saniyede değerlendirin.</h2>
            <p className="section-subtitle">
              Mevcut operasyon yapınızı analiz edin, geliştirilmesi gereken alanları ve AİDATOM hizmet modelinin sitenize uygunluğunu görün.
            </p>
          </div>

          <div className="analysis-box">
            {!analysisResult ? (
              <form className="analysis-form" onSubmit={handleAnalysisSubmit}>
                <div className="analysis-form-grid">
                  <div className="form-group">
                    <label className="form-label" htmlFor="proj-name">Site veya Proje Adı <span className="required">*</span></label>
                    <input
                      id="proj-name"
                      type="text"
                      className="form-input"
                      placeholder="Örn: Akasya Sitesi"
                      value={analysisForm.projectName}
                      onChange={(e) => setAnalysisForm({ ...analysisForm, projectName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="proj-loc">İl / İlçe <span className="required">*</span></label>
                    <input
                      id="proj-loc"
                      type="text"
                      className="form-input"
                      placeholder="Örn: İstanbul / Kadıköy"
                      value={analysisForm.location}
                      onChange={(e) => setAnalysisForm({ ...analysisForm, location: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="units-cnt">Bağımsız Bölüm (Daire) Sayısı <span className="required">*</span></label>
                    <input
                      id="units-cnt"
                      type="number"
                      min="1"
                      className="form-input"
                      placeholder="Örn: 120"
                      value={analysisForm.unitsCount}
                      onChange={(e) => setAnalysisForm({ ...analysisForm, unitsCount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="debtors-cnt">Borçlu Malik Sayısı <span className="required">*</span></label>
                    <input
                      id="debtors-cnt"
                      type="number"
                      min="0"
                      className="form-input"
                      placeholder="Örn: 15"
                      value={analysisForm.debtorsCount}
                      onChange={(e) => setAnalysisForm({ ...analysisForm, debtorsCount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="total-debt">Toplam Aidat Alacağı (₺) <span className="required">*</span></label>
                    <input
                      id="total-debt"
                      type="number"
                      min="0"
                      className="form-input"
                      placeholder="Örn: 45000"
                      value={analysisForm.totalDebt}
                      onChange={(e) => setAnalysisForm({ ...analysisForm, totalDebt: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="avg-delay">Ortalama Gecikme Süresi</label>
                    <select
                      id="avg-delay"
                      className="form-input"
                      value={analysisForm.avgDelay}
                      onChange={(e) => setAnalysisForm({ ...analysisForm, avgDelay: e.target.value })}
                    >
                      <option value="1-3 ay">1-3 Ay</option>
                      <option value="3-6 ay">3-6 Ay</option>
                      <option value="6-12 ay">6-12 Ay</option>
                      <option value="12+ ay">12+ Ay</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Düzenli Arama Yapılıyor mu?</label>
                    <div className="radio-group">
                      <button
                        type="button"
                        className={`radio-btn ${analysisForm.hasCalling === 'Evet' ? 'selected' : ''}`}
                        onClick={() => setAnalysisForm({ ...analysisForm, hasCalling: 'Evet' })}
                      >
                        Evet
                      </button>
                      <button
                        type="button"
                        className={`radio-btn ${analysisForm.hasCalling === 'Hayır' ? 'selected' : ''}`}
                        onClick={() => setAnalysisForm({ ...analysisForm, hasCalling: 'Hayır' })}
                      >
                        Hayır
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">SMS veya Yazılı Bilgilendirme Yapılıyor mu?</label>
                    <div className="radio-group">
                      <button
                        type="button"
                        className={`radio-btn ${analysisForm.hasSms === 'Evet' ? 'selected' : ''}`}
                        onClick={() => setAnalysisForm({ ...analysisForm, hasSms: 'Evet' })}
                      >
                        Evet
                      </button>
                      <button
                        type="button"
                        className={`radio-btn ${analysisForm.hasSms === 'Hayır' ? 'selected' : ''}`}
                        onClick={() => setAnalysisForm({ ...analysisForm, hasSms: 'Hayır' })}
                      >
                        Hayır
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="contact-name-an">İletişim Kişisi <span className="required">*</span></label>
                    <input
                      id="contact-name-an"
                      type="text"
                      className="form-input"
                      placeholder="Adınız Soyadınız"
                      value={analysisForm.contactName}
                      onChange={(e) => setAnalysisForm({ ...analysisForm, contactName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="phone-an">Telefon Numarası <span className="required">*</span></label>
                    <input
                      id="phone-an"
                      type="tel"
                      className="form-input"
                      placeholder="05XX XXX XX XX"
                      value={analysisForm.phone}
                      onChange={(e) => setAnalysisForm({ ...analysisForm, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label" htmlFor="email-an">E-posta Adresi <span className="required">*</span></label>
                    <input
                      id="email-an"
                      type="email"
                      className="form-input"
                      placeholder="ornek@alanadi.com"
                      value={analysisForm.email}
                      onChange={(e) => setAnalysisForm({ ...analysisForm, email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="kvkk-check">
                  <input
                    id="kvkk-checkbox"
                    type="checkbox"
                    checked={analysisForm.kvkk}
                    onChange={(e) => setAnalysisForm({ ...analysisForm, kvkk: e.target.checked })}
                    required
                  />
                  <label htmlFor="kvkk-checkbox">
                    Kişisel verilerimin işlenmesine ilişkin <a href="#" onClick={(e) => { e.preventDefault(); alert('KVKK Aydınlatma Metni: Paylaştığınız veriler yalnızca site ön analiz raporlaması ve sizinle iletişim kurulması amacıyla KVKK mevzuatına uygun olarak işlenmektedir.'); }} style={{ color: 'var(--primary-teal)', textDecoration: 'underline' }}>KVKK aydınlatma metnini</a> okudum ve onaylıyorum.
                  </label>
                </div>

                <button type="submit" className="btn btn-teal-solid btn-block" disabled={analysisLoading}>
                  {analysisLoading ? 'Analiz Ediliyor...' : 'Ücretsiz Ön Analizi Başlat'}
                </button>
              </form>
            ) : (
              <div className="analysis-result-screen animate-fade-in">
                <h3>Analiz Sonuç Raporu</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                  Girdiğiniz bilgilere göre sitenizin operasyonel değerlendirmesi hazırlanmıştır:
                </p>

                <div className="result-metrics">
                  <div className="result-card">
                    <span className="result-label">Operasyonel Risk Seviyesi</span>
                    <span className={`result-val text-${analysisResult.riskColor}`}>{analysisResult.riskLevel}</span>
                  </div>
                  <div className="result-card">
                    <span className="result-label">İletişim Düzeni</span>
                    <span className="result-val">{analysisResult.communicationStatus}</span>
                  </div>
                  <div className="result-card">
                    <span className="result-label">Takip Yeterliliği</span>
                    <span className="result-val">{analysisResult.followUpSufficiency}</span>
                  </div>
                  <div className="result-card">
                    <span className="result-label">Hukuki Hazırlık İhtiyacı</span>
                    <span className="result-val">{analysisResult.legalUrgency}</span>
                  </div>
                  <div className="result-card">
                    <span className="result-label">Raporlama Seviyesi</span>
                    <span className="result-val">{analysisResult.reportingLevel}</span>
                  </div>
                </div>

                <div className="result-disclaimer">
                  ⚠️ Bu analiz, girdiğiniz tahmini veriler doğrultusunda ön değerlendirme amaçlı oluşturulmuştur. Kesin bir tahsilat veya hukuki sonuç taahhüdü/vaadi içermez.
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-xl)' }}>
                  <button className="btn btn-teal-solid" style={{ flex: 1 }} onClick={() => scrollToSection('iletisim')}>
                    Uzman Görüşü Randevusu Al
                  </button>
                  <button className="btn btn-navy-outline" onClick={resetAnalysis}>
                    Yeniden Analiz Et
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── 7. Güven ve Kontrol Bölümü ── */}
      <section className="section-light" style={{ background: '#FFFFFF', borderTop: '1px solid var(--border-secondary)' }}>
        <div className="section-container">
          <div className="section-header">
            <span className="section-overline">GÜVEN VE KONTROL</span>
            <h2 className="section-title">Her işlem kayıtlı, her kritik aşama kontrolünüz altında.</h2>
          </div>

          <div className="trust-grid">
            <div className="trust-item">
              <div className="trust-badge-icon">✓</div>
              <div>
                <h4>Yönetici Onaylı Süreç</h4>
                <p>Hukuki işlem önerileri ve kritik operasyon adımları yönetici onayıyla ilerler.</p>
              </div>
            </div>
            <div className="trust-item">
              <div className="trust-badge-icon">✓</div>
              <div>
                <h4>Kayıtlı İletişim</h4>
                <p>Yapılan arama, bilgilendirme ve işlem kayıtları sistem üzerinde saklanır.</p>
              </div>
            </div>
            <div className="trust-item">
              <div className="trust-badge-icon">✓</div>
              <div>
                <h4>Şeffaf Raporlama</h4>
                <p>Yönetim, dosya durumlarını ve yapılan işlemleri düzenli raporlarla takip eder.</p>
              </div>
            </div>
            <div className="trust-item">
              <div className="trust-badge-icon">✓</div>
              <div>
                <h4>KVKK Uyumlu Yaklaşım</h4>
                <p>Kişisel verilerin işlenmesi, saklanması ve paylaşılması kontrollü süreçlerle yürütülür.</p>
              </div>
            </div>
            <div className="trust-item">
              <div className="trust-badge-icon">✓</div>
              <div>
                <h4>Uzman Desteği</h4>
                <p>Operasyon, iletişim ve hukuki hazırlık süreçlerinde ilgili uzmanlık alanları devreye alınır.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. Yönetici Paneli Tanıtımı (İnteraktif Simülatör) ── */}
      <section className="section-light" id="panel" style={{ borderTop: '1px solid var(--border-secondary)' }}>
        <div className="section-container">
          <div className="section-header">
            <span className="section-overline">YÖNETİCİ PANELİ</span>
            <h2 className="section-title">Operasyonunuzu tek ekrandan takip edin.</h2>
            <p className="section-subtitle">
              Sistemimizdeki gerçek panel ekranlarını ve araçlarını aşağıdan interaktif olarak inceleyebilirsiniz.
            </p>
          </div>

          <div className="panel-simulator">
            {/* Sidebar Sim */}
            <div className="sim-sidebar">
              <div className="sim-logo">AİDATOM Simülatör</div>
              <button className={`sim-nav-btn ${activePanelTab === 'summary' ? 'active' : ''}`} onClick={() => setActivePanelTab('summary')}>
                📊 Genel Özet
              </button>
              <button className={`sim-nav-btn ${activePanelTab === 'debtors' ? 'active' : ''}`} onClick={() => setActivePanelTab('debtors')}>
                👥 Borçlu Malikler
              </button>
              <button className={`sim-nav-btn ${activePanelTab === 'calling' ? 'active' : ''}`} onClick={() => setActivePanelTab('calling')}>
                📞 Arama ve İletişim
              </button>
              <button className={`sim-nav-btn ${activePanelTab === 'approvals' ? 'active' : ''}`} onClick={() => setActivePanelTab('approvals')}>
                ⚠️ Hukuk Onay Bekleyenler
              </button>
            </div>

            {/* Screen Sim */}
            <div className="sim-screen">
              {activePanelTab === 'summary' && (
                <div className="sim-tab-content animate-fade-in">
                  <h4>Operasyon Finansal ve Takip Özeti</h4>
                  <div className="sim-summary-grid">
                    <div className="sim-stat-box">
                      <span>Toplam Açık Alacak</span>
                      <strong>245.900 ₺</strong>
                    </div>
                    <div className="sim-stat-box">
                      <span>Aktif İletişimde</span>
                      <strong>16 Malik</strong>
                    </div>
                    <div className="sim-stat-box">
                      <span>Gecikme Süresi Ortalaması</span>
                      <strong>4.2 Ay</strong>
                    </div>
                  </div>

                  <div style={{ marginTop: 'var(--space-lg)', padding: 'var(--space-md)', background: '#F6F8FA', borderRadius: '8px' }}>
                    <h5 style={{ margin: '0 0 10px 0', fontSize: '0.875rem', fontWeight: 600 }}>Son Sistem Bildirimleri</h5>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      <li>SMS gönderim durumu: 12 Hatırlatma iletildi.</li>
                      <li>Arama operasyon raporu: 3 Malik ile ödeme sözü alındı.</li>
                      <li>Hukuk onayı bekleyen 2 yeni dosya hazırlandı.</li>
                    </ul>
                  </div>
                </div>
              )}

              {activePanelTab === 'debtors' && (
                <div className="sim-tab-content animate-fade-in">
                  <h4>Borçlu Malik Listeleri</h4>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                    Sitede aidat ödemesini geciktiren sakinlerin güncel borç dökümü:
                  </p>
                  <table className="sim-table">
                    <thead>
                      <tr>
                        <th>Blok / Daire</th>
                        <th>Ad Soyad</th>
                        <th>Gecikmiş Borç</th>
                        <th>Gecikme Süresi</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>A Blok - No 12</td>
                        <td>Mustafa Çetin (Malik)</td>
                        <td>12.400 ₺</td>
                        <td>4 Ay</td>
                      </tr>
                      <tr>
                        <td>B Blok - No 4</td>
                        <td>Aylin Yurt (Kiracı)</td>
                        <td>6.200 ₺</td>
                        <td>2 Ay</td>
                      </tr>
                      <tr>
                        <td>C Blok - No 18</td>
                        <td>Serdar Can (Malik)</td>
                        <td>24.800 ₺</td>
                        <td>8 Ay</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {activePanelTab === 'calling' && (
                <div className="sim-tab-content animate-fade-in">
                  <h4>Son Arama ve İletişim Bilgisi</h4>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                    Uzman operasyon ekibimizin borçlu sakinlerle yaptığı kayıtlı görüşme geçmişi:
                  </p>
                  <div className="sim-timeline">
                    <div className="timeline-item">
                      <span className="time">Bugün 14:30</span>
                      <strong>Serdar Can (C Blok 18):</strong> Arandı. Maaş ödemesi beklediğini, 25.07.2026 tarihinde 15.000 ₺ ara ödeme yapacağını taahhüt etti.
                    </div>
                    <div className="timeline-item">
                      <span className="time">Dün 10:15</span>
                      <strong>Mustafa Çetin (A Blok 12):</strong> Arandı. Telefonu kapalı olduğu için &ldquo;Ödeme Bildirimi&rdquo; başlıklı SMS şablonu otomatik olarak iletildi.
                    </div>
                    <div className="timeline-item">
                      <span className="time">14 Temmuz</span>
                      <strong>Aylin Yurt (B Blok 4):</strong> Arandı. Ev sahibiyle görüştüğünü, aidatın ev sahibine ait olduğunu belirtti. Kat maliki takibe alındı.
                    </div>
                  </div>
                </div>
              )}

              {activePanelTab === 'approvals' && (
                <div className="sim-tab-content animate-fade-in">
                  <h4>Yönetici Onayı Bekleyen Hukuki Hazırlık Dosyaları</h4>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '15px' }}>
                    İletişim ve arama süreçlerinde sonuç alınamayan ve hukuk bürosuna devredilmeye hazırlanan dosyalar:
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="approval-card">
                      <div>
                        <strong>Serdar Can (C Blok No 18)</strong>
                        <p style={{ margin: '3px 0 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                          Toplam Borç: 24.800 ₺ | Gecikme: 8 Ay | Son Arama: Sonuç Alınamadı
                        </p>
                      </div>
                      <button
                        className={`btn btn-sm ${approvedFiles.includes('file1') ? 'btn-secondary' : 'btn-teal-solid'}`}
                        onClick={() => simulateApproveFile('file1')}
                        disabled={approvedFiles.includes('file1')}
                      >
                        {approvedFiles.includes('file1') ? 'Onaylandı ✓' : 'Hukuka Sevk Et'}
                      </button>
                    </div>

                    <div className="approval-card">
                      <div>
                        <strong>Mustafa Çetin (A Blok No 12)</strong>
                        <p style={{ margin: '3px 0 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                          Toplam Borç: 12.400 ₺ | Gecikme: 4 Ay | Son Arama: Ulaşılamıyor
                        </p>
                      </div>
                      <button
                        className={`btn btn-sm ${approvedFiles.includes('file2') ? 'btn-secondary' : 'btn-teal-solid'}`}
                        onClick={() => simulateApproveFile('file2')}
                        disabled={approvedFiles.includes('file2')}
                      >
                        {approvedFiles.includes('file2') ? 'Onaylandı ✓' : 'Hukuka Sevk Et'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. Sık Sorulan Sorular ── */}
      <section className="section-light" id="sss" style={{ borderTop: '1px solid var(--border-secondary)', background: '#FFFFFF' }}>
        <div className="section-container">
          <div className="section-header">
            <span className="section-overline">Sıkça Sorulan Sorular</span>
            <h2 className="section-title">Merak Ettikleriniz</h2>
          </div>
          <div className="faq-container">
            {faqData.map((item, index) => (
              <div
                key={index}
                className={`accordion-item ${openFaqIndex === index ? 'open' : ''}`}
              >
                <button
                  className="accordion-trigger"
                  onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                >
                  {item.question}
                  <span className="chevron">▾</span>
                </button>
                <div className="accordion-content">
                  <p>{item.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 10. Final Çağrı Alanı (CTA) ── */}
      <section className="cta-section">
        <div className="cta-container">
          <h2 className="cta-title">Aidat alacaklarınız büyümeden operasyonunuzu başlatın.</h2>
          <p className="cta-desc">
            Sitenizin mevcut durumunu birlikte değerlendirelim ve size özel operasyon modelini oluşturalım.
          </p>
          <div className="cta-actions">
            <button className="btn btn-teal-solid btn-lg" onClick={() => scrollToSection('analiz')}>
              Ücretsiz Ön Analiz Al
            </button>
            <button className="btn btn-navy-outline-white btn-lg" onClick={() => scrollToSection('iletisim')}>
              Uzmanla Görüş
            </button>
          </div>
        </div>
      </section>

      {/* ── İletişim Bölümü ── */}
      <section className="section-light" id="iletisim" style={{ borderTop: '1px solid var(--border-secondary)' }}>
        <div className="section-container">
          <div className="contact-box">
            <div className="contact-info">
              <span className="section-overline">İLETİŞİM</span>
              <h2 className="section-title">Sizi Arayalım</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-xl)' }}>
                Bilgilerinizi bırakın, uzman ekibimiz en kısa sürede sizi arasın. Tüm sorularınızı yanıtlayalım ve size en uygun operasyon modelini sunalım.
              </p>
              
              <div className="contact-details">
                <div className="contact-detail-item">
                  <span className="icon">📞</span>
                  <div>
                    <strong>Telefon</strong>
                    <span>0850 XXX XX XX</span>
                  </div>
                </div>
                <div className="contact-detail-item">
                  <span className="icon">✉️</span>
                  <div>
                    <strong>E-posta</strong>
                    <span>info@aidatom.com</span>
                  </div>
                </div>
                <div className="contact-detail-item">
                  <span className="icon">📍</span>
                  <div>
                    <strong>Adres</strong>
                    <span>İstanbul, Türkiye</span>
                  </div>
                </div>
              </div>
            </div>

            <form className="contact-form" onSubmit={handleContactSubmit}>
              {contactSubmitted && (
                <div className="contact-success-alert">
                  ✓ Talebiniz alındı. Uzman operasyon ekibimiz en kısa sürede sizinle iletişime geçecektir.
                </div>
              )}
              <div className="form-group">
                <label className="form-label" htmlFor="cnt-name">Ad Soyad <span className="required">*</span></label>
                <input
                  id="cnt-name"
                  type="text"
                  className="form-input"
                  placeholder="Adınız Soyadınız"
                  value={contactForm.full_name}
                  onChange={(e) => setContactForm({ ...contactForm, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cnt-phone">Telefon <span className="required">*</span></label>
                <input
                  id="cnt-phone"
                  type="tel"
                  className="form-input"
                  placeholder="05XX XXX XX XX"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cnt-email">E-posta</label>
                <input
                  id="cnt-email"
                  type="email"
                  className="form-input"
                  placeholder="ornek@mail.com"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cnt-msg">Mesajınız <span className="required">*</span></label>
                <textarea
                  id="cnt-msg"
                  className="form-input"
                  placeholder="Size nasıl yardımcı olabiliriz?"
                  rows={4}
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  required
                />
              </div>
              <button type="submit" className="btn btn-teal-solid btn-block" disabled={contactLoading}>
                {contactLoading ? 'Gönderiliyor...' : 'Uzmanla Görüşme Talebi Gönder'}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-grid">
            <div className="footer-brand">
              <a href="#" className="navbar-logo" style={{ marginBottom: 'var(--space-md)', color: '#FFFFFF' }}>
                <span className="logo-teal">AİDAT</span>OM
              </a>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9375rem', lineHeight: '1.6' }}>
                AİDATOM; teknolojiyle desteklenen, uzman ekip tarafından yürütülen, yönetici kontrollü ve raporlanabilir bir aidat operasyon merkezidir.
              </p>
            </div>
            <div className="footer-col">
              <h4>Platform</h4>
              <a href="#nedir" onClick={(e) => { e.preventDefault(); scrollToSection('nedir'); }}>AİDATOM Nedir?</a>
              <a href="#nasil-calisir" onClick={(e) => { e.preventDefault(); scrollToSection('nasil-calisir'); }}>Nasıl Çalışır?</a>
              <a href="#kimler-icin" onClick={(e) => { e.preventDefault(); scrollToSection('kimler-icin'); }}>Kimler İçin?</a>
            </div>
            <div className="footer-col">
              <h4>Giriş ve Ön Analiz</h4>
              <a href="/giris">Yönetici Girişi</a>
              <a href="#analiz" onClick={(e) => { e.preventDefault(); scrollToSection('analiz'); }}>Ücretsiz Ön Analiz</a>
              <a href="/kayit">Kayıt Ol</a>
            </div>
            <div className="footer-col">
              <h4>İletişim</h4>
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>0850 XXX XX XX</span>
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>info@aidatom.com</span>
              <a href="#iletisim" onClick={(e) => { e.preventDefault(); scrollToSection('iletisim'); }}>Bize Ulaşın</a>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} AİDATOM. Tüm hakları saklıdır.</span>
            <span>KVKK Aydınlatma Metni & Gizlilik Politikası</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
