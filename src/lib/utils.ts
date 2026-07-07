import type { PasswordStrength } from '@/types';

export function validatePassword(password: string): PasswordStrength {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    get isValid() {
      return this.minLength && this.hasUppercase && this.hasSpecialChar;
    },
  };
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('90')) {
    return '+' + cleaned;
  }
  if (cleaned.startsWith('0')) {
    return '+9' + cleaned;
  }
  return '+90' + cleaned;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateString));
}

export function formatDateTime(dateString: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const DOCUMENT_LABELS: Record<string, string> = {
  karar_defteri: 'Karar Defteri Yazısı',
  kimlik: 'Kimlik Fotokopisi',
  vergi_levhasi: 'Vergi Levhası',
  imza_sirkuleri: 'İmza Sirküleri',
  vekaletname: 'Vekaletname',
  sozlesme: 'Sözleşme',
};

export const CHARGE_STATUS_LABELS: Record<string, string> = {
  pending: 'Bekliyor',
  paid: 'Ödendi',
  overdue: 'Gecikmiş',
  partially_paid: 'Kısmi Ödendi',
  sent_to_legal: 'İcraya Verildi',
};

export const USER_STATUS_LABELS: Record<string, string> = {
  pending_documents: 'Belge Bekleniyor',
  pending_review: 'İnceleme Bekleniyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  suspended: 'Askıya Alındı',
};

export const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
