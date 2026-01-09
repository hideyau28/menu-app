-- Migration: Add foreign currency support
-- Task 2: Store original currency and amount before conversion

-- Add columns to expenses table
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS original_currency text,
ADD COLUMN IF NOT EXISTS original_amount_cents integer;

-- Backfill existing expenses with HKD defaults
UPDATE expenses
SET original_currency = 'HKD',
    original_amount_cents = total_amount_hkd_cents
WHERE original_currency IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN expenses.original_currency IS 'Original currency before conversion (e.g., JPY, HKD)';
COMMENT ON COLUMN expenses.original_amount_cents IS 'Original amount in cents before conversion to HKD';
