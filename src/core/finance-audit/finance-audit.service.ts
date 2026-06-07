/**
 * Immutable Finance Audit Strategy
 * 
 * This service provides immutable audit trails for all financial operations,
 * ensuring complete traceability and regulatory compliance for:
 * - Payment processing
 * - Fee assignments
 * - Invoice generation
 * - Financial adjustments
 * - M-Pesa/payment gateway integrations
 * 
 * Key features:
 * - Immutable audit records (append-only)
 * - Complete before/after state capture
 * - Digital signatures for verification
 * - Regulatory compliance logging
 * - Multi-branch financial isolation
 * - Reconciliation support
 */

import { supabase } from '@/integrations/supabase/client';
import { auditService } from '@/core/audit/audit.service';
import { RequestContext } from '@/core/context/request-context';
import { emit } from '@/core/events/event-system';

/**
 * Financial operation types
 */
export enum FinancialOperationType {
  PAYMENT_RECEIVED = 'payment:received',
  PAYMENT_REFUNDED = 'payment:refunded',
  PAYMENT_FAILED = 'payment:failed',
  FEE_ASSIGNED = 'fee:assigned',
  FEE_UPDATED = 'fee:updated',
  INVOICE_GENERATED = 'invoice:generated',
  INVOICE_PAID = 'invoice:paid',
  INVOICE_CANCELLED = 'invoice:cancelled',
  ADJUSTMENT_CREATED = 'adjustment:created',
  RECONCILIATION_PERFORMED = 'reconciliation:performed',
  MPESA_CALLBACK = 'mpesa:callback',
  MPESA_INITIATED = 'mpesa:initiated',
}

/**
 * Financial audit record
 */
export interface FinancialAuditRecord {
  id: string;
  operationType: FinancialOperationType;
  entityType: string;
  entityId: string;
  branchId: string;
  userId: string;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  amount?: number;
  currency?: string;
  referenceNumber?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  signature?: string;
  createdAt: Date;
  verifiedAt?: Date;
}

/**
 * Financial reconciliation record
 */
export interface FinancialReconciliation {
  id: string;
  branchId: string;
  startDate: Date;
  endDate: Date;
  totalPayments: number;
  totalInvoices: number;
  discrepancy: number;
  status: 'pending' | 'completed' | 'failed';
  reconciledBy: string;
  reconciledAt?: Date;
  notes?: string;
}

/**
 * Finance Audit Service
 */
export class FinanceAuditService {
  private supabase = supabase;

  /**
   * Log a financial operation with immutable audit trail
   */
  async logFinancialOperation(
    operationType: FinancialOperationType,
    entityType: string,
    entityId: string,
    context: RequestContext,
    data: {
      beforeState?: Record<string, any>;
      afterState?: Record<string, any>;
      amount?: number;
      currency?: string;
      referenceNumber?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<FinancialAuditRecord> {
    const auditRecord: FinancialAuditRecord = {
      id: crypto.randomUUID(),
      operationType,
      entityType,
      entityId,
      branchId: context.branchId || '',
      userId: context.userId,
      beforeState: data.beforeState,
      afterState: data.afterState,
      amount: data.amount,
      currency: data.currency || 'USD',
      referenceNumber: data.referenceNumber,
      metadata: data.metadata,
      ipAddress: context.metadata?.ipAddress,
      userAgent: context.metadata?.userAgent,
      createdAt: new Date(),
    };

    // Generate digital signature
    auditRecord.signature = await this.generateSignature(auditRecord);

    // Store immutable audit record
    await this.storeAuditRecord(auditRecord);

    // Log to general audit service
    await auditService.logWithContext(
      context.userId,
      `finance:${operationType}`,
      entityType,
      entityId,
      {
        amount: data.amount,
        currency: data.currency,
        referenceNumber: data.referenceNumber,
        branchId: context.branchId,
      }
    );

    // Emit financial event
    await emit('finance:audit:logged', {
      auditId: auditRecord.id,
      operationType,
      entityType,
      entityId,
      amount: data.amount,
      userId: context.userId,
      branchId: context.branchId,
    });

    return auditRecord;
  }

  /**
   * Store immutable audit record
   */
  private async storeAuditRecord(record: FinancialAuditRecord): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('financial_audit_records' as any)
        .insert({
          id: record.id,
          operation_type: record.operationType,
          entity_type: record.entityType,
          entity_id: record.entityId,
          branch_id: record.branchId,
          user_id: record.userId,
          before_state: record.beforeState,
          after_state: record.afterState,
          amount: record.amount,
          currency: record.currency,
          reference_number: record.referenceNumber,
          metadata: record.metadata,
          ip_address: record.ipAddress,
          user_agent: record.userAgent,
          signature: record.signature,
          created_at: record.createdAt.toISOString(),
        });

      if (error) {
        console.error('Error storing financial audit record:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error storing financial audit record:', error);
      throw error;
    }
  }

  /**
   * Get audit trail for an entity
   */
  async getAuditTrail(
    entityType: string,
    entityId: string,
    context: RequestContext
  ): Promise<FinancialAuditRecord[]> {
    this.ensureBranchAccess(context);

    const { data, error } = await this.supabase
      .from('financial_audit_records' as any)
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((record: any) => ({
      id: record.id,
      operationType: record.operation_type,
      entityType: record.entity_type,
      entityId: record.entity_id,
      branchId: record.branch_id,
      userId: record.user_id,
      beforeState: record.before_state,
      afterState: record.after_state,
      amount: record.amount,
      currency: record.currency,
      referenceNumber: record.reference_number,
      metadata: record.metadata,
      ipAddress: record.ip_address,
      userAgent: record.user_agent,
      signature: record.signature,
      createdAt: new Date(record.created_at),
      verifiedAt: record.verified_at ? new Date(record.verified_at) : undefined,
    }));
  }

  /**
   * Get financial audit records for a branch
   */
  async getBranchFinancialAudits(
    branchId: string,
    startDate?: Date,
    endDate?: Date,
    context?: RequestContext
  ): Promise<FinancialAuditRecord[]> {
    if (context) {
      this.ensureBranchAccess(context);
    }

    let query = this.supabase
      .from('financial_audit_records' as any)
      .select('*')
      .eq('branch_id', branchId);

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(1000);

    if (error) throw error;

    return (data || []).map((record: any) => ({
      id: record.id,
      operationType: record.operation_type,
      entityType: record.entity_type,
      entityId: record.entity_id,
      branchId: record.branch_id,
      userId: record.user_id,
      beforeState: record.before_state,
      afterState: record.after_state,
      amount: record.amount,
      currency: record.currency,
      referenceNumber: record.reference_number,
      metadata: record.metadata,
      ipAddress: record.ip_address,
      userAgent: record.user_agent,
      signature: record.signature,
      createdAt: new Date(record.created_at),
      verifiedAt: record.verified_at ? new Date(record.verified_at) : undefined,
    }));
  }

  /**
   * Verify audit record integrity
   */
  async verifyAuditRecord(auditId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('financial_audit_records' as any)
      .select('*')
      .eq('id', auditId)
      .maybeSingle();

    if (error || !data) return false;

    const record: FinancialAuditRecord = {
      id: data.id,
      operationType: data.operation_type,
      entityType: data.entity_type,
      entityId: data.entity_id,
      branchId: data.branch_id,
      userId: data.user_id,
      beforeState: data.before_state,
      afterState: data.after_state,
      amount: data.amount,
      currency: data.currency,
      referenceNumber: data.reference_number,
      metadata: data.metadata,
      ipAddress: data.ip_address,
      userAgent: data.user_agent,
      signature: data.signature,
      createdAt: new Date(data.created_at),
      verifiedAt: data.verified_at ? new Date(data.verified_at) : undefined,
    };

    const expectedSignature = await this.generateSignature(record);
    const isValid = expectedSignature === record.signature;

    // Update verification status
    if (isValid) {
      await this.supabase
        .from('financial_audit_records' as any)
        .update({ verified_at: new Date().toISOString() })
        .eq('id', auditId);
    }

    return isValid;
  }

  /**
   * Generate digital signature for audit record
   */
  private async generateSignature(record: FinancialAuditRecord): Promise<string> {
    const data = JSON.stringify({
      operationType: record.operationType,
      entityType: record.entityType,
      entityId: record.entityId,
      branchId: record.branchId,
      userId: record.userId,
      beforeState: record.beforeState,
      afterState: record.afterState,
      amount: record.amount,
      currency: record.currency,
      referenceNumber: record.referenceNumber,
      createdAt: record.createdAt.toISOString(),
    });

    // Simple hash-based signature (in production, use proper cryptographic signing)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(36) + ':' + Date.now().toString(36);
  }

  /**
   * Perform financial reconciliation
   */
  async performReconciliation(
    branchId: string,
    startDate: Date,
    endDate: Date,
    context: RequestContext
  ): Promise<FinancialReconciliation> {
    this.ensureBranchAccess(context);

    // Get all financial audit records for the period
    const auditRecords = await this.getBranchFinancialAudits(branchId, startDate, endDate);

    // Calculate totals
    const totalPayments = auditRecords
      .filter(r => r.operationType === FinancialOperationType.PAYMENT_RECEIVED)
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    const totalInvoices = auditRecords
      .filter(r => r.operationType === FinancialOperationType.INVOICE_GENERATED)
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    const discrepancy = totalPayments - totalInvoices;

    const reconciliation: FinancialReconciliation = {
      id: crypto.randomUUID(),
      branchId,
      startDate,
      endDate,
      totalPayments,
      totalInvoices,
      discrepancy,
      status: 'completed',
      reconciledBy: context.userId,
      reconciledAt: new Date(),
    };

    // Store reconciliation record
    await this.storeReconciliation(reconciliation);

    // Log reconciliation
    await auditService.logWithContext(
      context.userId,
      'finance:reconciliation',
      'reconciliation',
      reconciliation.id,
      {
        branchId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalPayments,
        totalInvoices,
        discrepancy,
      }
    );

    return reconciliation;
  }

  /**
   * Store reconciliation record
   */
  private async storeReconciliation(reconciliation: FinancialReconciliation): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('financial_reconciliations' as any)
        .insert({
          id: reconciliation.id,
          branch_id: reconciliation.branchId,
          start_date: reconciliation.startDate.toISOString(),
          end_date: reconciliation.endDate.toISOString(),
          total_payments: reconciliation.totalPayments,
          total_invoices: reconciliation.totalInvoices,
          discrepancy: reconciliation.discrepancy,
          status: reconciliation.status,
          reconciled_by: reconciliation.reconciledBy,
          reconciled_at: reconciliation.reconciledAt?.toISOString(),
          notes: reconciliation.notes,
        });

      if (error) {
        console.error('Error storing reconciliation record:', error);
      }
    } catch (error) {
      console.error('Error storing reconciliation record:', error);
    }
  }

  /**
   * Get reconciliation history
   */
  async getReconciliationHistory(
    branchId: string,
    context?: RequestContext
  ): Promise<FinancialReconciliation[]> {
    if (context) {
      this.ensureBranchAccess(context);
    }

    const { data, error } = await this.supabase
      .from('financial_reconciliations' as any)
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return (data || []).map((record: any) => ({
      id: record.id,
      branchId: record.branch_id,
      startDate: new Date(record.start_date),
      endDate: new Date(record.end_date),
      totalPayments: record.total_payments,
      totalInvoices: record.total_invoices,
      discrepancy: record.discrepancy,
      status: record.status,
      reconciledBy: record.reconciled_by,
      reconciledAt: record.reconciled_at ? new Date(record.reconciled_at) : undefined,
      notes: record.notes,
    }));
  }

  /**
   * Ensure user has branch access
   */
  private ensureBranchAccess(context: RequestContext): void {
    if (!context.isSuperAdmin && !context.branchId) {
      throw new Error('Branch access required');
    }
  }
}

// Singleton instance
export const financeAuditService = new FinanceAuditService();

/**
 * Decorator for automatic financial audit logging
 */
export function FinancialAudit(operationType: FinancialOperationType) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const context = args[args.length - 1] as RequestContext;
      const entityType = target.constructor.name.toLowerCase();
      const entityId = args[0]?.id || args[0];

      // Capture before state
      const beforeState = args[0] ? { ...args[0] } : undefined;

      try {
        const result = await originalMethod.apply(this, args);

        // Capture after state
        const afterState = result ? { ...result } : undefined;

        // Log financial operation
        await financeAuditService.logFinancialOperation(
          operationType,
          entityType,
          entityId,
          context,
          {
            beforeState,
            afterState,
            amount: result?.amount,
            currency: result?.currency,
            referenceNumber: result?.referenceNumber,
          }
        );

        return result;
      } catch (error) {
        // Log failed operation
        await financeAuditService.logFinancialOperation(
          FinancialOperationType.PAYMENT_FAILED,
          entityType,
          entityId,
          context,
          {
            beforeState,
            error: (error as Error).message,
          }
        );

        throw error;
      }
    };

    return descriptor;
  };
}
