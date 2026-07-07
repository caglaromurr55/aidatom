'use client';

import { useState, useEffect } from 'react';
import './landing.css';

/* ── FAQ Data ── */
const faqData = [
  {
    question: 'Aidatom nedir ve nasıl çalışır?',
    answer: 'Aidatom, site yöneticileri ve profesyonel site yönetim şirketleri için geliştirilmiş bir aidat yönetim sistemidir. Site bilgilerinizi, sakin verilerinizi ve alacak durumlarınızı kolayca girebilir, tahsilat takibi yapabilir ve tahsil edilemeyen alacakları icra sürecine devredebilirsiniz.'
  },
  {
    question: 'Kimler üye olabilir?',
    answer: 'Bireysel site yöneticileri ve profesyonel site yönetim şirketleri üye olabilir. Kayıt sonrası gerekli belgelerin yüklenmesi ve ekibimiz tarafından onaylanması gerekmektedir.'
  },
  {
    question: 'İcra süreci nasıl işliyor?',
    answer: 'Tahsil edemediğiniz alacakları tek tıkla icra sürecine devredebilirsiniz. Avukat ekibimiz gerekli icra takip işlemlerini başlatır ve sürecin her aşamasını sistem üzerinden takip edebilirsiniz.'
  },
  {
    question: 'Verilerim güvende mi?',
    answer: 'Tüm verileriniz şifreli olarak saklanır. KVKK uyumlu altyapımız ve günlük yedekleme sistemimiz ile verilerinizin güvenliğini en üst düzeyde sağlıyoruz.'
  },
  {
    question: 'Toplu veri girişi yapabilir miyim?',
    answer: 'Evet. Size sunduğumuz Excel şablonunu indirip doldurabilir ve sisteme toplu olarak yükleyebilirsiniz. Hatalı veriler detaylı raporla bildirilir.'
  },
  {
    question: 'Birden fazla site yönetebilir miyim?',
    answer: 'Evet. Profesyonel site yönetim şirketleri, yönettikleri tüm siteleri tek panel üzerinden yönetebilir. Her site için ayrı blok, daire ve sakin bilgileri girilebilir.'
  },
];

/* ── Testimonials Data ── */
const testimonials = [
  {
    name: 'Mehmet Yılmaz',
    role: 'Site Yöneticisi',
    initials: 'MY',
    text: 'Aidatom sayesinde aidat takibi artık çok kolay. Gecikmiş ödemeleri anında görebiliyorum ve gerektiğinde icra sürecini hızlıca başlatabiliyorum.',
  },
  {
    name: 'Ayşe Kara',
    role: 'Yönetim Şirketi Sahibi',
    initials: 'AK',
    text: '12 siteyi tek panelden yönetiyorum. Excel ile toplu veri girişi özelliği bize büyük zaman kazandırıyor. Kesinlikle tavsiye ederim.',
  },
  {
    name: 'Ali Demir',
    role: 'Site Yöneticisi',
    initials: 'AD',
    text: 'Gelir-gider takibi ve raporlama özellikleri muhteşem. Sakinlere SMS ile hatırlatma göndermek de işimizi çok kolaylaştırdı.',
  },
];

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    message: '',
  });
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);

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

    // TODO: Supabase'e kaydet
    // const { error } = await supabase.from('contact_requests').insert(contactForm);
    
    setTimeout(() => {
      setContactLoading(false);
      setContactSubmitted(true);
      setContactForm({ full_name: '', phone: '', email: '', message: '' });
      setTimeout(() => setContactSubmitted(false), 5000);
    }, 1000);
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileNavOpen(false);
  };

  return (
    <>
      {/* ── Navbar ── */}
      <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
        <div className="navbar-inner">
          <a href="/" className="navbar-logo">
            <div className="logo-icon">A</div>
            <span>
              <span className="text-gradient">Aidat</span>om
            </span>
          </a>

          <div className="navbar-links">
            <button className="navbar-link" onClick={() => scrollToSection('services')}>
              Hizmetlerimiz
            </button>
            <button className="navbar-link" onClick={() => scrollToSection('how-it-works')}>
              Nasıl Çalışır
            </button>
            <button className="navbar-link" onClick={() => scrollToSection('faq')}>
              SSS
            </button>
            <button className="navbar-link" onClick={() => scrollToSection('contact')}>
              İletişim
            </button>
          </div>

          <div className="navbar-actions">
            <a href="/giris" className="btn btn-primary">
              Kullanıcı Girişi
            </a>
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

      {/* ── Mobile Nav ── */}
      <div className={`mobile-nav ${mobileNavOpen ? 'open' : ''}`}>
        <button className="mobile-nav-close" onClick={() => setMobileNavOpen(false)}>
          ✕
        </button>
        <button onClick={() => scrollToSection('services')}>Hizmetlerimiz</button>
        <button onClick={() => scrollToSection('how-it-works')}>Nasıl Çalışır</button>
        <button onClick={() => scrollToSection('faq')}>SSS</button>
        <button onClick={() => scrollToSection('contact')}>İletişim</button>
        <a href="/giris" className="btn btn-primary btn-lg">Kullanıcı Girişi</a>
      </div>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-bg"></div>
        <div className="hero-content">
          <div className="hero-badge">
            <span className="dot"></span>
            Profesyonel Aidat Yönetim Platformu
          </div>
          <h1 className="heading-xl">
            Aidat Yönetimini
            <br />
            <span className="text-gradient">Kolaylaştırıyoruz</span>
          </h1>
          <p className="hero-description">
            Site yöneticileri ve profesyonel yönetim şirketleri için geliştirilen kapsamlı aidat takip, 
            alacak yönetimi ve icra takip sistemi. Tüm süreçlerinizi tek platformdan yönetin.
          </p>
          <div className="hero-actions">
            <a href="/kayit" className="btn btn-primary btn-lg">
              Hemen Üye Olun
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
            <button className="btn btn-secondary btn-lg" onClick={() => scrollToSection('contact')}>
              Bizi Arayın
            </button>
          </div>
          <div className="hero-stats">
            <div className="hero-stat-item">
              <div className="hero-stat-value">500+</div>
              <div className="hero-stat-label">Site Yöneticisi</div>
            </div>
            <div className="hero-stat-item">
              <div className="hero-stat-value">2.000+</div>
              <div className="hero-stat-label">Yönetilen Site</div>
            </div>
            <div className="hero-stat-item">
              <div className="hero-stat-value">%95</div>
              <div className="hero-stat-label">Tahsilat Başarısı</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Services ── */}
      <section className="section" id="services">
        <div className="section-header">
          <div className="overline">Hizmetlerimiz</div>
          <h2 className="heading-lg">Aidat Yönetiminin Tüm İhtiyaçları</h2>
          <p>Site yönetiminizi profesyonel bir seviyeye taşıyacak kapsamlı araçlar sunuyoruz.</p>
        </div>
        <div className="services-grid">
          <div className="service-card">
            <div className="service-icon">📊</div>
            <h3>Aidat Takibi</h3>
            <p>Tüm daire sakinlerinin aidat durumlarını anlık olarak takip edin. Ödenmiş, bekleyen ve gecikmiş ödemeleri tek ekrandan görün.</p>
          </div>
          <div className="service-card">
            <div className="service-icon">⚖️</div>
            <h3>İcra Takibi</h3>
            <p>Tahsil edemediğiniz alacakları tek tıkla icra sürecine devredin. Avukat ekibimiz tüm süreci sizin adınıza yönetir.</p>
          </div>
          <div className="service-card">
            <div className="service-icon">📱</div>
            <h3>SMS Bildirimleri</h3>
            <p>Gecikmiş ödemeleri olan sakinlere otomatik veya manuel SMS hatırlatmaları gönderin. Hazır şablonlarla zaman kazanın.</p>
          </div>
          <div className="service-card">
            <div className="service-icon">📋</div>
            <h3>Excel ile Toplu Veri</h3>
            <p>Hazır Excel şablonumuzu indirin, doldurun ve sisteme yükleyin. Yüzlerce kaydı saniyeler içinde aktarın.</p>
          </div>
          <div className="service-card">
            <div className="service-icon">💰</div>
            <h3>Gelir-Gider Takibi</h3>
            <p>Sitenizin tüm gelir ve giderlerini kayıt altına alın. Aylık ve yıllık mali raporlarınıza kolayca ulaşın.</p>
          </div>
          <div className="service-card">
            <div className="service-icon">📈</div>
            <h3>Detaylı Raporlama</h3>
            <p>Tahsilat raporları, borç dökümleri ve gelir-gider analizleri ile yönetiminizi veriye dayalı kararlarla güçlendirin.</p>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="section" id="how-it-works" style={{ background: 'var(--bg-secondary)' }}>
        <div className="section-header">
          <div className="overline">Nasıl Çalışır</div>
          <h2 className="heading-lg">4 Adımda Başlayın</h2>
          <p>Sisteme kayıt olmak ve kullanmaya başlamak son derece kolaydır.</p>
        </div>
        <div className="steps-container">
          <div className="step-item">
            <div className="step-number">1</div>
            <h3>Üye Olun</h3>
            <p>Bilgilerinizi girerek hızlıca kayıt olun.</p>
          </div>
          <div className="step-item">
            <div className="step-number">2</div>
            <h3>Belgeleri Yükleyin</h3>
            <p>Gerekli evrakları sisteme yükleyerek onay sürecini başlatın.</p>
          </div>
          <div className="step-item">
            <div className="step-number">3</div>
            <h3>Site Bilgilerinizi Girin</h3>
            <p>Sitenizi, bloklarınızı, dairelerinizi ve sakinlerinizi ekleyin.</p>
          </div>
          <div className="step-item">
            <div className="step-number">4</div>
            <h3>Yönetmeye Başlayın</h3>
            <p>Aidat takibi, SMS gönderimi ve raporlamayı kullanmaya başlayın.</p>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="section" id="faq">
        <div className="section-header">
          <div className="overline">Sıkça Sorulan Sorular</div>
          <h2 className="heading-lg">Merak Ettikleriniz</h2>
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
      </section>

      {/* ── Testimonials ── */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="section-header">
          <div className="overline">Referanslar</div>
          <h2 className="heading-lg">Müşterilerimiz Ne Diyor?</h2>
        </div>
        <div className="testimonials-grid">
          {testimonials.map((t, i) => (
            <div key={i} className="testimonial-card">
              <div className="testimonial-stars">★★★★★</div>
              <p className="testimonial-text">&ldquo;{t.text}&rdquo;</p>
              <div className="testimonial-author">
                <div className="testimonial-avatar">{t.initials}</div>
                <div className="testimonial-info">
                  <h4>{t.name}</h4>
                  <p>{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Contact ── */}
      <section className="section contact-section" id="contact">
        <div className="contact-container">
          <div className="contact-info">
            <div className="overline" style={{ marginBottom: 'var(--space-md)', color: 'var(--primary-400)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em' }}>İletişim</div>
            <h2 className="heading-lg">Sizi Arayalım</h2>
            <p>
              Bilgilerinizi bırakın, uzman ekibimiz en kısa sürede sizi arasın. 
              Tüm sorularınızı yanıtlayalım ve size en uygun çözümü sunalım.
            </p>
            <div className="contact-details">
              <div className="contact-detail-item">
                <div className="icon">📞</div>
                <span>0850 XXX XX XX</span>
              </div>
              <div className="contact-detail-item">
                <div className="icon">✉️</div>
                <span>info@aidatom.com</span>
              </div>
              <div className="contact-detail-item">
                <div className="icon">📍</div>
                <span>İstanbul, Türkiye</span>
              </div>
            </div>
          </div>

          <form className="contact-form" onSubmit={handleContactSubmit}>
            <h3>Bize Ulaşın</h3>
            {contactSubmitted && (
              <div style={{
                padding: 'var(--space-md)',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--success-light)',
                marginBottom: 'var(--space-lg)',
                fontSize: '0.9375rem'
              }}>
                ✓ Mesajınız başarıyla gönderildi. En kısa sürede sizi arayacağız.
              </div>
            )}
            <div className="form-group">
              <label className="form-label" htmlFor="contact-name">
                Ad Soyad <span className="required">*</span>
              </label>
              <input
                id="contact-name"
                type="text"
                className="form-input"
                placeholder="Adınız Soyadınız"
                value={contactForm.full_name}
                onChange={(e) => setContactForm({ ...contactForm, full_name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="contact-phone">
                Telefon <span className="required">*</span>
              </label>
              <input
                id="contact-phone"
                type="tel"
                className="form-input"
                placeholder="05XX XXX XX XX"
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="contact-email">E-posta</label>
              <input
                id="contact-email"
                type="email"
                className="form-input"
                placeholder="ornek@mail.com"
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="contact-message">
                Mesajınız <span className="required">*</span>
              </label>
              <textarea
                id="contact-message"
                className="form-input"
                placeholder="Size nasıl yardımcı olabiliriz?"
                rows={4}
                value={contactForm.message}
                onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={contactLoading}>
              {contactLoading ? (
                <>
                  <span className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }}></span>
                  Gönderiliyor...
                </>
              ) : (
                'Gönder'
              )}
            </button>
          </form>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-grid">
            <div className="footer-brand">
              <a href="/" className="navbar-logo" style={{ marginBottom: 'var(--space-sm)' }}>
                <div className="logo-icon">A</div>
                <span>
                  <span className="text-gradient">Aidat</span>om
                </span>
              </a>
              <p>
                Site yöneticileri ve profesyonel yönetim şirketleri için
                geliştirilmiş kapsamlı aidat yönetim platformu.
              </p>
            </div>
            <div className="footer-col">
              <h4>Platform</h4>
              <a href="#services" onClick={(e) => { e.preventDefault(); scrollToSection('services'); }}>Hizmetlerimiz</a>
              <a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollToSection('how-it-works'); }}>Nasıl Çalışır</a>
              <a href="#faq" onClick={(e) => { e.preventDefault(); scrollToSection('faq'); }}>SSS</a>
            </div>
            <div className="footer-col">
              <h4>Hesap</h4>
              <a href="/giris">Giriş Yap</a>
              <a href="/kayit">Üye Ol</a>
            </div>
            <div className="footer-col">
              <h4>İletişim</h4>
              <a href="tel:08501234567">0850 XXX XX XX</a>
              <a href="mailto:info@aidatom.com">info@aidatom.com</a>
              <a href="#contact" onClick={(e) => { e.preventDefault(); scrollToSection('contact'); }}>Bize Ulaşın</a>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Aidatom. Tüm hakları saklıdır.</span>
            <span>KVKK & Gizlilik Politikası</span>
          </div>
        </div>
      </footer>
    </>
  );
}
