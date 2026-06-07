/**
 * Ledger Service
 * 
 * Business logic layer for the double-entry accounting ledger.
 * Handles all financial transactions with proper validation, audit logging, and event emission.
 * 
 * This service:
 * - Enforces double-entry accounting rules
 * - Validates balanced entries
 * - Supports idempotency for M-Pesa webhooks
 * - Emits audit events
 * - Integrates with RBAC and branch isolation
 */

import { BaseService } from '@/services/base.service';
import { RequestContext } from '@/core/context/request-context';
import { Permission } from '@/core/rbac/permissions';
import { ledgerRepository, AccountType, JournalEntryStatus } from '@/repositories/ledger.repository';
import { emit } from '@/core/events/event-system';
import { financeAuditService } from '@/core/finance-audit/finance-audit.service';
import { idempotencyService } from '@/core/idempotency/idempotency.service';
import { auditService } from '@/core/audit/audit.service';

/**
 * Journal line input
 */
export interface JournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
  metadata?: Record<string, any>;
}

/**
 * Journal entry input
 */
export interface JournalEntryInput {
  description: string;
  referenceId?: string;
  referenceType?: string;
  lines: JournalLineInput[];
  idempotencyKey?: string;
}

/**
 * Ledger Service
 */
export class LedgerService extends BaseService {
  private repository = ledgerRepository;

  /**
   * Create journal entry with double-entry validation
   */
  async createJournalEntry(
    input: JournalEntryInput,
    context: RequestContext
  ): Promise<{ entryId: string; transactionHash: string }> {
    // Check permissions
    this.requirePermission(context, Permission.FINANCE_VIEW);

    // Validate branch context
    if (!context.branchId) {
      throw new Error('Branch context is required for ledger operations');
    }

    // Validate balanced entry
    this.validateBalancedEntry(input.lines);

    // Check idempotency
    if (input.idempotencyKey) {
      const existing = await this.repository.getJournalEntryByIdempotencyKey(input.idempotencyKey, context);
      if (existing) {
        return {
          entryId: existing.id,
          transactionHash: existing.transactionHash || '',
        };
      }
    }

    // Create journal entry
    const { entry, lines } = await this.repository.createJournalEntry(
      {
        branchId: context.branchId,
        description: input.description,
        referenceId: input.referenceId,
        referenceType: input.referenceType,
        status: JournalEntryStatus.POSTED,
        postedAt: new Date(),
        createdBy: context.userId,
        idempotencyKey: input.idempotencyKey,
      },
      input.lines.map((line, index) => ({
        ...line,
        lineNumber: index + 1,
      })),
      context
    );

    // Emit audit event
    await emit('finance:audit:logged', {
      auditId: crypto.randomUUID(),
      operationType: 'journal_entry_created',
      entityType: 'journal_entry',
      entityId: entry.id,
      amount: this.calculateTotalAmount(input.lines),
      userId: context.userId,
      branchId: context.branchId,
    } as any);

    // Emit domain event
    await emit('audit:logged', {
      auditId: crypto.randomUUID(),
      action: 'journal_entry_created',
      entityType: 'journal_entry',
      entityId: entry.id,
      actorId: context.userId,
      branchId: context.branchId,
    } as any);

    return {
      entryId: entry.id,
      transactionHash: entry.transactionHash || '',
    };
  }

  /**
   * Validate that journal entry is balanced (debits = credits)
   */
  private validateBalancedEntry(lines: JournalLineInput[]): void {
    const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(
        `Journal entry must balance. Debits: ${totalDebit}, Credits: ${totalCredit}`
      );
    }

    if (totalDebit === 0 && totalCredit === 0) {
      throw new Error('Journal entry cannot have zero debits and credits');
    }
  }

  /**
   * Calculate total amount from journal lines
   */
  private calculateTotalAmount(lines: JournalLineInput[]): number {
    return lines.reduce((sum, line) => sum + line.debit + line.credit, 0);
  }

  /**
   * Get account balance
   */
  async getAccountBalance(
    accountId: string,
    context: RequestContext
  ): Promise<number> {
    this.requirePermission(context, Permission.FINANCE_VIEW);

    return await this.repository.getAccountBalance(accountId, context);
  }

  /**
   * Get trial balance
   */
  async getTrialBalance(
    context: RequestContext,
    asOfDate?: Date
  ): Promise<any> {
    this.requirePermission(context, Permission.FINANCE_VIEW);

    return await this.repository.getTrialBalance(context, asOfDate);
  }

  /**
   * Get branch ledger
   */
  async getBranchLedger(
    context: RequestContext,
    options?: {
      accountId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<any> {
    this.requirePermission(context, Permission.FINANCE_VIEW);

    return await this.repository.getBranchLedger(context, options);
  }

  /**
   * Post double-entry transaction
   * This is the main method for creating balanced financial transactions
   */
  async postDoubleEntryTransaction(
    context: RequestContext,
    description: string,
    debitLines: JournalLineInput[],
    creditLines: JournalLineInput[],
    options?: {
      referenceId?: string;
      referenceType?: string;
      idempotencyKey?: string;
    }
  ): Promise<{ entryId: string; transactionHash: string }> {
    // Combine debit and credit lines
    const allLines = [...debitLines, ...creditLines];

    return await this.createJournalEntry(
      {
        description,
        lines: allLines,
        ...options,
      },
      context
    );
  }

  /**
   * Create reversal entry for correcting errors
   * This creates an opposite entry to reverse a previous transaction
   */
  async createReversalEntry(
    context: RequestContext,
    originalEntryId: string,
    reason: string
  ): Promise<{ entryId: string; transactionHash: string }> {
    this.requirePermission(context, Permission.FINANCE_VIEW);

    // Get original entry
    const originalEntry = await this.repository.getJournalEntryById(originalEntryId, context);
    if (!originalEntry) {
      throw new Error('Original journal entry not found');
    }

    // Get original lines
    const originalLines = await this.repository.getJournalLinesByEntryId(originalEntryId, context);

    // Create reversal lines (swap debits and credits)
    const reversalLines: JournalLineInput[] = originalLines.map(line => ({
      accountId: line.accountId,
      debit: line.credit,
      credit: line.debit,
      description: `Reversal: ${line.description}`,
      metadata: {
        ...line.metadata,
        reversalOf: line.id,
        originalEntryId,
      },
    }));

    // Create reversal entry
    return await this.createJournalEntry(
      {
        description: `Reversal of entry ${originalEntryId}: ${reason}`,
        referenceId: originalEntryId,
        referenceType: 'reversal',
        lines: reversalLines,
        idempotencyKey: `reversal-${originalEntryId}`,
      },
      context
    );
  }

  /**
   * Fee Payment Transaction Flow
   * Debit: Cash/Bank
   * Credit: Student Receivable
   */
  async recordFeePayment(
    context: RequestContext,
    studentId: string,
    amount: number,
    paymentMethod: 'cash' | 'bank' | 'mpesa',
    options?: {
      referenceId?: string;
      idempotencyKey?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{ entryId: string; transactionHash: string }> {
    // Get accounts
    const cashAccount = await this.getCashAccount(paymentMethod, context);
    const receivableAccount = await this.getStudentReceivableAccount(studentId, context);

    // Create journal entry
    return await this.postDoubleEntryTransaction(
      context,
      `Fee payment - Student ${studentId} - ${paymentMethod}`,
      [
        {
          accountId: cashAccount.id,
          debit: amount,
          credit: 0,
          description: 'Cash received',
          metadata: options?.metadata,
        },
      ],
      [
        {
          accountId: receivableAccount.id,
          debit: 0,
          credit: amount,
          description: 'Student receivable cleared',
          metadata: {
            studentId,
            paymentMethod,
            ...options?.metadata,
          },
        },
      ],
      {
        referenceId: options?.referenceId,
        referenceType: 'payment',
        idempotencyKey: options?.idempotencyKey,
      }
    );
  }

  /**
   * Invoice Generation Transaction Flow
   * Debit: Receivable
   * Credit: Income
   */
  async recordInvoiceGeneration(
    context: RequestContext,
    studentId: string,
    invoiceId: string,
    amount: number,
    description: string
  ): Promise<{ entryId: string; transactionHash: string }> {
    // Get accounts
    const receivableAccount = await this.getStudentReceivableAccount(studentId, context);
    const incomeAccount = await this.getIncomeAccount('tuition', context);

    // Create journal entry
    return await this.postDoubleEntryTransaction(
      context,
      description,
      [
        {
          accountId: receivableAccount.id,
          debit: amount,
          credit: 0,
          description: 'Student receivable',
          metadata: {
            studentId,
            invoiceId,
          },
        },
      ],
      [
        {
          accountId: incomeAccount.id,
          debit: 0,
          credit: amount,
          description: 'Tuition income',
          metadata: {
            studentId,
            invoiceId,
          },
        },
      ],
      {
        referenceId: invoiceId,
        referenceType: 'invoice',
      }
    );
  }

  /**
   * Expense Recording Transaction Flow
   * Debit: Expense
   * Credit: Cash/Bank
   */
  async recordExpense(
    context: RequestContext,
    expenseType: string,
    amount: number,
    paymentMethod: 'cash' | 'bank',
    description: string,
    options?: {
      referenceId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{ entryId: string; transactionHash: string }> {
    // Get accounts
    const expenseAccount = await this.getExpenseAccount(expenseType, context);
    const cashAccount = await this.getCashAccount(paymentMethod, context);

    // Create journal entry
    return await this.postDoubleEntryTransaction(
      context,
      description,
      [
        {
          accountId: expenseAccount.id,
          debit: amount,
          credit: 0,
          description: expenseType,
          metadata: options?.metadata,
        },
      ],
      [
        {
          accountId: cashAccount.id,
          debit: 0,
          credit: amount,
          description: 'Cash paid',
          metadata: {
            paymentMethod,
            ...options?.metadata,
          },
        },
      ],
      {
        referenceId: options?.referenceId,
        referenceType: 'expense',
      }
    );
  }

  /**
   * M-Pesa Webhook-Safe Posting Flow
   * Designed for idempotent callback handling
   */
  async recordMpesaPayment(
    context: RequestContext,
    mpesaTransactionId: string,
    phoneNumber: string,
    amount: number,
    studentId: string
  ): Promise<{ entryId: string; transactionHash: string; isNew: boolean }> {
    // Use M-Pesa transaction ID as idempotency key
    const idempotencyKey = `mpesa-${mpesaTransactionId}`;

    // Check if already processed
    const existing = await this.repository.getJournalEntryByIdempotencyKey(idempotencyKey, context);
    if (existing) {
      return {
        entryId: existing.id,
        transactionHash: existing.transactionHash || '',
        isNew: false,
      };
    }

    // Record the payment
    const result = await this.recordFeePayment(
      context,
      studentId,
      amount,
      'mpesa',
      {
        referenceId: mpesaTransactionId,
        idempotencyKey,
        metadata: {
          phoneNumber,
          mpesaTransactionId,
        },
      }
    );

    return {
      ...result,
      isNew: true,
    };
  }

  /**
   * Helper: Get cash/bank account
   */
  private async getCashAccount(
    paymentMethod: 'cash' | 'bank' | 'mpesa',
    context: RequestContext
  ): Promise<{ id: string; name: string }> {
    const accounts = await this.repository.getAccountsByType(AccountType.ASSET, context);
    
    const account = accounts.find(acc => 
      acc.name.toLowerCase().includes(paymentMethod) || 
      acc.code.toLowerCase().includes(paymentMethod)
    );

    if (!account) {
      throw new Error(`Cash account for ${paymentMethod} not found`);
    }

    return { id: account.id, name: account.name };
  }

  /**
   * Helper: Get student receivable account
   */
  private async getStudentReceivableAccount(
    studentId: string,
    context: RequestContext
  ): Promise<{ id: string; name: string }> {
    const accounts = await this.repository.getAccountsByType(AccountType.ASSET, context);
    
    const account = accounts.find(acc => 
      acc.name.toLowerCase().includes('receivable') || 
      acc.code.toLowerCase().includes('receivable')
    );

    if (!account) {
      throw new Error('Student receivable account not found');
    }

    return { id: account.id, name: account.name };
  }

  /**
   * Helper: Get income account
   */
  private async getIncomeAccount(
    incomeType: string,
    context: RequestContext
  ): Promise<{ id: string; name: string }> {
    const accounts = await this.repository.getAccountsByType(AccountType.INCOME, context);
    
    const account = accounts.find(acc => 
      acc.name.toLowerCase().includes(incomeType) || 
      acc.code.toLowerCase().includes(incomeType)
    );

    if (!account) {
      throw new Error(`Income account for ${incomeType} not found`);
    }

    return { id: account.id, name: account.name };
  }

  /**
   * Helper: Get expense account
   */
  private async getExpenseAccount(
    expenseType: string,
    context: RequestContext
  ): Promise<{ id: string; name: string }> {
    const accounts = await this.repository.getAccountsByType(AccountType.EXPENSE, context);
    
    const account = accounts.find(acc => 
      acc.name.toLowerCase().includes(expenseType) || 
      acc.code.toLowerCase().includes(expenseType)
    );

    if (!account) {
      throw new Error(`Expense account for ${expenseType} not found`);
    }

    return { id: account.id, name: account.name };
  }

  /**
   * Initialize default chart of accounts for a branch
   */
  async initializeChartOfAccounts(context: RequestContext): Promise<void> {
    this.requirePermission(context, Permission.FINANCE_VIEW);

    // Validate branch context
    if (!context.branchId) {
      throw new Error('Branch context is required for chart of accounts initialization');
    }

    const defaultAccounts = [
      // Assets
      { name: 'Cash', type: AccountType.ASSET, code: '1000' },
      { name: 'Bank', type: AccountType.ASSET, code: '1010' },
      { name: 'M-Pesa', type: AccountType.ASSET, code: '1020' },
      { name: 'Accounts Receivable', type: AccountType.ASSET, code: '1100' },
      { name: 'Student Receivable', type: AccountType.ASSET, code: '1110' },
      
      // Liabilities
      { name: 'Accounts Payable', type: AccountType.LIABILITY, code: '2000' },
      { name: 'Accrued Expenses', type: AccountType.LIABILITY, code: '2010' },
      
      // Equity
      { name: 'Owner\'s Equity', type: AccountType.EQUITY, code: '3000' },
      { name: 'Retained Earnings', type: AccountType.EQUITY, code: '3010' },
      
      // Income
      { name: 'Tuition Income', type: AccountType.INCOME, code: '4000' },
      { name: 'Fee Income', type: AccountType.INCOME, code: '4010' },
      { name: 'Other Income', type: AccountType.INCOME, code: '4020' },
      
      // Expenses
      { name: 'Salaries', type: AccountType.EXPENSE, code: '5000' },
      { name: 'Utilities', type: AccountType.EXPENSE, code: '5010' },
      { name: 'Rent', type: AccountType.EXPENSE, code: '5020' },
      { name: 'Supplies', type: AccountType.EXPENSE, code: '5030' },
      { name: 'Other Expenses', type: AccountType.EXPENSE, code: '5040' },
    ];

    for (const account of defaultAccounts) {
      try {
        await this.repository.createAccount(
          {
            branchId: context.branchId,
            name: account.name,
            type: account.type,
            code: account.code,
            description: `Default ${account.name} account`,
            isActive: true,
          },
          context
        );
      } catch (error) {
        // Account might already exist, continue
        console.warn(`Account ${account.name} might already exist`, error);
      }
    }
  }
}

// Singleton instance
export const ledgerService = new LedgerService();
