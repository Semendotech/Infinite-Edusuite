/**
 * Finance domain types
 * Database entities, DTOs, and input/output types for financial operations
 */

/**
 * Payment status enum
 */
export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

/**
 * Payment method enum
 */
export enum PaymentMethod {
  CASH = 'cash',
  BANK_TRANSFER = 'bank_transfer',
  MOBILE_MONEY = 'mobile_money',
  CARD = 'card',
  CHECK = 'check',
}

/**
 * Fee type enum
 */
export enum FeeType {
  TUITION = 'tuition',
  REGISTRATION = 'registration',
  EXAM = 'exam',
  LIBRARY = 'library',
  LAB = 'lab',
  HOSTEL = 'hostel',
  TRANSPORT = 'transport',
  OTHER = 'other',
}

/**
 * Invoice status enum
 */
export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

/**
 * Database entity: payments
 */
export interface PaymentEntity {
  id: string;
  student_id: string;
  branch_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_date: string;
  reference_number?: string;
  description?: string;
  status: string;
  receipt_number?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

/**
 * Database entity: fees
 */
export interface FeeEntity {
  id: string;
  branch_id: string;
  name: string;
  description?: string;
  fee_type: string;
  amount: number;
  currency: string;
  academic_year?: string;
  semester?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

/**
 * Database entity: student_fees
 */
export interface StudentFeeEntity {
  id: string;
  student_id: string;
  fee_id: string;
  branch_id: string;
  amount: number;
  currency: string;
  due_date?: string;
  paid_amount: number;
  status: string;
  academic_year?: string;
  semester?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

/**
 * Database entity: invoices
 */
export interface InvoiceEntity {
  id: string;
  student_id: string;
  branch_id: string;
  invoice_number: string;
  total_amount: number;
  paid_amount: number;
  currency: string;
  due_date?: string;
  status: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

/**
 * Database entity: invoice_items
 */
export interface InvoiceItemEntity {
  id: string;
  invoice_id: string;
  fee_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string;
}

/**
 * Payment DTO
 */
export interface PaymentDTO {
  id: string;
  studentId: string;
  branchId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  referenceNumber?: string;
  description?: string;
  status: PaymentStatus;
  receiptNumber?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  student?: {
    id: string;
    fullName: string;
    registrationNumber: string;
  };
}

/**
 * Fee DTO
 */
export interface FeeDTO {
  id: string;
  branchId: string;
  name: string;
  description?: string;
  feeType: FeeType;
  amount: number;
  currency: string;
  academicYear?: string;
  semester?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Student Fee DTO
 */
export interface StudentFeeDTO {
  id: string;
  studentId: string;
  feeId: string;
  branchId: string;
  amount: number;
  currency: string;
  dueDate?: string;
  paidAmount: number;
  balance: number;
  status: PaymentStatus;
  academicYear?: string;
  semester?: string;
  createdAt: string;
  updatedAt: string;
  fee?: {
    id: string;
    name: string;
    feeType: FeeType;
  };
  student?: {
    id: string;
    fullName: string;
    registrationNumber: string;
  };
}

/**
 * Invoice DTO
 */
export interface InvoiceDTO {
  id: string;
  studentId: string;
  branchId: string;
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  currency: string;
  dueDate?: string;
  status: InvoiceStatus;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items?: InvoiceItemDTO[];
  student?: {
    id: string;
    fullName: string;
    registrationNumber: string;
  };
}

/**
 * Invoice Item DTO
 */
export interface InvoiceItemDTO {
  id: string;
  invoiceId: string;
  feeId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  fee?: {
    id: string;
    name: string;
    feeType: FeeType;
  };
}

/**
 * Create payment input
 */
export interface CreatePaymentInput {
  studentId: string;
  amount: number;
  currency?: string;
  paymentMethod: PaymentMethod;
  paymentDate?: string;
  referenceNumber?: string;
  description?: string;
}

/**
 * Create fee input
 */
export interface CreateFeeInput {
  branchId: string;
  name: string;
  description?: string;
  feeType: FeeType;
  amount: number;
  currency?: string;
  academicYear?: string;
  semester?: string;
  isActive?: boolean;
}

/**
 * Create invoice input
 */
export interface CreateInvoiceInput {
  studentId: string;
  dueDate?: string;
  description?: string;
  items: Array<{
    feeId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
}

/**
 * Payment query filters
 */
export interface PaymentQueryFilters {
  branchId?: string;
  studentId?: string;
  status?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Financial summary
 */
export interface FinancialSummary {
  totalRevenue: number;
  totalPayments: number;
  pendingPayments: number;
  overduePayments: number;
  revenueByMonth: Record<string, number>;
  paymentsByMethod: Record<PaymentMethod, number>;
  paymentsByStatus: Record<PaymentStatus, number>;
}

/**
 * Student financial summary
 */
export interface StudentFinancialSummary {
  totalFees: number;
  totalPaid: number;
  totalBalance: number;
  overdueAmount: number;
  paymentStatus: 'paid' | 'partial' | 'overdue' | 'pending';
  recentPayments: PaymentDTO[];
  pendingFees: StudentFeeDTO[];
}
