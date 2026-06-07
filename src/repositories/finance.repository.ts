import { BaseRepository } from './base.repository';
import { PaymentEntity, FeeEntity, StudentFeeEntity, InvoiceEntity, InvoiceItemEntity } from '@/types/finance.types';

/**
 * Finance Repository
 * Data access layer for financial operations
 * Supports transactional operations for payments and invoices
 */
export class FinanceRepository extends BaseRepository<PaymentEntity> {
  constructor() {
    super('payments');
  }

  // ==================== PAYMENTS ====================

  /**
   * Find payments by student
   */
  async findPaymentsByStudent(studentId: string): Promise<PaymentEntity[]> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('student_id', studentId)
      .is('deleted_at', null)
      .order('payment_date', { ascending: false });
    
    if (error) {
      this.handleError(error, 'findPaymentsByStudent');
      throw error;
    }
    
    return data || [];
  }

  /**
   * Find payments by branch
   */
  async findPaymentsByBranch(branchId: string): Promise<PaymentEntity[]> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .order('payment_date', { ascending: false });
    
    if (error) {
      this.handleError(error, 'findPaymentsByBranch');
      throw error;
    }
    
    return data || [];
  }

  /**
   * Find payments by status
   */
  async findPaymentsByStatus(status: string, branchId?: string): Promise<PaymentEntity[]> {
    let query = this.supabase
      .from('payments')
      .select('*')
      .eq('status', status)
      .is('deleted_at', null);
    
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    
    const { data, error } = await query.order('payment_date', { ascending: false });
    
    if (error) {
      this.handleError(error, 'findPaymentsByStatus');
      throw error;
    }
    
    return data || [];
  }

  /**
   * Get payment statistics by branch
   */
  async getPaymentStatistics(branchId: string, startDate?: string, endDate?: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byMethod: Record<string, number>;
  }> {
    let query = this.supabase
      .from('payments')
      .select('status, payment_method, amount')
      .eq('branch_id', branchId)
      .is('deleted_at', null);
    
    if (startDate) {
      query = query.gte('payment_date', startDate);
    }
    
    if (endDate) {
      query = query.lte('payment_date', endDate);
    }
    
    const { data, error } = await query;
    
    if (error) {
      this.handleError(error, 'getPaymentStatistics');
      throw error;
    }

    const payments = data || [];
    const byStatus: Record<string, number> = {};
    const byMethod: Record<string, number> = {};
    let total = 0;

    payments.forEach(payment => {
      total += payment.amount;
      byStatus[payment.status] = (byStatus[payment.status] || 0) + payment.amount;
      byMethod[payment.payment_method] = (byMethod[payment.payment_method] || 0) + payment.amount;
    });

    return { total, byStatus, byMethod };
  }

  // ==================== FEES ====================

  /**
   * Find fees by branch
   */
  async findFeesByBranch(branchId: string): Promise<FeeEntity[]> {
    const { data, error } = await this.supabase
      .from('fees')
      .select('*')
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .order('name');
    
    if (error) {
      this.handleError(error, 'findFeesByBranch');
      throw error;
    }
    
    return data || [];
  }

  /**
   * Find active fees by branch
   */
  async findActiveFeesByBranch(branchId: string): Promise<FeeEntity[]> {
    const { data, error } = await this.supabase
      .from('fees')
      .select('*')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name');
    
    if (error) {
      this.handleError(error, 'findActiveFeesByBranch');
      throw error;
    }
    
    return data || [];
  }

  /**
   * Create fee
   */
  async createFee(fee: Omit<FeeEntity, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>): Promise<FeeEntity> {
    const { data, error } = await this.supabase
      .from('fees' as any)
      .insert(fee)
      .select()
      .single();
    
    if (error) {
      this.handleError(error, 'createFee');
      throw error;
    }
    
    return data;
  }

  /**
   * Find fee by ID
   */
  async findFeeById(feeId: string): Promise<FeeEntity | null> {
    const { data, error } = await this.supabase
      .from('fees' as any)
      .select('*')
      .eq('id', feeId)
      .maybeSingle();
    
    if (error) {
      this.handleError(error, 'findFeeById');
      throw error;
    }
    
    return data;
  }

  // ==================== STUDENT FEES ====================

  /**
   * Find student fees
   */
  async findStudentFees(studentId: string): Promise<StudentFeeEntity[]> {
    const { data, error } = await this.supabase
      .from('student_fees')
      .select('*')
      .eq('student_id', studentId)
      .is('deleted_at', null)
      .order('due_date', { ascending: true });
    
    if (error) {
      this.handleError(error, 'findStudentFees');
      throw error;
    }
    
    return data || [];
  }

  /**
   * Find student fees by branch
   */
  async findStudentFeesByBranch(branchId: string): Promise<StudentFeeEntity[]> {
    const { data, error } = await this.supabase
      .from('student_fees')
      .select('*')
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .order('due_date', { ascending: true });
    
    if (error) {
      this.handleError(error, 'findStudentFeesByBranch');
      throw error;
    }
    
    return data || [];
  }

  /**
   * Find overdue student fees
   */
  async findOverdueStudentFees(branchId?: string): Promise<StudentFeeEntity[]> {
    const now = new Date().toISOString();
    
    let query = this.supabase
      .from('student_fees')
      .select('*')
      .lt('due_date', now)
      .neq('status', 'paid')
      .is('deleted_at', null);
    
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    
    const { data, error } = await query.order('due_date', { ascending: true });
    
    if (error) {
      this.handleError(error, 'findOverdueStudentFees');
      throw error;
    }
    
    return data || [];
  }

  /**
   * Update student fee paid amount
   */
  async updateStudentFeePaidAmount(studentFeeId: string, paidAmount: number): Promise<void> {
    const { error } = await this.supabase
      .from('student_fees')
      .update({ paid_amount: paidAmount })
      .eq('id', studentFeeId);
    
    if (error) {
      this.handleError(error, 'updateStudentFeePaidAmount');
      throw error;
    }
  }

  /**
   * Update student fee status
   */
  async updateStudentFeeStatus(studentFeeId: string, status: string): Promise<void> {
    const { error } = await this.supabase
      .from('student_fees')
      .update({ status })
      .eq('id', studentFeeId);
    
    if (error) {
      this.handleError(error, 'updateStudentFeeStatus');
      throw error;
    }
  }

  // ==================== INVOICES ====================

  /**
   * Find invoices by student
   */
  async findInvoicesByStudent(studentId: string): Promise<InvoiceEntity[]> {
    const { data, error } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('student_id', studentId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    
    if (error) {
      this.handleError(error, 'findInvoicesByStudent');
      throw error;
    }
    
    return data || [];
  }

  /**
   * Find invoices by branch
   */
  async findInvoicesByBranch(branchId: string): Promise<InvoiceEntity[]> {
    const { data, error } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    
    if (error) {
      this.handleError(error, 'findInvoicesByBranch');
      throw error;
    }
    
    return data || [];
  }

  /**
   * Find invoice by number
   */
  async findInvoiceByNumber(invoiceNumber: string): Promise<InvoiceEntity | null> {
    const { data, error } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('invoice_number', invoiceNumber)
      .maybeSingle();
    
    if (error) {
      this.handleError(error, 'findInvoiceByNumber');
      throw error;
    }
    
    return data;
  }

  /**
   * Find invoice items
   */
  async findInvoiceItems(invoiceId: string): Promise<InvoiceItemEntity[]> {
    const { data, error } = await this.supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId);
    
    if (error) {
      this.handleError(error, 'findInvoiceItems');
      throw error;
    }
    
    return data || [];
  }

  /**
   * Create invoice with items (transactional)
   */
  async createInvoiceWithItems(
    invoice: Omit<InvoiceEntity, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>,
    items: Omit<InvoiceItemEntity, 'id' | 'created_at'>[]
  ): Promise<{ invoice: InvoiceEntity; items: InvoiceItemEntity[] }> {
    try {
      // Start a transaction by using RPC or manual transaction
      // For now, we'll use a sequential approach with rollback logic
      const { data: invoiceData, error: invoiceError } = await this.supabase
        .from('invoices')
        .insert(invoice)
        .select()
        .single();
      
      if (invoiceError) throw invoiceError;
      
      const itemsWithInvoiceId = items.map(item => ({
        ...item,
        invoice_id: invoiceData.id,
      }));
      
      const { data: itemsData, error: itemsError } = await this.supabase
        .from('invoice_items')
        .insert(itemsWithInvoiceId)
        .select();
      
      if (itemsError) {
        // Rollback: delete the invoice
        await this.supabase.from('invoices').delete().eq('id', invoiceData.id);
        throw itemsError;
      }
      
      return {
        invoice: invoiceData,
        items: itemsData || [],
      };
    } catch (error) {
      this.handleError(error, 'createInvoiceWithItems');
      throw error;
    }
  }

  /**
   * Update invoice paid amount
   */
  async updateInvoicePaidAmount(invoiceId: string, paidAmount: number): Promise<void> {
    const { error } = await this.supabase
      .from('invoices')
      .update({ paid_amount: paidAmount })
      .eq('id', invoiceId);
    
    if (error) {
      this.handleError(error, 'updateInvoicePaidAmount');
      throw error;
    }
  }

  /**
   * Update invoice status
   */
  async updateInvoiceStatus(invoiceId: string, status: string): Promise<void> {
    const { error } = await this.supabase
      .from('invoices')
      .update({ status })
      .eq('id', invoiceId);
    
    if (error) {
      this.handleError(error, 'updateInvoiceStatus');
      throw error;
    }
  }

  /**
   * Generate unique invoice number
   */
  async generateInvoiceNumber(branchId: string): Promise<string> {
    const prefix = 'INV';
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    // Count invoices for this month
    const { count } = await this.supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .gte('created_at', `${year}-${month}-01`)
      .lt('created_at', `${year}-${month}-32`);
    
    const sequence = String((count || 0) + 1).padStart(4, '0');
    
    return `${prefix}-${year}${month}-${sequence}`;
  }

  /**
   * Generate unique receipt number
   */
  async generateReceiptNumber(branchId: string): Promise<string> {
    const prefix = 'RCP';
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    // Count payments for this month
    const { count } = await this.supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .gte('payment_date', `${year}-${month}-01`)
      .lt('payment_date', `${year}-${month}-32`);
    
    const sequence = String((count || 0) + 1).padStart(4, '0');
    
    return `${prefix}-${year}${month}-${sequence}`;
  }
}

// Singleton instance
export const financeRepository = new FinanceRepository();
