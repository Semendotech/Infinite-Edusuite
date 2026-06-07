-- Double-Entry Accounting Ledger Schema
-- Immutable financial accounting system for Infinite EduSuite

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  code TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  parent_account_id UUID REFERENCES accounts(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT accounts_branch_code_unique UNIQUE (branch_id, code)
);

-- Indexes for accounts
CREATE INDEX idx_accounts_branch ON accounts(branch_id);
CREATE INDEX idx_accounts_type ON accounts(type);
CREATE INDEX idx_accounts_parent ON accounts(parent_account_id);

-- Journal Entries (Immutable - Append Only)
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  reference_id TEXT, -- Links to invoice, payment, M-Pesa transaction, etc.
  reference_type TEXT, -- 'invoice', 'payment', 'mpesa', 'expense', etc.
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('draft', 'posted')),
  posted_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  idempotency_key TEXT UNIQUE,
  transaction_hash TEXT, -- Digital hash for immutability verification
  
  CONSTRAINT journal_entries_idempotency_key_unique UNIQUE (idempotency_key)
);

-- Indexes for journal_entries
CREATE INDEX idx_journal_entries_branch ON journal_entries(branch_id);
CREATE INDEX idx_journal_entries_reference ON journal_entries(reference_id);
CREATE INDEX idx_journal_entries_reference_type ON journal_entries(reference_type);
CREATE INDEX idx_journal_entries_created_by ON journal_entries(created_by);
CREATE INDEX idx_journal_entries_created_at ON journal_entries(created_at);
CREATE INDEX idx_journal_entries_idempotency_key ON journal_entries(idempotency_key);

-- Journal Lines (Immutable - Append Only)
CREATE TABLE IF NOT EXISTS journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id),
  debit NUMERIC(18, 2) NOT NULL DEFAULT 0,
  credit NUMERIC(18, 2) NOT NULL DEFAULT 0,
  description TEXT,
  metadata JSONB,
  line_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for journal_lines
CREATE INDEX idx_journal_lines_journal_entry ON journal_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_account ON journal_lines(account_id);
CREATE INDEX idx_journal_lines_account_debit ON journal_lines(account_id, debit);
CREATE INDEX idx_journal_lines_account_credit ON journal_lines(account_id, credit);

-- Enable Row Level Security
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for accounts
CREATE POLICY "Users can view accounts in their branch"
  ON accounts FOR SELECT
  USING (
    branch_id IN (
      SELECT branch_id FROM user_branches WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can view all accounts"
  ON accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- RLS Policies for journal_entries
CREATE POLICY "Users can view journal entries in their branch"
  ON journal_entries FOR SELECT
  USING (
    branch_id IN (
      SELECT branch_id FROM user_branches WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can view all journal entries"
  ON journal_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- No INSERT/UPDATE/DELETE policies - only service layer can modify

-- RLS Policies for journal_lines
CREATE POLICY "Users can view journal lines in their branch"
  ON journal_lines FOR SELECT
  USING (
    journal_entry_id IN (
      SELECT id FROM journal_entries
      WHERE branch_id IN (
        SELECT branch_id FROM user_branches WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Super admins can view all journal lines"
  ON journal_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Functions for balance calculation
CREATE OR REPLACE FUNCTION get_account_balance(p_account_id UUID, p_branch_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_debit NUMERIC := 0;
  v_credit NUMERIC := 0;
  v_account_type TEXT;
  v_balance NUMERIC;
BEGIN
  -- Get account type
  SELECT type INTO v_account_type
  FROM accounts
  WHERE id = p_account_id AND branch_id = p_branch_id;
  
  -- Calculate debits and credits
  SELECT COALESCE(SUM(debit), 0) INTO v_debit
  FROM journal_lines jl
  JOIN journal_entries je ON jl.journal_entry_id = je.id
  WHERE jl.account_id = p_account_id
    AND je.branch_id = p_branch_id
    AND je.status = 'posted';
  
  SELECT COALESCE(SUM(credit), 0) INTO v_credit
  FROM journal_lines jl
  JOIN journal_entries je ON jl.journal_entry_id = je.id
  WHERE jl.account_id = p_account_id
    AND je.branch_id = p_branch_id
    AND je.status = 'posted';
  
  -- Calculate balance based on account type
  IF v_account_type IN ('asset', 'expense') THEN
    v_balance := v_debit - v_credit;
  ELSE
    v_balance := v_credit - v_debit;
  END IF;
  
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- Function to validate journal entry balance
CREATE OR REPLACE FUNCTION validate_journal_entry_balance(p_journal_entry_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_total_debit NUMERIC := 0;
  v_total_credit NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(debit), 0) INTO v_total_debit
  FROM journal_lines
  WHERE journal_entry_id = p_journal_entry_id;
  
  SELECT COALESCE(SUM(credit), 0) INTO v_total_credit
  FROM journal_lines
  WHERE journal_entry_id = p_journal_entry_id;
  
  RETURN v_total_debit = v_total_credit;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate journal entry balance before posting
CREATE OR REPLACE FUNCTION validate_journal_entry_balance_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'posted' THEN
    IF NOT validate_journal_entry_balance(NEW.id) THEN
      RAISE EXCEPTION 'Journal entry must balance (debits must equal credits)';
    END IF;
    
    NEW.posted_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_journal_entry_balance_before_post
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION validate_journal_entry_balance_trigger();

-- Function to generate transaction hash
CREATE OR REPLACE FUNCTION generate_transaction_hash(p_journal_entry_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT encode(
    digest(
      json_build_object(
        'id', id,
        'branch_id', branch_id,
        'reference_id', reference_id,
        'reference_type', reference_type,
        'description', description,
        'lines', (
          SELECT json_agg(
            json_build_object(
              'account_id', account_id,
              'debit', debit,
              'credit', credit,
              'line_number', line_number
            )
          )
          FROM journal_lines
          WHERE journal_entry_id = p_journal_entry_id
          ORDER BY line_number
        )
      )::text,
      'sha256'
    ),
    'hex'
  ) INTO v_hash
  FROM journal_entries
  WHERE id = p_journal_entry_id;
  
  RETURN v_hash;
END;
$$ LANGUAGE plpgsql;

-- Trigger to generate transaction hash on insert
CREATE OR REPLACE FUNCTION generate_transaction_hash_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.transaction_hash = generate_transaction_hash(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_transaction_hash_on_insert
  BEFORE INSERT ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION generate_transaction_hash_trigger();
