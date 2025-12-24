-- Update the delivery_method check constraint to include 'feed' option
-- Run this in Supabase SQL Editor

-- Step 1: Drop the existing constraint
ALTER TABLE export_profiles 
DROP CONSTRAINT IF EXISTS export_profiles_delivery_method_check;

-- Step 2: Add the new constraint with 'feed' included
ALTER TABLE export_profiles 
ADD CONSTRAINT export_profiles_delivery_method_check 
CHECK (delivery_method IN ('download', 'feed', 'webhook', 's3'));

-- Verify the change
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint 
WHERE conrelid = 'export_profiles'::regclass 
AND contype = 'c';

