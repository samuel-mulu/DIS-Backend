-- Remove legacy medication identity columns that are no longer used.
-- These columns can still exist in older databases and cause create failures.
ALTER TABLE "Medication"
DROP COLUMN IF EXISTS "code",
DROP COLUMN IF EXISTS "brandName",
DROP COLUMN IF EXISTS "manufacturer",
DROP COLUMN IF EXISTS "category";
