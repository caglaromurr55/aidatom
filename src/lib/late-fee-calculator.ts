import type { Site } from '@/types';

/**
 * Calculates the late fee for an overdue amount.
 * Turkish KMK (Kat Mülkiyeti Kanunu) states late fee is calculated monthly simple interest.
 * @param amount The original charge amount
 * @param dueDateStr Due date of the charge
 * @param paymentDateStr Date of payment (defaults to current date if unpaid)
 * @param site The site details including interest settings
 * @param annualLegalRate The annual legal interest rate from system settings (defaults to 24%)
 */
export function calculateLateFee(
  amount: number,
  dueDateStr: string,
  paymentDateStr: string | null,
  site: Site,
  annualLegalRate: number = 24
): number {
  const dueDate = new Date(dueDateStr);
  const targetDate = paymentDateStr ? new Date(paymentDateStr) : new Date();

  // If not past due, no late fee
  if (targetDate <= dueDate) {
    return 0;
  }

  // Calculate difference in months (with decimal parts for partial months)
  const timeDiff = targetDate.getTime() - dueDate.getTime();
  const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
  const monthsDiff = daysDiff / 30; // Approximation of monthly billing cycle

  // Determine monthly rate
  let monthlyRate = 0.05; // Default 5% per month as standard KMK interest rate
  if (site.late_fee_type === 'legal_rate') {
    // Annual legal rate / 12 months / 100
    monthlyRate = annualLegalRate / 12 / 100;
  } else if (site.late_fee_type === 'custom_rate' && site.late_fee_rate !== null) {
    // Custom monthly rate / 100
    monthlyRate = site.late_fee_rate / 100;
  }

  // Calculate simple interest
  const interest = amount * monthlyRate * monthsDiff;
  return Number(interest.toFixed(2));
}
