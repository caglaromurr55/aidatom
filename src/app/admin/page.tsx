'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { Users, Building2, Scale, Banknote, TrendingUp, Shield, PhoneCall, Award } from 'lucide-react';

interface LawyerPerformance {
  id: string;
  full_name: string;
  phone: string;
  casesCount: number;
  totalDebt: number;
  totalCollected: number;
  totalAttorneyFee: number;
  successRate: number;
}

export default function AdminDashboard() {
  const supabase = createClient();
  const [stats, setStats] = useState({
    managersCount: 0,
    sitesCount: 0,
    totalLegalDebt: 0,
    totalLegalCollected: 0,
    totalAttorneyFees: 0,
    legalRate: 0,
    totalCallsLogged: 0,
    pendingContactsCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lawyerPerformances, setLawyerPerformances] = useState<LawyerPerformance[]>([]);
  const [recentCases, setRecentCases] = useState<any[]>([]);

  const loadStats = useCallback(async () => {
    setLoading(true);

    // Count site managers & lawyers
    const [managers, lawyers, sites] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'site_manager'),
      supabase.from('profiles').select('*').eq('role', 'lawyer'),
      supabase.from('sites').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    ]);

    // Sum legal cases amounts
    const { data: legalCases } = await supabase
      .from('legal_cases')
      .select('id, total_debt, total_late_fee, attorney_fee, court_expenses, collected_amount, assigned_lawyer_id, status');

    let debtSum = 0;
    let collectedSum = 0;
    let attorneyFeeSum = 0;

    legalCases?.forEach((lc) => {
      debtSum += (Number(lc.total_debt) + Number(lc.total_late_fee) + Number(lc.court_expenses || 0) + Number(lc.attorney_fee || 0));
      collectedSum += Number(lc.collected_amount || 0);
      attorneyFeeSum += Number(lc.attorney_fee || 0);
    });

    // Compute Lawyer Performance List
    const lawyerList: LawyerPerformance[] = [];
    const loadedLawyers = (lawyers.data as any[]) || [];

    for (const law of loadedLawyers) {
      const assignedCases = legalCases?.filter((c) => c.assigned_lawyer_id === law.id) || [];
      // If no explicit assignment, attribute all cases for single firm view or assigned ones
      const targetCases = assignedCases.length > 0 ? assignedCases : (legalCases || []);
      
      let lDebt = 0;
      let lColl = 0;
      let lFee = 0;

      targetCases.forEach((c) => {
        lDebt += (Number(c.total_debt) + Number(c.total_late_fee) + Number(c.court_expenses || 0) + Number(c.attorney_fee || 0));
        lColl += Number(c.collected_amount || 0);
        lFee += Number(c.attorney_fee || 0);
      });

      lawyerList.push({
        id: law.id,
        full_name: law.full_name,
        phone: law.phone,
        casesCount: targetCases.length,
        totalDebt: lDebt,
        totalCollected: lColl,
        totalAttorneyFee: lFee,
        successRate: lDebt > 0 ? Number(((lColl / lDebt) * 100).toFixed(1)) : 0,
      });
    }

    // Call Center stats
    const [calls, pendingContacts] = await Promise.all([
      supabase.from('call_logs').select('*', { count: 'exact', head: true }),
      supabase.from('contact_requests').select('*', { count: 'exact', head: true }).eq('is_read', false),
    ]);

    // Recent referred cases
    const { data: recent } = await supabase
      .from('legal_cases')
      .select(`
        id,
        total_debt,
        total_late_fee,
        attorney_fee,
        status,
        referred_at,
        residents (full_name),
        sites (name)
      `)
      .order('referred_at', { ascending: false })
      .limit(5);

    setStats({
      managersCount: managers.count || 0,
      sitesCount: sites.count || 0,
      totalLegalDebt: debtSum,
      totalLegalCollected: collectedSum,
      totalAttorneyFees: attorneyFeeSum,
      legalRate: debtSum > 0 ? Number(((collectedSum / debtSum) * 100).toFixed(1)) : 0,
      totalCallsLogged: calls.count || 0,
      pendingContactsCount: pendingContacts.count || 0,
    });

    setLawyerPerformances(lawyerList);
    if (recent) setRecentCases(recent);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card" style={{ height: 110, backgroundColor: 'var(--bg-secondary)', opacity: 0.6 }}></div>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Üye Yöneticiler', value: stats.managersCount, color: 'var(--color-navy)', icon: Users },
    { label: 'Toplam Site', value: stats.sitesCount, color: 'var(--color-teal)', icon: Building2 },
    { label: 'İcradaki Toplam Borç', value: formatCurrency(stats.totalLegalDebt), color: 'var(--error)', icon: Scale },
    { label: 'Tahsil Edilen Tutar', value: formatCurrency(stats.totalLegalCollected), color: 'var(--success)', icon: Banknote },
    { label: 'Avukat Vekalet Hakedişi', value: formatCurrency(stats.totalAttorneyFees), color: 'var(--color-navy)', icon: Award },
    { label: 'Santral Aramaları', value: `${stats.totalCallsLogged} Arama`, color: 'var(--info)', icon: PhoneCall },
  ];

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="heading-md">Platform Genel Bakış (Süper Admin)</h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
              Platform genelindeki avukat hakedişleri, icra tahsilatları, site durumları ve santral metrikleri.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <a href="/admin/kullanicilar" className="btn btn-navy btn-sm">
              <Users size={16} /> Kullanıcı & Rol Yönetimi
            </a>
          </div>
        </div>
      </div>

      {/* Stat Grid */}
      <div className="stat-grid" style={{ marginBottom: '2rem' }}>
        {statCards.map((stat, i) => {
          const IconComp = stat.icon;
          return (
            <div key={i} className="stat-card">
              <div className="stat-card-top">
                <div className="stat-icon"><IconComp size={22} /></div>
                <span className="stat-value" style={{ color: stat.color, fontSize: typeof stat.value === 'string' && stat.value.length > 8 ? '1.3rem' : '1.75rem' }}>
                  {stat.value}
                </span>
              </div>
              <span className="stat-label">{stat.label}</span>
            </div>
          );
        })}
      </div>

      {/* Lawyer Performance Table */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 className="heading-sm" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Award size={20} style={{ color: 'var(--color-teal)' }} /> Avukat İcra Hakediş & Tahsilat Performansı
        </h2>
        {lawyerPerformances.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Henüz sistemde kayıtlı sözleşmeli avukat bulunmuyor.</p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Sözleşmeli Avukat</th>
                  <th>İcra Dosya Sayısı</th>
                  <th>Devredilen Toplam Borç</th>
                  <th>Tahsil Edilen Tutar</th>
                  <th>Vekalet Ücreti (Hakediş)</th>
                  <th>Tahsilat Başarı Oranı</th>
                </tr>
              </thead>
              <tbody>
                {lawyerPerformances.map((law) => (
                  <tr key={law.id}>
                    <td style={{ fontWeight: 600 }}>
                      <div>{law.full_name}</div>
                      <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>📞 +{law.phone}</div>
                    </td>
                    <td><span className="badge badge-neutral">{law.casesCount} Dosya</span></td>
                    <td style={{ fontWeight: 600, color: 'var(--error)' }}>{formatCurrency(law.totalDebt)}</td>
                    <td style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(law.totalCollected)}</td>
                    <td style={{ fontWeight: 700, color: 'var(--color-navy)' }}>{formatCurrency(law.totalAttorneyFee)}</td>
                    <td>
                      <span className={`badge ${law.successRate >= 50 ? 'badge-success' : 'badge-warning'}`}>
                        %{law.successRate} Başarı
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Legal Handovers */}
      <div className="card">
        <h2 className="heading-sm" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Scale size={20} style={{ color: 'var(--color-teal)' }} /> Hukuk Departmanına Devredilen Son Dosyalar
        </h2>

        {recentCases.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Henüz hukuka devredilmiş bir icra dosyası bulunmamaktadır.</p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Borçlu Sakin</th>
                  <th>Bağlı Site</th>
                  <th>Vekalet Hakedişi</th>
                  <th>Toplam Borç Tutar</th>
                  <th>Devir Tarihi</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {recentCases.map((c) => {
                  const totalDebt = Number(c.total_debt) + Number(c.total_late_fee) + Number(c.attorney_fee || 0);
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.residents?.full_name || 'Tanımsız'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Building2 size={14} style={{ color: 'var(--text-tertiary)' }} />
                          {c.sites?.name || '-'}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--color-navy)' }}>{formatCurrency(c.attorney_fee || 0)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--error)' }}>{formatCurrency(totalDebt)}</td>
                      <td className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {new Date(c.referred_at).toLocaleDateString('tr-TR')}
                      </td>
                      <td>
                        <span className="badge badge-warning">{c.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
