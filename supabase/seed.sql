-- ===================================================
-- SEED DATA: Super Admin & System Admin Creation
-- ===================================================

-- Enable pgcrypto extension if not enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Temizleme (Eski hatalı tanımlamaları sil)
DELETE FROM public.profiles WHERE id IN ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'f1e2d3c4-b5a6-7988-9766-5e4d3c2b1a0f');
DELETE FROM auth.users WHERE id IN ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'f1e2d3c4-b5a6-7988-9766-5e4d3c2b1a0f');

-- 1. Süper Admin (Platform Sahibi / Patron)
-- Telefon: +90 500 000 00 01
-- Şifre: Patron123!
-- E-posta: 905000000001@aidatom.com (Workaround email)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  phone
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  'authenticated',
  'authenticated',
  '905000000001@aidatom.com',
  crypt('Patron123!', gen_salt('bf', 10)),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Patron Süper Admin","phone":"905000000001","manager_type":"individual"}',
  now(),
  now(),
  '905000000001'
);

-- Profil rolünü super_admin ve durumunu approved yap
UPDATE public.profiles
SET role = 'super_admin', status = 'approved'
WHERE id = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';


-- 2. Sistem Yöneticisi (Evrak Kontrol & Onay Ekibi)
-- Telefon: +90 500 000 00 02
-- Şifre: Admin123!
-- E-posta: 905000000002@aidatom.com (Workaround email)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  phone
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'f1e2d3c4-b5a6-7988-9766-5e4d3c2b1a0f',
  'authenticated',
  'authenticated',
  '905000000002@aidatom.com',
  crypt('Admin123!', gen_salt('bf', 10)),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Sistem Yöneticisi","phone":"905000000002","manager_type":"individual"}',
  now(),
  now(),
  '905000000002'
);

-- Profil rolünü system_admin ve durumunu approved yap
UPDATE public.profiles
SET role = 'system_admin', status = 'approved'
WHERE id = 'f1e2d3c4-b5a6-7988-9766-5e4d3c2b1a0f';
