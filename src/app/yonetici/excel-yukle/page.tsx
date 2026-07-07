'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Site } from '@/types';
import * as XLSX from 'xlsx';

interface RowError {
  row: number;
  message: string;
}

export default function ExcelImportPage() {
  const supabase = createClient();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [importType, setImportType] = useState<'residents' | 'charges'>('residents');
  
  // Drag & drop and file state
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  
  // Parse state
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [parseSuccess, setParseSuccess] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [dbSuccess, setDbSuccess] = useState('');
  const [dbError, setDbError] = useState('');

  useEffect(() => {
    async function loadSites() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('sites')
        .select('*')
        .eq('manager_id', user.id)
        .is('deleted_at', null);
      if (data) setSites(data as Site[]);
      setLoading(false);
    }
    loadSites();
  }, [supabase]);

  // Generate Excel Templates using SheetJS
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    let wsData: any[] = [];

    if (importType === 'residents') {
      wsData = [
        ['Blok Adı', 'Daire No', 'Bulunduğu Kat', 'Alan (m2)', 'Arsa Payı', 'Sakin Adı Soyadı', 'TC Kimlik No', 'Telefon', 'E-posta', 'Sakin Türü (Malik/Kiraci)'],
        ['A Blok', '1', '1', '120', '0.05', 'Ahmet Yılmaz', '12345678901', '5551234567', 'ahmet@mail.com', 'Malik'],
        ['A Blok', '2', '1', '90', '0.03', 'Mehmet Demir', '98765432109', '5559876543', 'mehmet@mail.com', 'Kiraci']
      ];
    } else {
      wsData = [
        ['Blok Adı', 'Daire No', 'Borç Türü (Aidat/Demirbas)', 'Tutar (TL)', 'Dönem Ayı (1-12)', 'Dönem Yılı', 'Son Ödeme Tarihi (YYYY-MM-DD)'],
        ['A Blok', '1', 'Aidat', '450', '7', '2026', '2026-07-20'],
        ['A Blok', '2', 'Demirbaş', '1500', '7', '2026', '2026-07-25']
      ];
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Şablon');
    XLSX.writeFile(wb, `aidatom_${importType}_sablon.xlsx`);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Parse Excel File
  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    setParsedData([]);
    setErrors([]);
    setParseSuccess(false);
    setDbSuccess('');
    setDbError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[];

        validateAndParseRows(rows);
      } catch (err: any) {
        setDbError('Dosya okunurken bir hata oluştu: ' + err.message);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  // Validation Logic
  const validateAndParseRows = (rows: any[]) => {
    if (rows.length < 2) {
      setErrors([{ row: 0, message: 'Yüklenecek veri bulunamadı. Şablondaki başlık satırı ve en az 1 veri satırı bulunmalıdır.' }]);
      return;
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);
    const parsed: any[] = [];
    const errs: RowError[] = [];

    dataRows.forEach((row, index) => {
      const rowNum = index + 2; // Excel 1-based index including headers
      
      // Skip completely empty rows
      if (row.length === 0 || row.every((cell: any) => cell === undefined || cell === null || cell === '')) {
        return;
      }

      if (importType === 'residents') {
        const [
          blockName, unitNo, floor, area, share, residentName, tcNo, phone, email, residentType
        ] = row;

        if (!blockName) errs.push({ row: rowNum, message: 'Blok Adı boş olamaz.' });
        if (!unitNo) errs.push({ row: rowNum, message: 'Daire No boş olamaz.' });
        if (!residentName) errs.push({ row: rowNum, message: 'Sakin Adı Soyadı boş olamaz.' });
        if (!tcNo || String(tcNo).trim().length !== 11) {
          errs.push({ row: rowNum, message: `TC Kimlik No 11 haneli olmalıdır (Gelen: ${tcNo || 'boş'}).` });
        }
        
        const typeNormalized = String(residentType || '').trim().toLowerCase();
        if (typeNormalized !== 'malik' && typeNormalized !== 'kiraci') {
          errs.push({ row: rowNum, message: 'Sakin Türü sadece Malik veya Kiraci olabilir.' });
        }

        if (errs.filter(e => e.row === rowNum).length === 0) {
          parsed.push({
            blockName: String(blockName).trim(),
            unitNo: String(unitNo).trim(),
            floor: floor ? Number(floor) : 1,
            area: area ? Number(area) : null,
            share: share ? Number(share) : null,
            residentName: String(residentName).trim(),
            tcNo: String(tcNo).trim(),
            phone: phone ? String(phone).replace(/\D/g, '') : null,
            email: email ? String(email).trim() : null,
            isOwner: typeNormalized === 'malik',
          });
        }
      } else {
        const [
          blockName, unitNo, chargeName, amount, month, year, dueDate
        ] = row;

        if (!blockName) errs.push({ row: rowNum, message: 'Blok Adı boş olamaz.' });
        if (!unitNo) errs.push({ row: rowNum, message: 'Daire No boş olamaz.' });
        if (!chargeName) errs.push({ row: rowNum, message: 'Borç Türü boş olamaz.' });
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
          errs.push({ row: rowNum, message: 'Geçersiz tutar tutarı (0\'dan büyük sayı olmalıdır).' });
        }
        if (!month || isNaN(Number(month)) || Number(month) < 1 || Number(month) > 12) {
          errs.push({ row: rowNum, message: 'Dönem Ayı 1 ile 12 arasında olmalıdır.' });
        }
        if (!year || isNaN(Number(year)) || Number(year) < 2020) {
          errs.push({ row: rowNum, message: 'Dönem Yılı geçersiz.' });
        }
        if (!dueDate || isNaN(Date.parse(dueDate))) {
          errs.push({ row: rowNum, message: 'Son ödeme tarihi geçersiz veya boş (YYYY-MM-DD formatında olmalıdır).' });
        }

        if (errs.filter(e => e.row === rowNum).length === 0) {
          parsed.push({
            blockName: String(blockName).trim(),
            unitNo: String(unitNo).trim(),
            chargeName: String(chargeName).trim(),
            amount: Number(amount),
            periodMonth: Number(month),
            periodYear: Number(year),
            dueDate: new Date(dueDate).toISOString().split('T')[0],
          });
        }
      }
    });

    setErrors(errs);
    setParsedData(parsed);
    if (errs.length === 0 && parsed.length > 0) {
      setParseSuccess(true);
    }
  };

  // Submit to Database
  const saveToDatabase = async () => {
    if (!selectedSiteId) {
      setDbError('Lütfen verileri aktarmak istediğiniz siteyi seçin.');
      return;
    }

    setActionLoading(true);
    setDbSuccess('');
    setDbError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let successCount = 0;

      if (importType === 'residents') {
        for (const item of parsedData) {
          // 1. Get or Create Block
          let blockId = '';
          const { data: block } = await supabase
            .from('blocks')
            .select('id')
            .eq('site_id', selectedSiteId)
            .eq('name', item.blockName)
            .is('deleted_at', null)
            .single();

          if (block) {
            blockId = block.id;
          } else {
            const { data: newBlock, error: bErr } = await supabase
              .from('blocks')
              .insert({ site_id: selectedSiteId, name: item.blockName, total_floors: item.floor })
              .select('id')
              .single();
            if (bErr) throw bErr;
            blockId = newBlock.id;
          }

          // 2. Get or Create Unit
          let unitId = '';
          const { data: unit } = await supabase
            .from('units')
            .select('id')
            .eq('block_id', blockId)
            .eq('unit_number', item.unitNo)
            .is('deleted_at', null)
            .single();

          if (unit) {
            unitId = unit.id;
          } else {
            // Get default dues amount from site
            const siteDetails = sites.find(s => s.id === selectedSiteId);
            const defaultDues = siteDetails?.default_dues_amount || 0;

            const { data: newUnit, error: uErr } = await supabase
              .from('units')
              .insert({
                block_id: blockId,
                unit_number: item.unitNo,
                floor: item.floor,
                area_sqm: item.area,
                share_ratio: item.share,
                dues_amount: defaultDues,
              })
              .select('id')
              .single();
            if (uErr) throw uErr;
            unitId = newUnit.id;
          }

          // 3. Deactivate old residents for this unit
          await supabase
            .from('residents')
            .update({ is_active: false })
            .eq('unit_id', unitId);

          // 4. Create Resident
          const { error: resErr } = await supabase.from('residents').insert({
            unit_id: unitId,
            full_name: item.residentName,
            tc_no: item.tcNo,
            phone: item.phone,
            email: item.email,
            is_owner: item.isOwner,
          });

          if (resErr) throw resErr;
          successCount++;
        }
      } else {
        // Alacak yükleme
        for (const item of parsedData) {
          // 1. Get Block
          const { data: block } = await supabase
            .from('blocks')
            .select('id')
            .eq('site_id', selectedSiteId)
            .eq('name', item.blockName)
            .is('deleted_at', null)
            .single();

          if (!block) {
            throw new Error(`Dairenin bağlı olduğu "${item.blockName}" bloğu sistemde bulunamadı. Önce sakinleri aktarmanız önerilir.`);
          }

          // 2. Get Unit
          const { data: unit } = await supabase
            .from('units')
            .select('id')
            .eq('block_id', block.id)
            .eq('unit_number', item.unitNo)
            .is('deleted_at', null)
            .single();

          if (!unit) {
            throw new Error(`"${item.blockName}" bloğuna bağlı Daire ${item.unitNo} sistemde bulunamadı. Önce daire ve sakinleri kaydetmelisiniz.`);
          }

          // 3. Get Active Resident
          const { data: resident } = await supabase
            .from('residents')
            .select('id')
            .eq('unit_id', unit.id)
            .eq('is_active', true)
            .single();

          if (!resident) {
            throw new Error(`"${item.blockName}" Daire ${item.unitNo} için sistemde aktif sakin bulunamadı. Sakini olmayan daireye borçlandırma yapılamaz.`);
          }

          // 4. Get or Create Charge Type
          let chargeTypeId = '';
          const { data: type } = await supabase
            .from('charge_types')
            .select('id')
            .eq('site_id', selectedSiteId)
            .eq('name', item.chargeName)
            .single();

          if (type) {
            chargeTypeId = type.id;
          } else {
            const { data: newType, error: tErr } = await supabase
              .from('charge_types')
              .insert({ site_id: selectedSiteId, name: item.chargeName, is_recurring: true })
              .select('id')
              .single();
            if (tErr) throw tErr;
            chargeTypeId = newType.id;
          }

          // 5. Create Charge
          const { error: cErr } = await supabase.from('charges').insert({
            resident_id: resident.id,
            unit_id: unit.id,
            charge_type_id: chargeTypeId,
            period_month: item.periodMonth,
            period_year: item.periodYear,
            amount: item.amount,
            due_date: item.dueDate,
            status: 'pending',
          });

          if (cErr) throw cErr;
          successCount++;
        }
      }

      // Write import history log
      await supabase.from('excel_imports').insert({
        site_id: selectedSiteId,
        uploaded_by: user.id,
        file_path: file?.name || 'excel_import',
        total_rows: parsedData.length,
        successful_rows: successCount,
        failed_rows: parsedData.length - successCount,
        status: 'completed',
      });

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'excel_import_completed',
        entity_type: 'site',
        entity_id: selectedSiteId,
        new_values: { type: importType, count: successCount },
      });

      setDbSuccess(`Başarıyla ${successCount} kayıt veritabanına aktarıldı!`);
      setFile(null);
      setParsedData([]);
      setParseSuccess(false);
    } catch (err: any) {
      setDbError('Veritabanına aktarma yapılırken hata oluştu: ' + err.message);
    } finally {
      setActionLoading(false);
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
          <h1 className="heading-sm">Excel ile Toplu Veri Yükleme</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>
            Hazır Excel şablonlarını kullanarak sakinlerinizi veya alacak listelerinizi sisteme toplu aktarın.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={downloadTemplate}>
          📥 Excel Şablonu İndir
        </button>
      </div>

      <div className="page-body">
        {dbSuccess && (
          <div className="auth-alert success" style={{ marginBottom: 'var(--space-lg)' }}>
            <span>✓</span>
            <span>{dbSuccess}</span>
          </div>
        )}
        {dbError && (
          <div className="auth-alert error" style={{ marginBottom: 'var(--space-lg)' }}>
            <span>⚠</span>
            <span>{dbError}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: 'var(--space-xl)', alignItems: 'start' }}>
          {/* Setup Column */}
          <div className="card">
            <h2 className="heading-sm" style={{ fontSize: '1rem', marginBottom: 'var(--space-lg)' }}>1. Yükleme Ayarları</h2>
            
            <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
              <label className="form-label" htmlFor="import-site">Hedef Site/Apartman <span className="required">*</span></label>
              <select
                id="import-site"
                className="form-input"
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                required
              >
                <option value="">Seçin...</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label className="form-label">Yükleme Veri Tipi</label>
              <div className="manager-type-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div
                  className={`manager-type-card ${importType === 'residents' ? 'selected' : ''}`}
                  onClick={() => {
                    setImportType('residents');
                    setFile(null);
                    setParsedData([]);
                    setErrors([]);
                    setParseSuccess(false);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setImportType('residents')}
                  style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: '12px' }}
                >
                  <span style={{ fontSize: '1.5rem' }}>👥</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Sakin Kayıtları</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Blok, daire ve sakin bilgileri</div>
                  </div>
                </div>
                <div
                  className={`manager-type-card ${importType === 'charges' ? 'selected' : ''}`}
                  onClick={() => {
                    setImportType('charges');
                    setFile(null);
                    setParsedData([]);
                    setErrors([]);
                    setParseSuccess(false);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setImportType('charges')}
                  style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: '12px', marginTop: 'var(--space-sm)' }}
                >
                  <span style={{ fontSize: '1.5rem' }}>💰</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Alacak / Borç Kayıtları</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Aidat, demirbaş avans borçlandırmaları</div>
                  </div>
                </div>
              </div>
            </div>

            <button className="btn btn-ghost btn-sm" onClick={downloadTemplate} style={{ width: '100%', color: 'var(--primary-400)', border: '1px dashed var(--border-secondary)' }}>
              ⬇ Şablon Dosyasını İndir
            </button>
          </div>

          {/* Upload and Parse column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
            {/* Drag Drop Area */}
            <div
              className={`upload-zone ${dragActive ? 'dragover' : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              style={{ padding: 'var(--space-3xl)' }}
            >
              <input
                type="file"
                id="excel-file-input"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <label htmlFor="excel-file-input" style={{ cursor: 'pointer' }}>
                <div className="icon">📊</div>
                <h3 style={{ fontSize: '1.125rem', marginBottom: 'var(--space-sm)' }}>
                  {file ? file.name : 'Excel Dosyanızı Buraya Sürükleyin'}
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  veya dosya seçmek için tıklayın (.xlsx, .xls)
                </p>
              </label>
            </div>

            {/* Validation Errors Report */}
            {errors.length > 0 && (
              <div className="card" style={{ borderColor: 'var(--error)' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--error-light)', marginBottom: 'var(--space-md)', fontWeight: 600 }}>
                  ⚠️ Excel Format Hataları ({errors.length})
                </h3>
                <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {errors.map((e, index) => (
                    <div key={index} className="text-sm" style={{ color: 'var(--error-light)', paddingBottom: '4px', borderBottom: '1px solid rgba(239, 68, 68, 0.1)' }}>
                      <strong>Satır {e.row}:</strong> {e.message}
                    </div>
                  ))}
                </div>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-md)' }}>
                  Lütfen Excel dosyasındaki hataları düzelterek tekrar yükleyin.
                </p>
              </div>
            )}

            {/* Success Preview & Save */}
            {parseSuccess && parsedData.length > 0 && (
              <div className="card animate-fade-in" style={{ borderColor: 'var(--success)' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--success-light)', marginBottom: 'var(--space-sm)', fontWeight: 600 }}>
                  ✓ Dosya Okuma Başarılı!
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                  Dosyadan <strong>{parsedData.length}</strong> geçerli kayıt ayrıştırıldı. Aktarmak için aşağıdaki butona basın.
                </p>

                <button
                  className="btn btn-success btn-lg"
                  style={{ width: '100%' }}
                  onClick={saveToDatabase}
                  disabled={actionLoading || !selectedSiteId}
                >
                  {actionLoading ? 'Veritabanına Yazılıyor...' : 'Verileri Sisteme Kaydet'}
                </button>

                {!selectedSiteId && (
                  <p className="text-xs" style={{ color: 'var(--error-light)', marginTop: 'var(--space-sm)', textAlign: 'center' }}>
                    * Lütfen sol panelden hedef siteyi seçin.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
