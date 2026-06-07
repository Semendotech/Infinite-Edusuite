import { z } from 'zod';
import { PaymentMethod, PaymentStatus, FeeType, InvoiceStatus } from '@/types/finance.types';

/**
 * Finance validation schemas using Zod
 */

/**
 * Create payment input schema
 */
export const createPaymentSchema = z.object({
  studentId: z.string().uuid('Invalid student ID'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('USD'),
  paymentMethod: z.nativeEnum(PaymentMethod, {
    errorMap: () => ({ message: 'Invalid payment method' }),
  }),
  paymentDate: z.string().optional(),
  referenceNumber: z.string().max(100, 'Reference number must not exceed 100 characters').optional(),
  description: z.string().max(500, 'Description must not exceed 500 characters').optional(),
});

/**
 * Create fee input schema
 */
export const createFeeSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID'),
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters'),
  description: z.string().max(500, 'Description must not exceed 500 characters').optional(),
  feeType: z.nativeEnum(FeeType, {
    errorMap: () => ({ message: 'Invalid fee type' }),
  }),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('USD'),
  academicYear: z.string().optional(),
  semester: z.string().optional(),
  isActive: z.boolean().default(true),
});

/**
 * Create invoice input schema
 */
export const createInvoiceSchema = z.object({
  studentId: z.string().uuid('Invalid student ID'),
  dueDate: z.string().optional(),
  description: z.string().max(500, 'Description must not exceed 500 characters').optional(),
  items: z.array(z.object({
    feeId: z.string().uuid('Invalid fee ID').optional(),
    description: z.string().min(1, 'Description is required').max(500),
    quantity: z.number().positive('Quantity must be positive').int(),
    unitPrice: z.number().positive('Unit price must be positive'),
  })).min(1, 'At least one item is required'),
});

/**
 * Update payment status schema
 */
export const updatePaymentStatusSchema = z.object({
  paymentId: z.string().uuid('Invalid payment ID'),
  status: z.nativeEnum(PaymentStatus, {
    errorMap: () => ({ message: 'Invalid payment status' }),
  }),
});

/**
 * Update invoice status schema
 */
export const updateInvoiceStatusSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID'),
  status: z.nativeEnum(InvoiceStatus, {
    errorMap: () => ({ message: 'Invalid invoice status' }),
  }),
});

/**
 * Payment query filters schema
 */
export const paymentQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  status: z.nativeEnum(PaymentStatus).optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().min(2).max(100).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

/**
 * Fee query filters schema
 */
export const feeQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  feeType: z.nativeEnum(FeeType).optional(),
  isActive: z.boolean().optional(),
  academicYear: z.string().optional(),
  semester: z.string().optional(),
  search: z.string().min(2).max(100).optional(),
});

/**
 * Invoice query filters schema
 */
export const invoiceQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  status: z.nativeEnum(InvoiceStatus).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().min(2).max(100).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

/**
 * Type exports
 */
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type CreateFeeInput = z.infer<typeof createFeeSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdatePaymentStatusInput = z.infer<typeof updatePaymentStatusSchema>;
export type UpdateInvoiceStatusInput = z.infer<typeof updateInvoiceStatusSchema>;
export type PaymentQueryFilters = z.infer<typeof paymentQuerySchema>;
export type FeeQueryFilters = z.infer<typeof feeQuerySchema>;
export type InvoiceQueryFilters = z.infer<typeof invoiceQuerySchema>;

/**
 * Validation helper functions
 */

/**
 * Validate create payment input
 */
export function validateCreatePayment(input: unknown): CreatePaymentInput {
  return createPaymentSchema.parse(input);
}

/**
 * Validate create fee input
 */
export function validateCreateFee(input: unknown): CreateFeeInput {
  return createFeeSchema.parse(input);
}

/**
 * Validate create invoice input
 */
export function validateCreateInvoice(input: unknown): CreateInvoiceInput {
  return createInvoiceSchema.parse(input);
}

/**
 * Validate payment query filters
 */
export function validatePaymentQuery(input: unknown): PaymentQueryFilters {
  return paymentQuerySchema.parse(input);
}

/**
 * Validate fee query filters
 */
export function validateFeeQuery(input: unknown): FeeQueryFilters {
  return feeQuerySchema.parse(input);
}

/**
 * Validate invoice query filters
 */
export function validateInvoiceQuery(input: unknown): InvoiceQueryFilters {
  return invoiceQuerySchema.parse(input);
}

/**
 * Safe validation functions (return result object)
 */

/**
 * Safely validate create payment input
 */
export function safeValidateCreatePayment(input: unknown) {
  return createPaymentSchema.safeParse(input);
}

/**
 * Safely validate create fee input
 */
export function safeValidateCreateFee(input: unknown) {
  return createFeeSchema.safeParse(input);
}

/**
 * Safely validate create invoice input
 */
export function safeValidateCreateInvoice(input: unknown) {
  return createInvoiceSchema.safeParse(input);
}
