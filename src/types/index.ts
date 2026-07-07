/* ===================================================
   AIDATOM.COM — TypeScript Type Definitions
   =================================================== */

// ── Enums ──
export type ManagerType = 'individual' | 'company';

export type UserRole = 'super_admin' | 'system_admin' | 'site_manager' | 'lawyer';

export type UserStatus = 'pending_documents' | 'pending_review' | 'approved' | 'rejected' | 'suspended';

export type DocumentType = 'karar_defteri' | 'kimlik' | 'vergi_levhasi' | 'imza_sirkuleri' | 'vekaletname' | 'sozlesme';

export type DocumentStatus = 'uploaded' | 'approved' | 'rejected';

export type DuesType = 'fixed' | 'area_based' | 'share_based';

export type LateFeeType = 'legal_rate' | 'custom_rate';

export type ChargeStatus = 'pending' | 'paid' | 'overdue' | 'partially_paid' | 'sent_to_legal';

export type LegalCaseStatus = 'pending' | 'in_progress' | 'collected' | 'partially_collected' | 'closed';

export type IncomeExpenseType = 'income' | 'expense';

export type NotificationType = 'info' | 'warning' | 'success' | 'error';

export type HandoverStatus = 'pending' | 'approved' | 'rejected';

export type SmsStatus = 'queued' | 'sent' | 'delivered' | 'failed';

// ── Database Models ──
export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  manager_type: ManagerType;
  role: UserRole;
  status: UserStatus;
  company_name: string | null;
  tax_number: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Document {
  id: string;
  user_id: string;
  document_type: DocumentType;
  file_path: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  status: DocumentStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  version: number;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: string;
  manager_id: string;
  name: string;
  address: string;
  city: string;
  district: string;
  total_units: number;
  dues_type: DuesType;
  default_dues_amount: number;
  late_fee_type: LateFeeType;
  late_fee_rate: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Block {
  id: string;
  site_id: string;
  name: string;
  total_floors: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Unit {
  id: string;
  block_id: string;
  unit_number: string;
  floor: number;
  area_sqm: number | null;
  share_ratio: number | null;
  dues_amount: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Resident {
  id: string;
  unit_id: string;
  full_name: string;
  tc_no: string;
  phone: string | null;
  email: string | null;
  is_owner: boolean;
  move_in_date: string | null;
  move_out_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ChargeType {
  id: string;
  site_id: string;
  name: string;
  is_recurring: boolean;
  default_amount: number | null;
  created_at: string;
  updated_at: string;
}

export interface Charge {
  id: string;
  resident_id: string;
  unit_id: string;
  charge_type_id: string;
  period_month: number;
  period_year: number;
  amount: number;
  due_date: string;
  status: ChargeStatus;
  paid_amount: number;
  paid_at: string | null;
  paid_by: string | null;
  late_fee_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentReversal {
  id: string;
  charge_id: string;
  reversed_by: string;
  original_paid_amount: number;
  reason: string;
  created_at: string;
}

export interface LegalCase {
  id: string;
  resident_id: string;
  site_id: string;
  referred_by: string;
  total_debt: number;
  total_late_fee: number;
  status: LegalCaseStatus;
  collected_amount: number;
  notes: string | null;
  referred_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LegalCaseAction {
  id: string;
  legal_case_id: string;
  action_by: string;
  action_type: string;
  description: string;
  created_at: string;
}

export interface IncomeExpense {
  id: string;
  site_id: string;
  type: IncomeExpenseType;
  category: string;
  amount: number;
  description: string;
  transaction_date: string;
  recorded_by: string;
  receipt_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManagerHandover {
  id: string;
  site_id: string;
  from_manager_id: string;
  to_manager_id: string;
  status: HandoverStatus;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SmsTemplate {
  id: string;
  name: string;
  content: string;
  is_system: boolean;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SmsLog {
  id: string;
  template_id: string | null;
  sent_to_phone: string;
  sent_to_resident_id: string | null;
  content: string;
  status: SmsStatus;
  sent_by: string;
  error_message: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export interface ContactRequest {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  message: string;
  is_read: boolean;
  read_by: string | null;
  created_at: string;
}

export interface SystemSettings {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

// ── Form Types ──
export interface RegisterFormData {
  full_name: string;
  phone: string;
  email: string;
  password: string;
  manager_type: ManagerType;
  company_name?: string;
  tax_number?: string;
}

export interface LoginFormData {
  phone: string;
  password: string;
}

// ── Document Upload ──
export interface DocumentUploadItem {
  type: DocumentType;
  label: string;
  description: string;
  required: boolean;
  hasTemplate: boolean;
  templateUrl?: string;
  document?: Document | null;
}

// ── Password Validation ──
export interface PasswordStrength {
  minLength: boolean;
  hasUppercase: boolean;
  hasSpecialChar: boolean;
  isValid: boolean;
}
