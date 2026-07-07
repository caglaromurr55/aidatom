-- ===================================================
-- AIDATOM.COM — VERITABANI ŞEMASI (FAZ 1-4 TAM)
-- Supabase SQL Editor'da çalıştırılacak
-- ===================================================

-- ── Mevcut tabloları temizle (sıralı, foreign key'ler yüzünden) ──
DROP TABLE IF EXISTS excel_imports CASCADE;
DROP TABLE IF EXISTS sms_logs CASCADE;
DROP TABLE IF EXISTS sms_templates CASCADE;
DROP TABLE IF EXISTS manager_handovers CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS legal_case_actions CASCADE;
DROP TABLE IF EXISTS legal_case_charges CASCADE;
DROP TABLE IF EXISTS legal_cases CASCADE;
DROP TABLE IF EXISTS payment_reversals CASCADE;
DROP TABLE IF EXISTS charges CASCADE;
DROP TABLE IF EXISTS charge_types CASCADE;
DROP TABLE IF EXISTS income_expenses CASCADE;
DROP TABLE IF EXISTS residents CASCADE;
DROP TABLE IF EXISTS units CASCADE;
DROP TABLE IF EXISTS blocks CASCADE;
DROP TABLE IF EXISTS sites CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS contact_requests CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ── Drop custom types ──
DROP TYPE IF EXISTS manager_type CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS user_status CASCADE;
DROP TYPE IF EXISTS document_type CASCADE;
DROP TYPE IF EXISTS document_status CASCADE;
DROP TYPE IF EXISTS dues_type CASCADE;
DROP TYPE IF EXISTS late_fee_type CASCADE;
DROP TYPE IF EXISTS charge_status CASCADE;
DROP TYPE IF EXISTS legal_case_status CASCADE;
DROP TYPE IF EXISTS income_expense_type CASCADE;
DROP TYPE IF EXISTS notification_type CASCADE;
DROP TYPE IF EXISTS handover_status CASCADE;
DROP TYPE IF EXISTS sms_status CASCADE;
DROP TYPE IF EXISTS excel_import_status CASCADE;

-- ===================================================
-- ENUM TYPES
-- ===================================================

CREATE TYPE manager_type AS ENUM ('individual', 'company');
CREATE TYPE user_role AS ENUM ('super_admin', 'system_admin', 'site_manager', 'lawyer');
CREATE TYPE user_status AS ENUM ('pending_documents', 'pending_review', 'approved', 'rejected', 'suspended');
CREATE TYPE document_type AS ENUM ('karar_defteri', 'kimlik', 'vergi_levhasi', 'imza_sirkuleri', 'vekaletname', 'sozlesme');
CREATE TYPE document_status AS ENUM ('uploaded', 'approved', 'rejected');
CREATE TYPE dues_type AS ENUM ('fixed', 'area_based', 'share_based');
CREATE TYPE late_fee_type AS ENUM ('legal_rate', 'custom_rate');
CREATE TYPE charge_status AS ENUM ('pending', 'paid', 'overdue', 'partially_paid', 'sent_to_legal');
CREATE TYPE legal_case_status AS ENUM ('pending', 'in_progress', 'collected', 'partially_collected', 'closed');
CREATE TYPE income_expense_type AS ENUM ('income', 'expense');
CREATE TYPE notification_type AS ENUM ('info', 'warning', 'success', 'error');
CREATE TYPE handover_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE sms_status AS ENUM ('queued', 'sent', 'delivered', 'failed');
CREATE TYPE excel_import_status AS ENUM ('processing', 'completed', 'failed');

-- ===================================================
-- TABLES
-- ===================================================

-- ── 1. Profiles (Kullanıcı Profilleri) ──
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  manager_type manager_type NOT NULL DEFAULT 'individual',
  role user_role NOT NULL DEFAULT 'site_manager',
  status user_status NOT NULL DEFAULT 'pending_documents',
  company_name TEXT,
  tax_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ── 2. Documents (Yüklenen Belgeler) ──
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_type document_type NOT NULL,
  file_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  status document_status NOT NULL DEFAULT 'uploaded',
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. Sites (Siteler) ──
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  district TEXT NOT NULL,
  total_units INTEGER NOT NULL DEFAULT 0,
  dues_type dues_type NOT NULL DEFAULT 'fixed',
  default_dues_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  late_fee_type late_fee_type NOT NULL DEFAULT 'legal_rate',
  late_fee_rate DECIMAL(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ── 4. Blocks (Bloklar) ──
CREATE TABLE blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_floors INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ── 5. Units (Daireler / Bağımsız Bölümler) ──
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  unit_number TEXT NOT NULL,
  floor INTEGER NOT NULL DEFAULT 1,
  area_sqm DECIMAL(8,2),
  share_ratio DECIMAL(8,6),
  dues_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ── 6. Residents (Daire Sakinleri / Borçlular) ──
CREATE TABLE residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  tc_no TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  is_owner BOOLEAN NOT NULL DEFAULT true,
  move_in_date DATE,
  move_out_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ── 7. Charge Types (Alacak Türleri) ──
CREATE TABLE charge_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT true,
  default_amount DECIMAL(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 8. Charges (Tahakkuklar / Borçlandırmalar) ──
CREATE TABLE charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  charge_type_id UUID NOT NULL REFERENCES charge_types(id) ON DELETE CASCADE,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL CHECK (period_year >= 2020),
  amount DECIMAL(12,2) NOT NULL,
  due_date DATE NOT NULL,
  status charge_status NOT NULL DEFAULT 'pending',
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES profiles(id),
  late_fee_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 9. Payment Reversals (Ödeme Geri Almaları) ──
CREATE TABLE payment_reversals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id UUID NOT NULL REFERENCES charges(id) ON DELETE CASCADE,
  reversed_by UUID NOT NULL REFERENCES profiles(id),
  original_paid_amount DECIMAL(12,2) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 10. Legal Cases (İcra Dosyaları) ──
CREATE TABLE legal_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  referred_by UUID NOT NULL REFERENCES profiles(id),
  total_debt DECIMAL(12,2) NOT NULL,
  total_late_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  status legal_case_status NOT NULL DEFAULT 'pending',
  collected_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  referred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 11. Legal Case Charges (İcra Dosyasına Bağlı Borçlar) ──
CREATE TABLE legal_case_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  charge_id UUID NOT NULL REFERENCES charges(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(legal_case_id, charge_id)
);

-- ── 12. Legal Case Actions (Avukat İşlem Kayıtları) ──
CREATE TABLE legal_case_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  action_by UUID NOT NULL REFERENCES profiles(id),
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 13. Income Expenses (Gelir-Gider Kayıtları) ──
CREATE TABLE income_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  type income_expense_type NOT NULL,
  category TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT NOT NULL,
  transaction_date DATE NOT NULL,
  recorded_by UUID NOT NULL REFERENCES profiles(id),
  receipt_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 14. Manager Handovers (Yönetici Devir İşlemleri) ──
CREATE TABLE manager_handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  from_manager_id UUID NOT NULL REFERENCES profiles(id),
  to_manager_id UUID NOT NULL REFERENCES profiles(id),
  status handover_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 15. SMS Templates (SMS Şablonları) ──
CREATE TABLE sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 16. SMS Logs (SMS Gönderim Kayıtları) ──
CREATE TABLE sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES sms_templates(id),
  sent_to_phone TEXT NOT NULL,
  sent_to_resident_id UUID REFERENCES residents(id),
  content TEXT NOT NULL,
  status sms_status NOT NULL DEFAULT 'queued',
  sent_by UUID NOT NULL REFERENCES profiles(id),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 17. Audit Logs (Denetim Kayıtları) ──
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 18. Notifications (Bildirimler) ──
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type notification_type NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 19. Contact Requests (Sizi Arayalım Talepleri) ──
CREATE TABLE contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 20. System Settings (Sistem Ayarları) ──
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 21. Excel Imports (Excel Yükleme Geçmişi) ──
CREATE TABLE excel_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  file_path TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  successful_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  error_details JSONB,
  status excel_import_status NOT NULL DEFAULT 'processing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===================================================
-- INDEXES
-- ===================================================

CREATE INDEX idx_profiles_phone ON profiles(phone);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_status ON profiles(status);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_sites_manager_id ON sites(manager_id);
CREATE INDEX idx_blocks_site_id ON blocks(site_id);
CREATE INDEX idx_units_block_id ON units(block_id);
CREATE INDEX idx_residents_unit_id ON residents(unit_id);
CREATE INDEX idx_residents_tc_no ON residents(tc_no);
CREATE INDEX idx_charges_resident_id ON charges(resident_id);
CREATE INDEX idx_charges_unit_id ON charges(unit_id);
CREATE INDEX idx_charges_status ON charges(status);
CREATE INDEX idx_charges_due_date ON charges(due_date);
CREATE INDEX idx_charges_period ON charges(period_year, period_month);
CREATE INDEX idx_legal_cases_resident_id ON legal_cases(resident_id);
CREATE INDEX idx_legal_cases_site_id ON legal_cases(site_id);
CREATE INDEX idx_legal_cases_status ON legal_cases(status);
CREATE INDEX idx_income_expenses_site_id ON income_expenses(site_id);
CREATE INDEX idx_income_expenses_date ON income_expenses(transaction_date);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_contact_requests_is_read ON contact_requests(is_read);

-- ===================================================
-- TRIGGERS: auto-update updated_at
-- ===================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON sites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_blocks_updated_at BEFORE UPDATE ON blocks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_residents_updated_at BEFORE UPDATE ON residents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_charge_types_updated_at BEFORE UPDATE ON charge_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_charges_updated_at BEFORE UPDATE ON charges FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_legal_cases_updated_at BEFORE UPDATE ON legal_cases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_income_expenses_updated_at BEFORE UPDATE ON income_expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_manager_handovers_updated_at BEFORE UPDATE ON manager_handovers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sms_templates_updated_at BEFORE UPDATE ON sms_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================================
-- TRIGGER: Auto-create profile on auth.users insert
-- ===================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_phone TEXT;
  v_email TEXT;
  v_manager_type manager_type;
  v_role user_role;
BEGIN
  -- Extract metadata safely
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  
  -- Resolve phone: check NEW.phone first, then raw_user_meta_data, then generate a unique temp one if completely missing (to prevent UNIQUE constraint crashes)
  v_phone := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone');
  IF v_phone IS NULL OR v_phone = '' THEN
    v_phone := 'TEMP_' || NEW.id::text;
  END IF;

  v_email := COALESCE(NEW.email, '');

  -- Safely parse manager_type
  BEGIN
    v_manager_type := COALESCE(NEW.raw_user_meta_data->>'manager_type', 'individual')::manager_type;
  EXCEPTION WHEN OTHERS THEN
    v_manager_type := 'individual'::manager_type;
  END;

  -- Safely parse role
  BEGIN
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'site_manager')::user_role;
  EXCEPTION WHEN OTHERS THEN
    v_role := 'site_manager'::user_role;
  END;

  INSERT INTO public.profiles (
    id, 
    full_name, 
    phone, 
    email, 
    manager_type, 
    role, 
    status,
    company_name,
    tax_number
  )
  VALUES (
    NEW.id,
    v_full_name,
    v_phone,
    v_email,
    v_manager_type,
    v_role,
    'pending_documents',
    NEW.raw_user_meta_data->>'company_name',
    NEW.raw_user_meta_data->>'tax_number'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ===================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ===================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE charge_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reversals ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_case_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_case_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE excel_imports ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'system_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Profiles Policies ──
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (is_admin());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING (is_admin());

-- ── Documents Policies ──
CREATE POLICY "Users can view own documents"
  ON documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all documents"
  ON documents FOR SELECT
  USING (is_admin());

CREATE POLICY "Users can insert own documents"
  ON documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any document"
  ON documents FOR UPDATE
  USING (is_admin());

-- ── Sites Policies ──
CREATE POLICY "Managers can view own sites"
  ON sites FOR SELECT
  USING (auth.uid() = manager_id);

CREATE POLICY "Admins can view all sites"
  ON sites FOR SELECT
  USING (is_admin());

CREATE POLICY "Managers can insert sites"
  ON sites FOR INSERT
  WITH CHECK (auth.uid() = manager_id);

CREATE POLICY "Managers can update own sites"
  ON sites FOR UPDATE
  USING (auth.uid() = manager_id);

CREATE POLICY "Managers can delete own sites"
  ON sites FOR DELETE
  USING (auth.uid() = manager_id);

-- ── Blocks Policies ──
CREATE POLICY "Users can view blocks of their sites"
  ON blocks FOR SELECT
  USING (EXISTS (SELECT 1 FROM sites WHERE sites.id = blocks.site_id AND sites.manager_id = auth.uid()));

CREATE POLICY "Admins can view all blocks"
  ON blocks FOR SELECT
  USING (is_admin());

CREATE POLICY "Managers can manage blocks"
  ON blocks FOR ALL
  USING (EXISTS (SELECT 1 FROM sites WHERE sites.id = blocks.site_id AND sites.manager_id = auth.uid()));

-- ── Units Policies ──
CREATE POLICY "Users can view units of their blocks"
  ON units FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM blocks 
    JOIN sites ON sites.id = blocks.site_id 
    WHERE blocks.id = units.block_id AND sites.manager_id = auth.uid()
  ));

CREATE POLICY "Admins can view all units"
  ON units FOR SELECT
  USING (is_admin());

CREATE POLICY "Managers can manage units"
  ON units FOR ALL
  USING (EXISTS (
    SELECT 1 FROM blocks 
    JOIN sites ON sites.id = blocks.site_id 
    WHERE blocks.id = units.block_id AND sites.manager_id = auth.uid()
  ));

-- ── Residents Policies ──
CREATE POLICY "Managers can view their residents"
  ON residents FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM units 
    JOIN blocks ON blocks.id = units.block_id 
    JOIN sites ON sites.id = blocks.site_id 
    WHERE units.id = residents.unit_id AND sites.manager_id = auth.uid()
  ));

CREATE POLICY "Admins can view all residents"
  ON residents FOR SELECT
  USING (is_admin());

CREATE POLICY "Lawyers can view residents with legal cases"
  ON residents FOR SELECT
  USING (
    get_user_role() = 'lawyer' 
    AND EXISTS (SELECT 1 FROM legal_cases WHERE legal_cases.resident_id = residents.id)
  );

CREATE POLICY "Managers can manage their residents"
  ON residents FOR ALL
  USING (EXISTS (
    SELECT 1 FROM units 
    JOIN blocks ON blocks.id = units.block_id 
    JOIN sites ON sites.id = blocks.site_id 
    WHERE units.id = residents.unit_id AND sites.manager_id = auth.uid()
  ));

-- ── Charges Policies ──
CREATE POLICY "Managers can view their charges"
  ON charges FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM units 
    JOIN blocks ON blocks.id = units.block_id 
    JOIN sites ON sites.id = blocks.site_id 
    WHERE units.id = charges.unit_id AND sites.manager_id = auth.uid()
  ));

CREATE POLICY "Admins can view all charges"
  ON charges FOR SELECT
  USING (is_admin());

CREATE POLICY "Lawyers can view charges in legal cases"
  ON charges FOR SELECT
  USING (
    get_user_role() = 'lawyer'
    AND EXISTS (
      SELECT 1 FROM legal_case_charges lcc 
      JOIN legal_cases lc ON lc.id = lcc.legal_case_id 
      WHERE lcc.charge_id = charges.id
    )
  );

CREATE POLICY "Managers can manage their charges"
  ON charges FOR ALL
  USING (EXISTS (
    SELECT 1 FROM units 
    JOIN blocks ON blocks.id = units.block_id 
    JOIN sites ON sites.id = blocks.site_id 
    WHERE units.id = charges.unit_id AND sites.manager_id = auth.uid()
  ));

-- ── Charge Types Policies ──
CREATE POLICY "Managers can view their charge types"
  ON charge_types FOR SELECT
  USING (EXISTS (SELECT 1 FROM sites WHERE sites.id = charge_types.site_id AND sites.manager_id = auth.uid()));

CREATE POLICY "Managers can manage their charge types"
  ON charge_types FOR ALL
  USING (EXISTS (SELECT 1 FROM sites WHERE sites.id = charge_types.site_id AND sites.manager_id = auth.uid()));

-- ── Legal Cases Policies ──
CREATE POLICY "Managers can view their legal cases"
  ON legal_cases FOR SELECT
  USING (EXISTS (SELECT 1 FROM sites WHERE sites.id = legal_cases.site_id AND sites.manager_id = auth.uid()));

CREATE POLICY "Lawyers can view all legal cases"
  ON legal_cases FOR SELECT
  USING (get_user_role() = 'lawyer');

CREATE POLICY "Admins can view all legal cases"
  ON legal_cases FOR SELECT
  USING (is_admin());

CREATE POLICY "Managers can insert legal cases"
  ON legal_cases FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM sites WHERE sites.id = legal_cases.site_id AND sites.manager_id = auth.uid()));

CREATE POLICY "Lawyers can update legal cases"
  ON legal_cases FOR UPDATE
  USING (get_user_role() = 'lawyer');

-- ── Legal Case Actions Policies ──
CREATE POLICY "Lawyers can manage legal case actions"
  ON legal_case_actions FOR ALL
  USING (get_user_role() = 'lawyer');

CREATE POLICY "Admins can view legal case actions"
  ON legal_case_actions FOR SELECT
  USING (is_admin());

CREATE POLICY "Managers can view their legal case actions"
  ON legal_case_actions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM legal_cases lc 
    JOIN sites s ON s.id = lc.site_id 
    WHERE lc.id = legal_case_actions.legal_case_id AND s.manager_id = auth.uid()
  ));

-- ── Legal Case Charges Policies ──
CREATE POLICY "Involved users can view legal case charges"
  ON legal_case_charges FOR SELECT
  USING (
    get_user_role() = 'lawyer'
    OR is_admin()
    OR EXISTS (
      SELECT 1 FROM legal_cases lc 
      JOIN sites s ON s.id = lc.site_id 
      WHERE lc.id = legal_case_charges.legal_case_id AND s.manager_id = auth.uid()
    )
  );

CREATE POLICY "Managers can insert legal case charges"
  ON legal_case_charges FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM legal_cases lc 
    JOIN sites s ON s.id = lc.site_id 
    WHERE lc.id = legal_case_charges.legal_case_id AND s.manager_id = auth.uid()
  ));

-- ── Payment Reversals Policies ──
CREATE POLICY "Managers can manage payment reversals"
  ON payment_reversals FOR ALL
  USING (EXISTS (
    SELECT 1 FROM charges c 
    JOIN units u ON u.id = c.unit_id 
    JOIN blocks b ON b.id = u.block_id 
    JOIN sites s ON s.id = b.site_id 
    WHERE c.id = payment_reversals.charge_id AND s.manager_id = auth.uid()
  ));

-- ── Income Expenses Policies ──
CREATE POLICY "Managers can view their income_expenses"
  ON income_expenses FOR SELECT
  USING (EXISTS (SELECT 1 FROM sites WHERE sites.id = income_expenses.site_id AND sites.manager_id = auth.uid()));

CREATE POLICY "Managers can manage their income_expenses"
  ON income_expenses FOR ALL
  USING (EXISTS (SELECT 1 FROM sites WHERE sites.id = income_expenses.site_id AND sites.manager_id = auth.uid()));

-- ── Notifications Policies ──
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- ── Audit Logs Policies ──
CREATE POLICY "Admins can view all audit logs"
  ON audit_logs FOR SELECT
  USING (is_admin());

CREATE POLICY "Users can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ── Contact Requests Policies ──
CREATE POLICY "Anyone can insert contact requests"
  ON contact_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view contact requests"
  ON contact_requests FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can update contact requests"
  ON contact_requests FOR UPDATE
  USING (is_admin());

-- ── System Settings Policies ──
CREATE POLICY "Anyone can read system settings"
  ON system_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage system settings"
  ON system_settings FOR ALL
  USING (is_admin());

-- ── SMS Templates Policies ──
CREATE POLICY "Approved users can view active sms templates"
  ON sms_templates FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage sms templates"
  ON sms_templates FOR ALL
  USING (is_admin());

-- ── SMS Logs Policies ──
CREATE POLICY "Users can view own sms logs"
  ON sms_logs FOR SELECT
  USING (auth.uid() = sent_by);

CREATE POLICY "Admins can view all sms logs"
  ON sms_logs FOR SELECT
  USING (is_admin());

CREATE POLICY "Users can insert sms logs"
  ON sms_logs FOR INSERT
  WITH CHECK (auth.uid() = sent_by);

-- ── Manager Handovers Policies ──
CREATE POLICY "Involved managers can view handovers"
  ON manager_handovers FOR SELECT
  USING (auth.uid() = from_manager_id OR auth.uid() = to_manager_id OR is_admin());

CREATE POLICY "Managers can create handovers"
  ON manager_handovers FOR INSERT
  WITH CHECK (auth.uid() = from_manager_id);

CREATE POLICY "Admins can update handovers"
  ON manager_handovers FOR UPDATE
  USING (is_admin());

-- ── Excel Imports Policies ──
CREATE POLICY "Users can view own imports"
  ON excel_imports FOR SELECT
  USING (auth.uid() = uploaded_by);

CREATE POLICY "Users can create imports"
  ON excel_imports FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can update own imports"
  ON excel_imports FOR UPDATE
  USING (auth.uid() = uploaded_by);

-- ===================================================
-- SEED DATA: System Settings
-- ===================================================

INSERT INTO system_settings (key, value, description) VALUES
  ('legal_interest_rate', '24', 'Yasal faiz oranı (yıllık yüzde)'),
  ('platform_name', 'Aidatom', 'Platform adı'),
  ('support_phone', '0850 XXX XX XX', 'Destek telefon numarası'),
  ('support_email', 'info@aidatom.com', 'Destek e-posta adresi');

-- ===================================================
-- PERFORMANCE INDEXES (DATABASE OPTIMIZATIONS)
-- ===================================================

-- profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

-- documents indexes
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

-- sites indexes
CREATE INDEX IF NOT EXISTS idx_sites_manager_id ON sites(manager_id);

-- blocks indexes
CREATE INDEX IF NOT EXISTS idx_blocks_site_id ON blocks(site_id);

-- units indexes
CREATE INDEX IF NOT EXISTS idx_units_block_id ON units(block_id);

-- residents indexes
CREATE INDEX IF NOT EXISTS idx_residents_unit_id ON residents(unit_id);
CREATE INDEX IF NOT EXISTS idx_residents_is_active ON residents(is_active);

-- charges indexes
CREATE INDEX IF NOT EXISTS idx_charges_resident_id ON charges(resident_id);
CREATE INDEX IF NOT EXISTS idx_charges_unit_id ON charges(unit_id);
CREATE INDEX IF NOT EXISTS idx_charges_status ON charges(status);
CREATE INDEX IF NOT EXISTS idx_charges_due_date ON charges(due_date);

-- legal_cases indexes
CREATE INDEX IF NOT EXISTS idx_legal_cases_resident_id ON legal_cases(resident_id);
CREATE INDEX IF NOT EXISTS idx_legal_cases_site_id ON legal_cases(site_id);
CREATE INDEX IF NOT EXISTS idx_legal_cases_status ON legal_cases(status);

-- legal_case_charges indexes
CREATE INDEX IF NOT EXISTS idx_legal_case_charges_legal_case_id ON legal_case_charges(legal_case_id);
CREATE INDEX IF NOT EXISTS idx_legal_case_charges_charge_id ON legal_case_charges(charge_id);

-- legal_case_actions indexes
CREATE INDEX IF NOT EXISTS idx_legal_case_actions_legal_case_id ON legal_case_actions(legal_case_id);

-- income_expenses indexes
CREATE INDEX IF NOT EXISTS idx_income_expenses_site_id ON income_expenses(site_id);
CREATE INDEX IF NOT EXISTS idx_income_expenses_type ON income_expenses(type);

-- manager_handovers indexes
CREATE INDEX IF NOT EXISTS idx_manager_handovers_site_id ON manager_handovers(site_id);
CREATE INDEX IF NOT EXISTS idx_manager_handovers_status ON manager_handovers(status);

-- sms_logs indexes
CREATE INDEX IF NOT EXISTS idx_sms_logs_sent_to_resident_id ON sms_logs(sent_to_resident_id);

-- notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- audit_logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
