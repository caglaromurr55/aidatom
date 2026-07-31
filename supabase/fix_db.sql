-- ===================================================
-- AİDATOM — DATABASE FIX & SEED SYNC SCRIPT
-- Run this in your Supabase Dashboard SQL Editor
-- ===================================================

-- 1. Enable pgcrypto extension and add 'call_center' to user_role ENUM
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = 'public.user_role'::regtype 
    AND enumlabel = 'call_center'
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'call_center';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Type might be created dynamically or created in public schema
  NULL;
END $$;

-- 2. Define auto confirm trigger function
CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_confirmed_at := now();
  NEW.phone_confirmed_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-create auto confirm trigger
DROP TRIGGER IF EXISTS tr_auto_confirm_new_user ON auth.users;
CREATE TRIGGER tr_auto_confirm_new_user
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_new_user();

-- 4. Define profile auto creation function with conflict handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
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
  v_phone := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone');
  IF v_phone IS NULL OR v_phone = '' THEN
    v_phone := 'TEMP_' || NEW.id::text;
  END IF;

  v_email := COALESCE(NEW.raw_user_meta_data->>'email', NEW.email, '');

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

  -- Insert profile, resolving conflicts gracefully
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
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    manager_type = EXCLUDED.manager_type,
    role = EXCLUDED.role,
    company_name = EXCLUDED.company_name,
    tax_number = EXCLUDED.tax_number;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. Re-create user creation trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 6. RESET & SYNC ADMIN USERS
-- First delete conflicting logs to prevent FK constraint failures
DELETE FROM public.audit_logs WHERE user_id IN ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'f1e2d3c4-b5a6-7988-9766-5e4d3c2b1a0f');
DELETE FROM public.profiles WHERE id IN ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'f1e2d3c4-b5a6-7988-9766-5e4d3c2b1a0f');
DELETE FROM auth.users WHERE id IN ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'f1e2d3c4-b5a6-7988-9766-5e4d3c2b1a0f');

-- Insert seed super_admin
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, phone
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  'authenticated', 'authenticated',
  '905000000001@aidatom.com',
  crypt('Patron123!', gen_salt('bf', 10)),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Patron Süper Admin","phone":"905000000001","manager_type":"individual"}',
  now(), now(), '905000000001'
);

-- Insert seed system_admin
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, phone
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'f1e2d3c4-b5a6-7988-9766-5e4d3c2b1a0f',
  'authenticated', 'authenticated',
  '905000000002@aidatom.com',
  crypt('Admin123!', gen_salt('bf', 10)),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Sistem Yöneticisi","phone":"905000000002","manager_type":"individual"}',
  now(), now(), '905000000002'
);

-- Insert matching profiles manually to ensure they are synchronized
INSERT INTO public.profiles (
  id, full_name, phone, email, manager_type, role, status, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  'Patron Süper Admin',
  '905000000001',
  '905000000001@aidatom.com',
  'individual',
  'super_admin',
  'approved',
  now(), now()
) ON CONFLICT (id) DO UPDATE SET role = 'super_admin', status = 'approved';

INSERT INTO public.profiles (
  id, full_name, phone, email, manager_type, role, status, created_at, updated_at
) VALUES (
  'f1e2d3c4-b5a6-7988-9766-5e4d3c2b1a0f',
  'Sistem Yöneticisi',
  '905000000002',
  '905000000002@aidatom.com',
  'individual',
  'system_admin',
  'approved',
  now(), now()
) ON CONFLICT (id) DO UPDATE SET role = 'system_admin', status = 'approved';

-- 7. Enhancement columns for legal_cases (attorney_fee, court_expenses, assigned_lawyer_id)
ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS attorney_fee NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS court_expenses NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS assigned_lawyer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 8. Create legal_collections table
CREATE TABLE IF NOT EXISTS public.legal_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_case_id UUID NOT NULL REFERENCES public.legal_cases(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  attorney_fee_portion NUMERIC(12,2) DEFAULT 0.00,
  collection_date TIMESTAMPTZ DEFAULT now(),
  payment_method TEXT DEFAULT 'bank_transfer',
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Create call_logs table
CREATE TABLE IF NOT EXISTS public.call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES public.residents(id) ON DELETE SET NULL,
  contact_request_id UUID REFERENCES public.contact_requests(id) ON DELETE SET NULL,
  called_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  call_status TEXT NOT NULL DEFAULT 'reached',
  notes TEXT NOT NULL,
  call_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

