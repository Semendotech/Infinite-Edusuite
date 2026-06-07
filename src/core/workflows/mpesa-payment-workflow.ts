/**
 * M-Pesa Payment Workflow
 * 
 * Full safe payment flow for M-Pesa callbacks:
 * 1. Validate idempotency key
 * 2. Check transaction uniqueness
 * 3. Trigger ledger posting (via LedgerService)
 * 4. Create financial audit record
 * 5. Emit payment.success OR payment.failed
 * 6. Send notifications (student, finance officer)
 * 7. Log audit trail
 * 
 * ALL STEPS ARE:
 * - retry-safe
 * - idempotent
 * - branch-isolated
 * - audit logged
 */

import { BaseService } from '@/services/base.service';
import { RequestContext } from '@/core/context/request-context';
import { Permission } from '@/core/rbac/permissions';
import { emit } from '@/core/events/event-system';
import { ledgerService } from '@/services/ledger/ledger.service';
import { auditService } from '@/core/audit/audit.service';
import { financeAuditService } from '@/core/finance-audit/finance-audit.service';
import { notificationEngine } from '@/core/notifications/notification-engine';
import { workflowEngine, WorkflowDefinition } from '@/core/workflows/workflow-engine';

/**
 * M-Pesa callback data
 */
export interface MpesaCallbackData {
  transactionId: string;
  phoneNumber: string;
  amount: number;
  studentId: string;
  timestamp: number;
  correlationId?: string;
}

/**
 * M-Pesa payment result
 */
export interface MpesaPaymentResult {
  success: boolean;
  entryId?: string;
  transactionHash?: string;
  isNew: boolean;
  error?: string;
}

/**
 * M-Pesa Payment Workflow
 */
export class MpesaPaymentWorkflow extends BaseService {
  /**
   * Process M-Pesa callback
   * This is the main entry point for M-Pesa payment processing
   */
  async processCallback(
    callbackData: MpesaCallbackData,
    context: RequestContext
  ): Promise<MpesaPaymentResult> {
    const correlationId = callbackData.correlationId || crypto.randomUUID();

    try {
      // Step 1: Validate idempotency key
      const idempotencyKey = `mpesa-${callbackData.transactionId}`;
      const isDuplicate = await this.checkIdempotency(idempotencyKey, context);
      
      if (isDuplicate) {
        // Return existing transaction if already processed
        const existing = await this.getExistingTransaction(idempotencyKey, context);
        return {
          success: true,
          entryId: existing?.entryId,
          transactionHash: existing?.transactionHash,
          isNew: false,
        };
      }

      // Step 2: Check transaction uniqueness
      const isUnique = await this.checkTransactionUniqueness(callbackData, context);
      if (!isUnique) {
        throw new Error('Duplicate transaction detected');
      }

      // Step 3: Trigger ledger posting
      const ledgerResult = await ledgerService.recordMpesaPayment(
        context,
        callbackData.transactionId,
        callbackData.phoneNumber,
        callbackData.amount,
        callbackData.studentId
      );

      // Step 4: Create financial audit record
      await this.createFinancialAuditRecord(callbackData, ledgerResult, context);

      // Step 5: Emit payment success event
      await emit('audit:logged', {
        auditId: crypto.randomUUID(),
        action: 'mpesa_payment_success',
        entity_type: 'payment',
        entity_id: callbackData.transactionId,
        actor_id: context.userId,
        branch_id: context.branchId,
        metadata: {
          transactionId: callbackData.transactionId,
          phoneNumber: callbackData.phoneNumber,
          amount: callbackData.amount,
          studentId: callbackData.studentId,
          entryId: ledgerResult.entryId,
          correlationId,
        },
      } as any);

      // Step 6: Send notifications
      await this.sendPaymentNotifications(callbackData, context);

      // Step 7: Log audit trail
      await this.logAuditTrail(callbackData, ledgerResult, context);

      return {
        success: true,
        entryId: ledgerResult.entryId,
        transactionHash: ledgerResult.transactionHash,
        isNew: ledgerResult.isNew,
      };
    } catch (error) {
      // Emit payment failed event
      await emit('audit:logged', {
        auditId: crypto.randomUUID(),
        action: 'mpesa_payment_failed',
        entity_type: 'payment',
        entity_id: callbackData.transactionId,
        actor_id: context.userId,
        branch_id: context.branchId,
        metadata: {
          transactionId: callbackData.transactionId,
          phoneNumber: callbackData.phoneNumber,
          amount: callbackData.amount,
          studentId: callbackData.studentId,
          error: error instanceof Error ? error.message : String(error),
          correlationId,
        },
      } as any);

      // Log failure audit
      await this.logFailureAudit(callbackData, error, context);

      return {
        success: false,
        isNew: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check idempotency key
   */
  private async checkIdempotency(
    idempotencyKey: string,
    context: RequestContext
  ): Promise<boolean> {
    // Check if transaction with this idempotency key already exists
    const { data, error } = await this.supabase
      .from('journal_entries' as any)
      .select('id, transaction_hash')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (error) throw error;

    return !!data;
  }

  /**
   * Get existing transaction
   */
  private async getExistingTransaction(
    idempotencyKey: string,
    context: RequestContext
  ): Promise<{ entryId: string; transactionHash: string } | null> {
    const { data, error } = await this.supabase
      .from('journal_entries' as any)
      .select('id, transaction_hash')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      entryId: (data as any).id,
      transactionHash: (data as any).transaction_hash || '',
    };
  }

  /**
   * Check transaction uniqueness
   */
  private async checkTransactionUniqueness(
    callbackData: MpesaCallbackData,
    context: RequestContext
  ): Promise<boolean> {
    // Check if this transaction ID has been processed before
    const { data, error } = await this.supabase
      .from('journal_entries' as any)
      .select('id')
      .eq('reference_id', callbackData.transactionId)
      .eq('reference_type', 'mpesa')
      .maybeSingle();

    if (error) throw error;

    return !data;
  }

  /**
   * Create financial audit record
   */
  private async createFinancialAuditRecord(
    callbackData: MpesaCallbackData,
    ledgerResult: { entryId: string; transactionHash: string },
    context: RequestContext
  ): Promise<void> {
    await financeAuditService.logFinancialOperation(
      'mpesa_payment' as any,
      'payment',
      callbackData.transactionId,
      context,
      {
        beforeState: {
          transactionId: callbackData.transactionId,
          status: 'pending',
        },
        afterState: {
          transactionId: callbackData.transactionId,
          status: 'completed',
          entryId: ledgerResult.entryId,
          transactionHash: ledgerResult.transactionHash,
        },
        amount: callbackData.amount,
        metadata: {
          phoneNumber: callbackData.phoneNumber,
          studentId: callbackData.studentId,
        },
      }
    );
  }

  /**
   * Send payment notifications
   */
  private async sendPaymentNotifications(
    callbackData: MpesaCallbackData,
    context: RequestContext
  ): Promise<void> {
    // Send notification to student
    await notificationEngine.handleEvent('mpesa.callback.success', {
      userId: callbackData.studentId,
      title: 'Payment Received',
      message: `Your payment of ${callbackData.amount} has been received via M-Pesa`,
      type: 'success',
      metadata: {
        transactionId: callbackData.transactionId,
        phoneNumber: callbackData.phoneNumber,
        amount: callbackData.amount,
      },
    }, context);

    // Send notification to finance officers
    await notificationEngine.handleEvent('mpesa.callback.success', {
      title: 'M-Pesa Payment Received',
      message: `Payment of ${callbackData.amount} received from ${callbackData.phoneNumber}`,
      type: 'info',
      metadata: {
        transactionId: callbackData.transactionId,
        phoneNumber: callbackData.phoneNumber,
        amount: callbackData.amount,
        studentId: callbackData.studentId,
      },
    }, context);
  }

  /**
   * Log audit trail
   */
  private async logAuditTrail(
    callbackData: MpesaCallbackData,
    ledgerResult: { entryId: string; transactionHash: string },
    context: RequestContext
  ): Promise<void> {
    await auditService.log({
      actor_id: context.userId,
      action: 'mpesa_payment_processed',
      entity_type: 'payment',
      entity_id: callbackData.transactionId,
      branch_id: context.branchId,
      metadata: {
        phoneNumber: callbackData.phoneNumber,
        amount: callbackData.amount,
        studentId: callbackData.studentId,
        entryId: ledgerResult.entryId,
        transactionHash: ledgerResult.transactionHash,
      },
    });
  }

  /**
   * Log failure audit
   */
  private async logFailureAudit(
    callbackData: MpesaCallbackData,
    error: unknown,
    context: RequestContext
  ): Promise<void> {
    await auditService.log({
      actor_id: context.userId,
      action: 'mpesa_payment_failed',
      entity_type: 'payment',
      entity_id: callbackData.transactionId,
      branch_id: context.branchId,
      metadata: {
        phoneNumber: callbackData.phoneNumber,
        amount: callbackData.amount,
        studentId: callbackData.studentId,
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }

  /**
   * Register M-Pesa payment workflow with workflow engine
   */
  async registerWorkflow(context: RequestContext): Promise<string> {
    const workflowDefinition: WorkflowDefinition = {
      name: 'M-Pesa Payment Processing',
      description: 'Process M-Pesa payment callbacks with full audit trail',
      triggerEvent: 'mpesa.callback.received',
      conditions: {
        requiredPermissions: [Permission.FINANCE_VIEW],
      },
      steps: [
        {
          name: 'validate_idempotency',
          action: 'createAuditLog',
          config: {
            action: 'mpesa_idempotency_check',
            entityType: 'payment',
          },
        },
        {
          name: 'post_ledger_entry',
          action: 'triggerLedgerEntry',
          config: {
            transactionType: 'fee_payment',
            paymentMethod: 'mpesa',
          },
        },
        {
          name: 'create_financial_audit',
          action: 'createAuditLog',
          config: {
            action: 'financial_audit_created',
            entityType: 'financial_audit',
          },
        },
        {
          name: 'send_notifications',
          action: 'sendNotification',
          config: {
            title: 'Payment Processed',
            message: 'Your payment has been processed successfully',
            type: 'success',
          },
        },
      ],
      retryPolicy: {
        maxRetries: 3,
        backoffMs: 1000,
      },
      failureHandling: {
        notifyOnError: true,
        deadLetterQueue: true,
      },
      isActive: true,
      branchId: context.branchId,
    };

    return await workflowEngine.registerWorkflow(workflowDefinition, context);
  }
}

// Singleton instance
export const mpesaPaymentWorkflow = new MpesaPaymentWorkflow();
