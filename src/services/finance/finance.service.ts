import { BaseService, ServiceOptions } from '../base.service';
import { financeRepository } from '@/repositories/finance.repository';
import { 
  PaymentDTO, 
  PaymentEntity, 
  FeeDTO, 
  FeeEntity, 
  StudentFeeDTO, 
  StudentFeeEntity,
  InvoiceDTO,
  InvoiceEntity,
  InvoiceItemDTO,
  InvoiceItemEntity,
  CreatePaymentInput,
  CreateFeeInput,
  CreateInvoiceInput,
  PaymentQueryFilters,
  FinancialSummary,
  StudentFinancialSummary,
  PaymentStatus,
  PaymentMethod,
  FeeType,
  InvoiceStatus
} from '@/types/finance.types';
import { Permission, Role } from '@/core/rbac/permissions';
import { RequestContext } from '@/core/context/request-context';
import { emit } from '@/core/events/event-system';
import { 
  validateCreatePayment, 
  validateCreateFee, 
  validateCreateInvoice,
  validatePaymentQuery,
  validateFeeQuery,
  validateInvoiceQuery
} from '@/validators/finance.validators';
import { NotFoundError, ForbiddenError, ValidationError, ConflictError } from '@/lib/error-handler';

/**
 * Finance Service
 * Complete service layer for financial operations with transactional support
 * Demonstrates:
 * - Transactional operations (payments, invoices)
 * - RBAC integration
 * - Branch isolation
 * - Audit logging
 * - Event emission
 * - DTO transformation
 */
export class FinanceService extends BaseService {
  private repository = financeRepository;

  /**
   * Transform payment entity to DTO
   */
  private paymentToDTO(entity: PaymentEntity): PaymentDTO {
    return {
      id: entity.id,
      studentId: entity.student_id,
      branchId: entity.branch_id,
      amount: entity.amount,
      currency: entity.currency,
      paymentMethod: entity.payment_method as PaymentMethod,
      paymentDate: entity.payment_date,
      referenceNumber: entity.reference_number,
      description: entity.description,
      status: entity.status as PaymentStatus,
      receiptNumber: entity.receipt_number,
      createdBy: entity.created_by,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
    };
  }

  /**
   * Transform fee entity to DTO
   */
  private feeToDTO(entity: FeeEntity): FeeDTO {
    return {
      id: entity.id,
      branchId: entity.branch_id,
      name: entity.name,
      description: entity.description,
      feeType: entity.fee_type as FeeType,
      amount: entity.amount,
      currency: entity.currency,
      academicYear: entity.academic_year,
      semester: entity.semester,
      isActive: entity.is_active,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
    };
  }

  /**
   * Transform student fee entity to DTO
   */
  private studentFeeToDTO(entity: StudentFeeEntity): StudentFeeDTO {
    return {
      id: entity.id,
      studentId: entity.student_id,
      feeId: entity.fee_id,
      branchId: entity.branch_id,
      amount: entity.amount,
      currency: entity.currency,
      dueDate: entity.due_date,
      paidAmount: entity.paid_amount,
      balance: entity.amount - entity.paid_amount,
      status: entity.status as PaymentStatus,
      academicYear: entity.academic_year,
      semester: entity.semester,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
    };
  }

  /**
   * Transform invoice entity to DTO
   */
  private invoiceToDTO(entity: InvoiceEntity, items?: InvoiceItemEntity[]): InvoiceDTO {
    return {
      id: entity.id,
      studentId: entity.student_id,
      branchId: entity.branch_id,
      invoiceNumber: entity.invoice_number,
      totalAmount: entity.total_amount,
      paidAmount: entity.paid_amount,
      balance: entity.total_amount - entity.paid_amount,
      currency: entity.currency,
      dueDate: entity.due_date,
      status: entity.status as InvoiceStatus,
      description: entity.description,
      createdBy: entity.created_by,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
      items: items?.map(item => this.invoiceItemToDTO(item)),
    };
  }

  /**
   * Transform invoice item entity to DTO
   */
  private invoiceItemToDTO(entity: InvoiceItemEntity): InvoiceItemDTO {
    return {
      id: entity.id,
      invoiceId: entity.invoice_id,
      feeId: entity.fee_id,
      description: entity.description,
      quantity: entity.quantity,
      unitPrice: entity.unit_price,
      total: entity.total,
    };
  }

  // ==================== PAYMENTS ====================

  /**
   * Create payment (transactional operation)
   */
  async createPayment(input: CreatePaymentInput, context: RequestContext): Promise<PaymentDTO> {
    this.requirePermission(context, Permission.FINANCE_CREATE);

    const validatedInput = validateCreatePayment(input);

    if (!this.validateBranchAccess(context, validatedInput.studentId)) {
      throw new ForbiddenError('You do not have access to this student');
    }

    // Generate receipt number
    const receiptNumber = await this.repository.generateReceiptNumber(context.branchId || '');

    const paymentData = {
      student_id: validatedInput.studentId,
      branch_id: context.branchId || '',
      amount: validatedInput.amount,
      currency: validatedInput.currency || 'USD',
      payment_method: validatedInput.paymentMethod,
      payment_date: validatedInput.paymentDate || new Date().toISOString(),
      reference_number: validatedInput.referenceNumber,
      description: validatedInput.description,
      status: PaymentStatus.COMPLETED,
      receipt_number: receiptNumber,
      created_by: context.userId,
    };

    const result = await this.execute(
      async () => {
        return this.repository.create(paymentData as any);
      },
      { context }
    );

    // Update student fee paid amounts if applicable
    await this.updateStudentFeesAfterPayment(validatedInput.studentId, validatedInput.amount, context);

    await emit('payment:received', {
      paymentId: result.id,
      studentId: validatedInput.studentId,
      amount: validatedInput.amount,
      userId: context.userId,
    });

    return this.paymentToDTO(result);
  }

  /**
   * Update student fees after payment
   */
  private async updateStudentFeesAfterPayment(
    studentId: string,
    amount: number,
    context: RequestContext
  ): Promise<void> {
    const studentFees = await this.repository.findStudentFees(studentId);
    const pendingFees = studentFees.filter(f => f.status !== 'paid' && f.paid_amount < f.amount);

    let remainingAmount = amount;

    for (const fee of pendingFees) {
      if (remainingAmount <= 0) break;

      const balance = fee.amount - fee.paid_amount;
      const paymentAmount = Math.min(remainingAmount, balance);

      const newPaidAmount = fee.paid_amount + paymentAmount;
      await this.repository.updateStudentFeePaidAmount(fee.id, newPaidAmount);

      const newStatus = newPaidAmount >= fee.amount ? 'paid' : 'partially_paid';
      await this.repository.updateStudentFeeStatus(fee.id, newStatus);

      remainingAmount -= paymentAmount;
    }
  }

  /**
   * Get payment by ID
   */
  async getPayment(paymentId: string, context: RequestContext): Promise<PaymentDTO> {
    this.requirePermission(context, Permission.FINANCE_VIEW);

    const entity = await this.repository.findById(paymentId);
    if (!entity) {
      throw new NotFoundError('Payment');
    }

    if (!this.validateBranchAccess(context, entity.branch_id)) {
      throw new ForbiddenError('You do not have access to this payment');
    }

    return this.paymentToDTO(entity);
  }

  /**
   * Query payments with filters
   */
  async queryPayments(filters: PaymentQueryFilters, context: RequestContext): Promise<{
    data: PaymentDTO[];
    total: number;
  }> {
    this.requirePermission(context, Permission.FINANCE_VIEW);

    const validatedFilters = validatePaymentQuery(filters);

    if (!context.isSuperAdmin && !validatedFilters.branchId) {
      validatedFilters.branchId = context.branchId;
    }

    if (validatedFilters.branchId && !this.validateBranchAccess(context, validatedFilters.branchId)) {
      throw new ForbiddenError('You do not have access to this branch');
    }

    const entities = await this.repository.findPaymentsByBranch(validatedFilters.branchId || context.branchId || '');

    return {
      data: entities.map(e => this.paymentToDTO(e)),
      total: entities.length,
    };
  }

  /**
   * Get payment statistics
   */
  async getPaymentStatistics(context: RequestContext, startDate?: string, endDate?: string): Promise<FinancialSummary> {
    this.requirePermission(context, Permission.FINANCE_VIEW);

    const branchId = context.isSuperAdmin ? undefined : context.branchId;

    if (!branchId) {
      throw new Error('Branch ID is required for statistics');
    }

    const stats = await this.repository.getPaymentStatistics(branchId, startDate, endDate);

    return {
      totalRevenue: stats.total,
      totalPayments: stats.byStatus['completed'] || 0,
      pendingPayments: stats.byStatus['pending'] || 0,
      overduePayments: 0, // Calculate from student fees
      revenueByMonth: {}, // Implement monthly breakdown
      paymentsByMethod: stats.byMethod as Record<PaymentMethod, number>,
      paymentsByStatus: stats.byStatus as Record<PaymentStatus, number>,
    };
  }

  // ==================== FEES ====================

  /**
   * Create fee
   */
  async createFee(input: CreateFeeInput, context: RequestContext): Promise<FeeDTO> {
    this.requirePermission(context, Permission.FINANCE_MANAGE);

    const validatedInput = validateCreateFee(input);

    if (!this.validateBranchAccess(context, validatedInput.branchId)) {
      throw new ForbiddenError('You do not have access to this branch');
    }

    const feeData = {
      branch_id: validatedInput.branchId,
      name: validatedInput.name,
      description: validatedInput.description,
      fee_type: validatedInput.feeType,
      amount: validatedInput.amount,
      currency: validatedInput.currency || 'USD',
      academic_year: validatedInput.academicYear,
      semester: validatedInput.semester,
      is_active: validatedInput.isActive ?? true,
    };

    const result = await this.execute(
      async () => {
        return this.repository.createFee(feeData as any);
      },
      { context }
    );

    return this.feeToDTO(result);
  }

  /**
   * Get fee by ID
   */
  async getFee(feeId: string, context: RequestContext): Promise<FeeDTO> {
    this.requirePermission(context, Permission.FINANCE_VIEW);

    const entity = await this.repository.findFeeById(feeId);
    if (!entity) {
      throw new NotFoundError('Fee');
    }

    if (!this.validateBranchAccess(context, entity.branch_id)) {
      throw new ForbiddenError('You do not have access to this fee');
    }

    return this.feeToDTO(entity);
  }

  /**
   * Query fees
   */
  async queryFees(filters: any, context: RequestContext): Promise<{ data: FeeDTO[]; total: number }> {
    this.requirePermission(context, Permission.FINANCE_VIEW);

    const validatedFilters = validateFeeQuery(filters);

    if (!context.isSuperAdmin && !validatedFilters.branchId) {
      validatedFilters.branchId = context.branchId;
    }

    const entities = await this.repository.findFeesByBranch(validatedFilters.branchId || context.branchId || '');

    return {
      data: entities.map(e => this.feeToDTO(e)),
      total: entities.length,
    };
  }

  // ==================== INVOICES ====================

  /**
   * Create invoice with items (transactional)
   */
  async createInvoice(input: CreateInvoiceInput, context: RequestContext): Promise<InvoiceDTO> {
    this.requirePermission(context, Permission.FINANCE_MANAGE);

    const validatedInput = validateCreateInvoice(input);

    if (!this.validateBranchAccess(context, validatedInput.studentId)) {
      throw new ForbiddenError('You do not have access to this student');
    }

    const invoiceNumber = await this.repository.generateInvoiceNumber(context.branchId || '');
    const totalAmount = validatedInput.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    const invoiceData = {
      student_id: validatedInput.studentId,
      branch_id: context.branchId || '',
      invoice_number: invoiceNumber,
      total_amount: totalAmount,
      paid_amount: 0,
      currency: 'USD',
      due_date: validatedInput.dueDate,
      status: InvoiceStatus.SENT,
      description: validatedInput.description,
      created_by: context.userId,
    };

    const itemsData = validatedInput.items.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: item.quantity * item.unitPrice,
    }));

    const result = await this.execute(
      async () => {
        return this.repository.createInvoiceWithItems(invoiceData as any, itemsData as any);
      },
      { context }
    );

    return this.invoiceToDTO(result.invoice, result.items);
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId: string, context: RequestContext): Promise<InvoiceDTO> {
    this.requirePermission(context, Permission.FINANCE_VIEW);

    const entity = await this.repository.findInvoiceByNumber(invoiceId);
    if (!entity) {
      throw new NotFoundError('Invoice');
    }

    if (!this.validateBranchAccess(context, entity.branch_id)) {
      throw new ForbiddenError('You do not have access to this invoice');
    }

    const items = await this.repository.findInvoiceItems(invoiceId);
    return this.invoiceToDTO(entity, items);
  }

  /**
   * Query invoices
   */
  async queryInvoices(filters: any, context: RequestContext): Promise<{ data: InvoiceDTO[]; total: number }> {
    this.requirePermission(context, Permission.FINANCE_VIEW);

    const validatedFilters = validateInvoiceQuery(filters);

    if (!context.isSuperAdmin && !validatedFilters.branchId) {
      validatedFilters.branchId = context.branchId;
    }

    const entities = await this.repository.findInvoicesByBranch(validatedFilters.branchId || context.branchId || '');

    return {
      data: entities.map(e => this.invoiceToDTO(e)),
      total: entities.length,
    };
  }

  /**
   * Get student financial summary
   */
  async getStudentFinancialSummary(studentId: string, context: RequestContext): Promise<StudentFinancialSummary> {
    this.requirePermission(context, Permission.FINANCE_VIEW);

    if (!this.validateBranchAccess(context, studentId)) {
      throw new ForbiddenError('You do not have access to this student');
    }

    const studentFees = await this.repository.findStudentFees(studentId);
    const payments = await this.repository.findPaymentsByStudent(studentId);

    const totalFees = studentFees.reduce((sum, f) => sum + f.amount, 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalBalance = totalFees - totalPaid;

    const overdueFees = studentFees.filter(f => {
      if (!f.due_date) return false;
      return new Date(f.due_date) < new Date() && f.status !== 'paid';
    });
    const overdueAmount = overdueFees.reduce((sum, f) => sum + (f.amount - f.paid_amount), 0);

    let paymentStatus: 'paid' | 'partial' | 'overdue' | 'pending' = 'pending';
    if (totalBalance <= 0) paymentStatus = 'paid';
    else if (overdueAmount > 0) paymentStatus = 'overdue';
    else if (totalPaid > 0) paymentStatus = 'partial';

    return {
      totalFees,
      totalPaid,
      totalBalance,
      overdueAmount,
      paymentStatus,
      recentPayments: payments.slice(0, 5).map(p => this.paymentToDTO(p)),
      pendingFees: studentFees.filter(f => f.status !== 'paid').map(f => this.studentFeeToDTO(f)),
    };
  }
}

// Singleton instance
export const financeService = new FinanceService();
