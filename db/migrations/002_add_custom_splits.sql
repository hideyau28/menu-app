-- Migration: Add custom split amounts support
-- Task 3: Allow unequal distribution of expenses among participants

-- Add amount column to expense_participants table
ALTER TABLE expense_participants
ADD COLUMN IF NOT EXISTS amount_cents integer;

-- Add comment for documentation
COMMENT ON COLUMN expense_participants.amount_cents IS 'Custom split amount in cents. NULL means equal split among all participants';

-- No backfill needed - NULL means equal split (existing behavior)
