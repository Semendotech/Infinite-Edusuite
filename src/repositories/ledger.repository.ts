/**
 * Ledger Repository
 * 
 * Data access layer for the double-entry accounting ledger.
 * Handles all database operations for accounts, journal entries, and journal lines.
 * 
 * This repository:
 * - Enforces branch isolation
 * - Supports idempotency keys
 * - Provides immutable operations (no updates, only inserts)
 * - Integrates with RBAC system
 */

import { supabase } from '@/integrations/supabase/client';
import { RequestContext } from '@/core/context/request-context';

/**
 * Account types
 */
export enum AccountType {
  ASSET = 'asset',
  LIABILITY = 'liability',
  EQUITY = 'equity',
  INCOME = 'income',
  EXPENSE = 'expense',
}

/**
 * Account entity
 */
export interface Account {
  id: string;
  branchId: string;
  name: string;
  type: AccountType;
  code: string;
  description?: string;
  isActive: boolean;
  parentAccountId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Journal entry status
 */
export enum JournalEntryStatus {
  DRAFT = 'draft',
  POSTED = 'posted',
}

/**
 * Journal entry entity
 */
export interface JournalEntry {
  id: string;
  branchId: string;
  referenceId?: string;
  referenceType?: string;
  description: string;
  status: JournalEntryStatus;
  postedAt?: Date;
  createdBy: string;
  createdAt: Date;
  idempotencyKey?: string;
  transactionHash?: string;
}

/**
 * Journal line entity
 */
export interface JournalLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
  metadata?: Record<string, any>;
  lineNumber: number;
  createdAt: Date;
}

/**
 * Account balance
 */
export interface AccountBalance {
  accountId: string;
  accountName: string;
  accountType: AccountType;
  balance: number;
  debit: number;
  credit: number;
}

/**
 * Trial balance
 */
export interface TrialBalance {
  branchId: string;
  asOfDate: Date;
  totalDebits: number;
  totalCredits: number;
  accounts: AccountBalance[];
}

/**
 * Ledger Repository
 */
export class LedgerRepository {
  private supabase = supabase;

  /**
   * Create account
   */
  async createAccount(
    account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>,
    context: RequestContext
  ): Promise<Account> {
    const { data, error } = await this.supabase
      .from('accounts' as any)
      .insert({
        id: crypto.randomUUID(),
        branch_id: account.branchId,
        name: account.name,
        type: account.type,
        code: account.code,
        description: account.description,
        is_active: account.isActive,
        parent_account_id: account.parentAccountId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      branchId: data.branch_id,
      name: data.name,
      type: data.type,
      code: data.code,
      description: data.description,
      isActive: data.is_active,
      parentAccountId: data.parent_account_id,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Get account by ID
   */
  async getAccountById(
    accountId: string,
    context: RequestContext
  ): Promise<Account | null> {
    const { data, error } = await this.supabase
      .from('accounts' as any)
      .select('*')
      .eq('id', accountId)
      .eq('branch_id', context.branchId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      branchId: data.branch_id,
      name: data.name,
      type: data.type,
      code: data.code,
      description: data.description,
      isActive: data.is_active,
      parentAccountId: data.parent_account_id,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Get accounts by branch
   */
  async getAccountsByBranch(
    context: RequestContext
  ): Promise<Account[]> {
    const { data, error } = await this.supabase
      .from('accounts' as any)
      .select('*')
      .eq('branch_id', context.branchId)
      .eq('is_active', true)
      .order('code');

    if (error) throw error;

    return (data || []).map((account: any) => ({
      id: account.id,
      branchId: account.branch_id,
      name: account.name,
      type: account.type,
      code: account.code,
      description: account.description,
      isActive: account.is_active,
      parentAccountId: account.parent_account_id,
      createdAt: new Date(account.created_at),
      updatedAt: new Date(account.updated_at),
    }));
  }

  /**
   * Get accounts by type
   */
  async getAccountsByType(
    type: AccountType,
    context: RequestContext
  ): Promise<Account[]> {
    const { data, error } = await this.supabase
      .from('accounts' as any)
      .select('*')
      .eq('branch_id', context.branchId)
      .eq('type', type)
      .eq('is_active', true)
      .order('code');

    if (error) throw error;

    return (data || []).map((account: any) => ({
      id: account.id,
      branchId: account.branch_id,
      name: account.name,
      type: account.type,
      code: account.code,
      description: account.description,
      isActive: account.is_active,
      parentAccountId: account.parent_account_id,
      createdAt: new Date(account.created_at),
      updatedAt: new Date(account.updated_at),
    }));
  }

  /**
   * Create journal entry with lines
   * This is an immutable operation - no updates allowed
   */
  async createJournalEntry(
    entry: Omit<JournalEntry, 'id' | 'createdAt' | 'transactionHash'>,
    lines: Omit<JournalLine, 'id' | 'createdAt'>[],
    context: RequestContext
  ): Promise<{ entry: JournalEntry; lines: JournalLine[] }> {
    // Check for idempotency key to prevent duplicates
    if (entry.idempotencyKey) {
      const existing = await this.getJournalEntryByIdempotencyKey(entry.idempotencyKey, context);
      if (existing) {
        // Return existing entry instead of creating duplicate
        const existingLines = await this.getJournalLinesByEntryId(existing.id, context);
        return { entry: existing, lines: existingLines };
      }
    }

    // Create journal entry
    const { data: entryData, error: entryError } = await this.supabase
      .from('journal_entries' as any)
      .insert({
        id: crypto.randomUUID(),
        branch_id: entry.branchId,
        reference_id: entry.referenceId,
        reference_type: entry.referenceType,
        description: entry.description,
        status: entry.status,
        posted_at: entry.postedAt?.toISOString(),
        created_by: entry.createdBy,
        created_at: new Date().toISOString(),
        idempotency_key: entry.idempotencyKey,
      })
      .select()
      .single();

    if (entryError) throw entryError;

    // Create journal lines
    const { data: linesData, error: linesError } = await this.supabase
      .from('journal_lines' as any)
      .insert(
        lines.map((line, index) => ({
          id: crypto.randomUUID(),
          journal_entry_id: entryData.id,
          account_id: line.accountId,
          debit: line.debit,
          credit: line.credit,
          description: line.description,
          metadata: line.metadata,
          line_number: line.lineNumber,
          created_at: new Date().toISOString(),
        }))
      )
      .select();

    if (linesError) throw linesError;

    const journalEntry: JournalEntry = {
      id: entryData.id,
      branchId: entryData.branch_id,
      referenceId: entryData.reference_id,
      referenceType: entryData.reference_type,
      description: entryData.description,
      status: entryData.status,
      postedAt: entryData.posted_at ? new Date(entryData.posted_at) : undefined,
      createdBy: entryData.created_by,
      createdAt: new Date(entryData.created_at),
      idempotencyKey: entryData.idempotency_key,
      transactionHash: entryData.transaction_hash,
    };

    const journalLines: JournalLine[] = (linesData || []).map((line: any) => ({
      id: line.id,
      journalEntryId: line.journal_entry_id,
      accountId: line.account_id,
      debit: line.debit,
      credit: line.credit,
      description: line.description,
      metadata: line.metadata,
      lineNumber: line.line_number,
      createdAt: new Date(line.created_at),
    }));

    return { entry: journalEntry, lines: journalLines };
  }

  /**
   * Get journal entry by ID
   */
  async getJournalEntryById(
    entryId: string,
    context: RequestContext
  ): Promise<JournalEntry | null> {
    const { data, error } = await this.supabase
      .from('journal_entries' as any)
      .select('*')
      .eq('id', entryId)
      .eq('branch_id', context.branchId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      branchId: data.branch_id,
      referenceId: data.reference_id,
      referenceType: data.reference_type,
      description: data.description,
      status: data.status,
      postedAt: data.posted_at ? new Date(data.posted_at) : undefined,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      idempotencyKey: data.idempotency_key,
      transactionHash: data.transaction_hash,
    };
  }

  /**
   * Get journal entry by idempotency key
   */
  async getJournalEntryByIdempotencyKey(
    idempotencyKey: string,
    context: RequestContext
  ): Promise<JournalEntry | null> {
    const { data, error } = await this.supabase
      .from('journal_entries' as any)
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      branchId: data.branch_id,
      referenceId: data.reference_id,
      referenceType: data.reference_type,
      description: data.description,
      status: data.status,
      postedAt: data.posted_at ? new Date(data.posted_at) : undefined,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      idempotencyKey: data.idempotency_key,
      transactionHash: data.transaction_hash,
    };
  }

  /**
   * Get journal lines by entry ID
   */
  async getJournalLinesByEntryId(
    entryId: string,
    context: RequestContext
  ): Promise<JournalLine[]> {
    const { data, error } = await this.supabase
      .from('journal_lines' as any)
      .select('*')
      .eq('journal_entry_id', entryId)
      .order('line_number');

    if (error) throw error;

    return (data || []).map((line: any) => ({
      id: line.id,
      journalEntryId: line.journal_entry_id,
      accountId: line.account_id,
      debit: line.debit,
      credit: line.credit,
      description: line.description,
      metadata: line.metadata,
      lineNumber: line.line_number,
      createdAt: new Date(line.created_at),
    }));
  }

  /**
   * Get journal entries by branch
   */
  async getJournalEntriesByBranch(
    context: RequestContext,
    options?: {
      limit?: number;
      offset?: number;
      referenceType?: string;
      status?: JournalEntryStatus;
    }
  ): Promise<JournalEntry[]> {
    let query = this.supabase
      .from('journal_entries' as any)
      .select('*')
      .eq('branch_id', context.branchId);

    if (options?.referenceType) {
      query = query.eq('reference_type', options.referenceType);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    query = query.order('created_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + options.limit - 1);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map((entry: any) => ({
      id: entry.id,
      branchId: entry.branch_id,
      referenceId: entry.reference_id,
      referenceType: entry.reference_type,
      description: entry.description,
      status: entry.status,
      postedAt: entry.posted_at ? new Date(entry.posted_at) : undefined,
      createdBy: entry.created_by,
      createdAt: new Date(entry.created_at),
      idempotencyKey: entry.idempotency_key,
      transactionHash: entry.transaction_hash,
    }));
  }

  /**
   * Get journal entries by reference
   */
  async getJournalEntriesByReference(
    referenceId: string,
    context: RequestContext
  ): Promise<JournalEntry[]> {
    const { data, error } = await this.supabase
      .from('journal_entries' as any)
      .select('*')
      .eq('reference_id', referenceId)
      .eq('branch_id', context.branchId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((entry: any) => ({
      id: entry.id,
      branchId: entry.branch_id,
      referenceId: entry.reference_id,
      referenceType: entry.reference_type,
      description: entry.description,
      status: entry.status,
      postedAt: entry.posted_at ? new Date(entry.posted_at) : undefined,
      createdBy: entry.created_by,
      createdAt: new Date(entry.created_at),
      idempotencyKey: entry.idempotency_key,
      transactionHash: entry.transaction_hash,
    }));
  }

  /**
   * Get account balance
   */
  async getAccountBalance(
    accountId: string,
    context: RequestContext
  ): Promise<number> {
    const { data, error } = await this.supabase
      .rpc('get_account_balance' as any, {
        p_account_id: accountId,
        p_branch_id: context.branchId,
      });

    if (error) throw error;

    return data || 0;
  }

  /**
   * Get trial balance for branch
   */
  async getTrialBalance(
    context: RequestContext,
    asOfDate?: Date
  ): Promise<TrialBalance> {
    // Get all accounts for branch
    const accounts = await this.getAccountsByBranch(context);
    
    const accountBalances: AccountBalance[] = [];
    let totalDebits = 0;
    let totalCredits = 0;

    for (const account of accounts) {
      const balance = await this.getAccountBalance(account.id, context);
      
      // Calculate debits and credits
      const { data: debitData } = await this.supabase
        .from('journal_lines' as any)
        .select('debit')
        .eq('account_id', account.id);

      const { data: creditData } = await this.supabase
        .from('journal_lines' as any)
        .select('credit')
        .eq('account_id', account.id);

      const debit = (debitData || []).reduce((sum: number, line: any) => sum + line.debit, 0);
      const credit = (creditData || []).reduce((sum: number, line: any) => sum + line.credit, 0);

      totalDebits += debit;
      totalCredits += credit;

      accountBalances.push({
        accountId: account.id,
        accountName: account.name,
        accountType: account.type,
        balance,
        debit,
        credit,
      });
    }

    return {
      branchId: context.branchId,
      asOfDate: asOfDate || new Date(),
      totalDebits,
      totalCredits,
      accounts: accountBalances,
    };
  }

  /**
   * Get ledger for branch
   */
  async getBranchLedger(
    context: RequestContext,
    options?: {
      accountId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<{ entries: JournalEntry[]; lines: JournalLine[] }> {
    let query = this.supabase
      .from('journal_entries' as any)
      .select('*, journal_lines(*)')
      .eq('branch_id', context.branchId)
      .eq('status', JournalEntryStatus.POSTED);

    if (options?.accountId) {
      query = query.filter('journal_lines.account_id', 'eq', options.accountId);
    }

    if (options?.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }

    if (options?.endDate) {
      query = query.lte('created_at', options.endDate.toISOString());
    }

    query = query.order('created_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    const entries: JournalEntry[] = (data || []).map((entry: any) => ({
      id: entry.id,
      branchId: entry.branch_id,
      referenceId: entry.reference_id,
      referenceType: entry.reference_type,
      description: entry.description,
      status: entry.status,
      postedAt: entry.posted_at ? new Date(entry.posted_at) : undefined,
      createdBy: entry.created_by,
      createdAt: new Date(entry.created_at),
      idempotencyKey: entry.idempotency_key,
      transactionHash: entry.transaction_hash,
    }));

    const lines: JournalLine[] = [];
    for (const entry of data || []) {
      if (entry.journal_lines) {
        lines.push(...entry.journal_lines.map((line: any) => ({
          id: line.id,
          journalEntryId: line.journal_entry_id,
          accountId: line.account_id,
          debit: line.debit,
          credit: line.credit,
          description: line.description,
          metadata: line.metadata,
          lineNumber: line.line_number,
          createdAt: new Date(line.created_at),
        })));
      }
    }

    return { entries, lines };
  }
}

// Singleton instance
export const ledgerRepository = new LedgerRepository();
